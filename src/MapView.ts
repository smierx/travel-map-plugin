import { ItemView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import * as L from "leaflet";
import TravelMapPlugin from "../main";
import { Place, Route, PriorityColors, priorityColor, prioritySize, buildLegend, categoryIcon } from "./types";
import { getVacations, getVacationFiles, getPlaces, getRoutes, resolveRouteCoords, getCategories, roundCoord, buildPlaceFileContent, routeDistanceKm, formatDistance, sortPlacesByPriority } from "./utils";
import { CreatePlaceModal } from "./CreatePlaceModal";

export const TRAVEL_MAP_VIEW_TYPE = "travel-map";

const UNCATEGORIZED = "(no category)";

interface RouteEntry {
    group: L.LayerGroup;
    visible: boolean;
    color: string;
    distanceKm: number;
}

export class MapView extends ItemView {
    private plugin: TravelMapPlugin;
    private leafletMap: L.Map | null = null;
    private markerLayer: L.LayerGroup | null = null;
    private routeLayers: Map<string, RouteEntry> = new Map();
    private markers: Map<string, L.Marker> = new Map();
    private places: Place[] = [];
    private routes: Route[] = [];
    private activeCategories: Set<string> = new Set();
    private activeVacation: string = "";
    private mapEl: HTMLElement | null = null;
    private routeControlEl: HTMLElement | null = null;
    private categoryControlEl: HTMLElement | null = null;
    private placeListEl: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: TravelMapPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() { return TRAVEL_MAP_VIEW_TYPE; }
    getDisplayText() { return "Travel Map"; }
    getIcon() { return "map"; }

    async onOpen() {
        this.activeVacation = this.plugin.settings.activeVacation;
        this.buildUI();
        this.registerEvent(
            this.app.metadataCache.on("changed", () => this.refreshMap())
        );
    }

    async onClose() {
        if (this.leafletMap) {
            this.leafletMap.remove();
            this.leafletMap = null;
        }
        this.mapEl = null;
        this.routeControlEl = null;
        this.categoryControlEl = null;
        this.placeListEl = null;
        this.markerLayer = null;
        this.routeLayers.clear();
        this.markers.clear();
    }

    // ── UI ───────────────────────────────────────────────────────────────────

    private buildUI() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass("tm-view");

        if (this.leafletMap) {
            this.leafletMap.remove();
            this.leafletMap = null;
            this.markerLayer = null;
            this.routeLayers.clear();
        }

        const toolbar = containerEl.createDiv("tm-toolbar");
        this.buildToolbar(toolbar);

        this.mapEl = containerEl.createDiv("tm-map");

        setTimeout(() => this.initLeaflet(), 50);
    }

    private buildToolbar(parent: HTMLElement) {
        const vacations = getVacations(this.app, this.plugin.settings.rootFolder);

        const select = parent.createEl("select", { cls: "tm-vacation-select" });
        const emptyOpt = select.createEl("option", { text: "Select trip…" });
        emptyOpt.value = "";

        for (const v of vacations) {
            const opt = select.createEl("option", { text: v.name });
            opt.value = v.path;
            if (v.path === this.activeVacation) opt.selected = true;
        }

        select.addEventListener("change", async () => {
            this.activeVacation = select.value;
            this.plugin.settings.activeVacation = select.value;
            await this.plugin.saveSettings();
            this.refreshMap();
        });

        const refreshBtn = parent.createEl("button", { cls: "tm-refresh-btn", text: "⟳" });
        refreshBtn.title = "Refresh trip list";
        refreshBtn.addEventListener("click", () => this.buildUI());
    }

    // ── Leaflet ──────────────────────────────────────────────────────────────

    private initLeaflet() {
        if (!this.mapEl) return;

        const map = L.map(this.mapEl, { center: [48, 15], zoom: 4 });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(map);

        this.markerLayer = L.layerGroup().addTo(map);
        this.addLegendControl(map, this.plugin.settings.colors);
        this.addPlaceListControl(map);
        this.addCategoryControl(map);
        this.addRouteControl(map);
        this.leafletMap = map;

        map.on("contextmenu", (e: L.LeafletMouseEvent) => this.onMapRightClick(e));

        this.refreshMap();
    }

    // ── F1: Ort per Rechtsklick anlegen ────────────────────────────────────────

    private onMapRightClick(e: L.LeafletMouseEvent) {
        if (!this.activeVacation) {
            new Notice("Erst einen Trip im Dropdown wählen.");
            return;
        }
        const lat = roundCoord(e.latlng.lat);
        const lng = roundCoord(e.latlng.lng);
        new CreatePlaceModal(this.app, lat, lng, async (name, opts) => {
            await this.createPlaceFile(name, lat, lng, opts);
        }).open();
    }

    private async createPlaceFile(
        name: string,
        lat: number,
        lng: number,
        opts: { category?: string; priority?: number },
    ) {
        const { keys } = this.plugin.settings;
        const safeName = name.replace(/[\\/:*?"<>|]/g, "").trim();
        if (!safeName) {
            new Notice("Ungültiger Name.");
            return;
        }
        const path = `${this.activeVacation}/${safeName}.md`;
        if (this.app.vault.getAbstractFileByPath(path)) {
            new Notice(`„${safeName}" existiert bereits.`);
            return;
        }
        const content = buildPlaceFileContent(keys, lat, lng, opts);
        try {
            const created = await this.app.vault.create(path, content);
            new Notice(`Ort „${safeName}" angelegt.`);
            if (this.plugin.settings.openNewPlace && created instanceof TFile) {
                await this.app.workspace.getLeaf().openFile(created);
            }
        } catch (err) {
            new Notice(`Anlegen fehlgeschlagen: ${err}`);
        }
    }

    private addLegendControl(map: L.Map, colors: PriorityColors) {
        const legend = buildLegend(colors);
        const Legend = L.Control.extend({
            onAdd() {
                const div = L.DomUtil.create("div", "tm-legend");
                for (const { label, color } of legend) {
                    const row = L.DomUtil.create("div", "tm-legend-row", div);
                    const dot = L.DomUtil.create("span", "tm-legend-dot", row);
                    dot.style.background = color;
                    L.DomUtil.create("span", "", row).textContent = label;
                }
                return div;
            },
        });
        new Legend({ position: "bottomleft" }).addTo(map);
    }

    private addRouteControl(map: L.Map) {
        const self = this;
        const RouteControl = L.Control.extend({
            onAdd() {
                const div = L.DomUtil.create("div", "tm-route-control leaflet-bar");
                L.DomEvent.disableClickPropagation(div);
                self.routeControlEl = div;
                return div;
            },
        });
        new RouteControl({ position: "topright" }).addTo(map);
    }

    private addCategoryControl(map: L.Map) {
        const self = this;
        const CategoryControl = L.Control.extend({
            onAdd() {
                const div = L.DomUtil.create("div", "tm-category-control leaflet-bar");
                L.DomEvent.disableClickPropagation(div);
                self.categoryControlEl = div;
                return div;
            },
        });
        new CategoryControl({ position: "topright" }).addTo(map);
    }

    // ── Daten laden ────────────────────────────────────────────────────────────

    private refreshMap() {
        if (!this.leafletMap || !this.markerLayer) return;

        for (const { group } of this.routeLayers.values()) group.remove();
        this.routeLayers.clear();

        if (!this.activeVacation) {
            this.places = [];
            this.routes = [];
            this.markerLayer.clearLayers();
            this.markers.clear();
            this.renderCategoryControl();
            this.renderRouteControl();
            this.renderPlaceList();
            return;
        }

        const { keys } = this.plugin.settings;
        const files = getVacationFiles(this.app, this.activeVacation);
        this.places = getPlaces(this.app, files, keys);
        this.routes = getRoutes(this.app, files, keys);

        // Kategorien-State mit den real vorhandenen Kategorien synchronisieren.
        // Neue Kategorien sind per Default sichtbar.
        const present = new Set(this.places.map(p => p.category ?? UNCATEGORIZED));
        for (const c of present) {
            if (!this.activeCategories.has(c)) this.activeCategories.add(c);
        }
        for (const c of [...this.activeCategories]) {
            if (!present.has(c)) this.activeCategories.delete(c);
        }

        this.renderMarkers();
        this.fitToPlaces();

        for (const route of this.routes) {
            this.addRoute(route, this.places);
        }

        this.renderCategoryControl();
        this.renderRouteControl();
        this.renderPlaceList();
    }

    private fitToPlaces() {
        if (!this.leafletMap) return;
        const bounds = this.places.map(p => [p.lat, p.lng] as [number, number]);
        if (bounds.length === 1) {
            this.leafletMap.setView(bounds[0], 12);
        } else if (bounds.length > 1) {
            this.leafletMap.fitBounds(bounds, { padding: [40, 40] });
        }
    }

    // ── Marker rendern (respektiert Kategorie-Filter) ──────────────────────────

    private renderMarkers() {
        if (!this.markerLayer) return;
        this.markerLayer.clearLayers();
        this.markers.clear();
        for (const place of this.places) {
            const cat = place.category ?? UNCATEGORIZED;
            if (!this.activeCategories.has(cat)) continue;
            this.addMarker(place);
        }
    }

    private addMarker(place: Place) {
        if (!this.markerLayer || !this.leafletMap) return;

        const farbe = priorityColor(place.priority, this.plugin.settings.colors);
        const emoji = categoryIcon(place.category, this.plugin.settings.categoryIcons);
        // Mit Emoji braucht der Pin etwas mehr Fläche, damit das Icon lesbar bleibt.
        const size = emoji ? Math.max(prioritySize(place.priority), 20) : prioritySize(place.priority);
        const half = size / 2;

        const inner = emoji
            ? `<div class="tm-pin-inner" style="background:${farbe};width:${size}px;height:${size}px"><span class="tm-pin-icon" style="font-size:${Math.round(size * 0.62)}px">${emoji}</span></div>`
            : `<div class="tm-pin-inner" style="background:${farbe};width:${size}px;height:${size}px"></div>`;

        const icon = L.divIcon({
            className: "tm-pin",
            html: inner,
            iconSize: [size, size],
            iconAnchor: [half, half],
            popupAnchor: [0, -half - 2],
        });

        const popupDiv = document.createElement("div");
        popupDiv.className = "tm-popup";

        const nameEl = document.createElement("strong");
        nameEl.textContent = place.file.basename;
        popupDiv.appendChild(nameEl);

        const metaEl = document.createElement("div");
        metaEl.className = "tm-popup-meta";
        const dot = document.createElement("span");
        dot.className = "tm-popup-prio-dot";
        dot.style.background = farbe;
        metaEl.appendChild(dot);
        const metaText = document.createElement("span");
        const parts: string[] = [`Priority ${place.priority}`];
        if (place.category) parts.push(place.category);
        metaText.textContent = parts.join(" · ");
        metaEl.appendChild(metaText);
        popupDiv.appendChild(metaEl);

        const openBtn = document.createElement("button");
        openBtn.className = "tm-popup-open";
        openBtn.textContent = "Open note";
        openBtn.onclick = () => this.app.workspace.getLeaf().openFile(place.file);
        popupDiv.appendChild(openBtn);

        const marker = L.marker([place.lat, place.lng], { icon, draggable: true })
            .bindPopup(popupDiv)
            .addTo(this.markerLayer);

        // F2: Drag schreibt die neuen Koordinaten ins Frontmatter zurück.
        marker.on("dragend", () => this.persistMarkerPosition(place.file, marker));

        this.markers.set(place.file.basename, marker);
    }

    private async persistMarkerPosition(file: TFile, marker: L.Marker) {
        const { lat, lng } = marker.getLatLng();
        try {
            await this.app.fileManager.processFrontMatter(file, (fm) => {
                fm["lat"] = roundCoord(lat);
                fm["lng"] = roundCoord(lng);
            });
        } catch (err) {
            new Notice(`Position speichern fehlgeschlagen: ${err}`);
        }
    }

    private renderCategoryControl() {
        if (!this.categoryControlEl) return;
        this.categoryControlEl.empty();

        const categories = getCategories(this.places);
        const hasUncategorized = this.places.some(p => !p.category);
        const rows = [...categories];
        if (hasUncategorized) rows.push(UNCATEGORIZED);

        if (rows.length <= 1) return; // Filter erst ab 2 Gruppen sinnvoll

        const header = document.createElement("div");
        header.className = "tm-rc-header";
        header.textContent = "Categories";
        this.categoryControlEl.appendChild(header);

        for (const cat of rows) {
            const row = document.createElement("label");
            row.className = "tm-rc-row";

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = this.activeCategories.has(cat);
            cb.addEventListener("change", () => {
                if (cb.checked) this.activeCategories.add(cat);
                else this.activeCategories.delete(cat);
                row.classList.toggle("tm-rc-row--off", !cb.checked);
                this.renderMarkers();
            });

            const emoji = cat === UNCATEGORIZED ? "" : categoryIcon(cat, this.plugin.settings.categoryIcons);
            const nameEl = document.createElement("span");
            nameEl.textContent = emoji ? `${emoji} ${cat}` : cat;

            row.appendChild(cb);
            row.appendChild(nameEl);
            this.categoryControlEl.appendChild(row);
        }
    }

    private addRoute(route: Route, places: Place[]) {
        if (!this.leafletMap) return;

        const coords = resolveRouteCoords(places, route.locations);
        if (coords.length < 2) return;

        const line = L.polyline(coords, {
            color: route.color,
            weight: 3,
            opacity: 0.8,
        });

        // F6: nummerierte Wegpunkte (Reihenfolge entlang der Route).
        const group = L.layerGroup([line]);
        coords.forEach((coord, i) => {
            const badge = L.divIcon({
                className: "tm-route-num",
                html: `<div class="tm-route-num-inner" style="background:${route.color}">${i + 1}</div>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9],
            });
            L.marker(coord, { icon: badge, interactive: false, keyboard: false }).addTo(group);
        });

        group.addTo(this.leafletMap);

        this.routeLayers.set(route.file.basename, {
            group,
            visible: true,
            color: route.color,
            distanceKm: routeDistanceKm(coords),
        });
    }

    private renderRouteControl() {
        if (!this.routeControlEl) return;
        this.routeControlEl.empty();

        if (this.routeLayers.size === 0) return;

        const header = document.createElement("div");
        header.className = "tm-rc-header";
        header.textContent = "Routes";
        this.routeControlEl.appendChild(header);

        for (const [name, entry] of this.routeLayers) {
            const row = document.createElement("label");
            row.className = "tm-rc-row";

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = entry.visible;
            cb.addEventListener("change", () => {
                if (!this.leafletMap) return;
                entry.visible = cb.checked;
                if (cb.checked) entry.group.addTo(this.leafletMap);
                else entry.group.remove();
                row.classList.toggle("tm-rc-row--off", !cb.checked);
            });

            const colorDot = document.createElement("span");
            colorDot.className = "tm-rc-dot";
            colorDot.style.background = entry.color;

            const nameEl = document.createElement("span");
            nameEl.className = "tm-rc-name";
            nameEl.textContent = name;

            const distEl = document.createElement("span");
            distEl.className = "tm-rc-dist";
            distEl.textContent = formatDistance(entry.distanceKm);

            row.appendChild(cb);
            row.appendChild(colorDot);
            row.appendChild(nameEl);
            row.appendChild(distEl);
            this.routeControlEl.appendChild(row);
        }
    }

    // ── F4: Orts-Liste / Sprung-Panel ──────────────────────────────────────────

    private addPlaceListControl(map: L.Map) {
        const self = this;
        const PlaceListControl = L.Control.extend({
            onAdd() {
                const div = L.DomUtil.create("div", "tm-place-list leaflet-bar");
                L.DomEvent.disableClickPropagation(div);
                L.DomEvent.disableScrollPropagation(div);
                self.placeListEl = div;
                return div;
            },
        });
        new PlaceListControl({ position: "topleft" }).addTo(map);
    }

    private renderPlaceList() {
        if (!this.placeListEl) return;
        this.placeListEl.empty();

        if (this.places.length === 0) return;

        const header = document.createElement("div");
        header.className = "tm-rc-header";
        header.textContent = `Places (${this.places.length})`;
        this.placeListEl.appendChild(header);

        const list = document.createElement("div");
        list.className = "tm-pl-scroll";
        this.placeListEl.appendChild(list);

        for (const place of sortPlacesByPriority(this.places)) {
            const row = document.createElement("div");
            row.className = "tm-pl-row";

            const dot = document.createElement("span");
            dot.className = "tm-rc-dot";
            dot.style.background = priorityColor(place.priority, this.plugin.settings.colors);

            const emoji = categoryIcon(place.category, this.plugin.settings.categoryIcons);
            const nameEl = document.createElement("span");
            nameEl.className = "tm-pl-name";
            nameEl.textContent = emoji ? `${emoji} ${place.file.basename}` : place.file.basename;

            row.appendChild(dot);
            row.appendChild(nameEl);
            row.addEventListener("click", () => this.flyToPlace(place));
            list.appendChild(row);
        }
    }

    private flyToPlace(place: Place) {
        if (!this.leafletMap) return;
        this.leafletMap.setView([place.lat, place.lng], 13);
        const marker = this.markers.get(place.file.basename);
        if (marker) marker.openPopup();
    }
}
