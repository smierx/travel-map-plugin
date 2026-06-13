import { ItemView, WorkspaceLeaf } from "obsidian";
import * as L from "leaflet";
import TravelMapPlugin from "../main";
import { Place, Route, prioritaetFarbe, prioritaetGroesse, PRIORITAET_LEGENDE } from "./types";
import { getVacations, getVacationFiles, getPlaces, getRoutes, resolveRouteCoords } from "./utils";

export const TRAVEL_MAP_VIEW_TYPE = "travel-map";

interface RouteEntry {
    line: L.Polyline;
    visible: boolean;
}

export class MapView extends ItemView {
    private plugin: TravelMapPlugin;
    private leafletMap: L.Map | null = null;
    private markerLayer: L.LayerGroup | null = null;
    private routeLayers: Map<string, RouteEntry> = new Map();
    private activeVacation: string = "";
    private mapEl: HTMLElement | null = null;
    private routeControlEl: HTMLElement | null = null;

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
        this.markerLayer = null;
        this.routeLayers.clear();
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
        const emptyOpt = select.createEl("option", { text: "Urlaub wählen …" });
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
        refreshBtn.title = "Urlaubsliste aktualisieren";
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
        this.addLegendControl(map);
        this.addRouteControl(map);
        this.leafletMap = map;

        this.refreshMap();
    }

    private addLegendControl(map: L.Map) {
        const Legend = L.Control.extend({
            onAdd() {
                const div = L.DomUtil.create("div", "tm-legend");
                for (const { label, farbe } of PRIORITAET_LEGENDE) {
                    const row = L.DomUtil.create("div", "tm-legend-row", div);
                    const dot = L.DomUtil.create("span", "tm-legend-dot", row);
                    dot.style.background = farbe;
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

    private refreshMap() {
        if (!this.leafletMap || !this.markerLayer) return;

        this.markerLayer.clearLayers();
        for (const { line } of this.routeLayers.values()) line.remove();
        this.routeLayers.clear();

        if (!this.activeVacation) {
            this.renderRouteControl();
            return;
        }

        const files = getVacationFiles(this.app, this.activeVacation);
        const places = getPlaces(this.app, files);
        const routes = getRoutes(this.app, files);

        const bounds: [number, number][] = [];

        for (const place of places) {
            this.addMarker(place);
            bounds.push([place.lat, place.lng]);
        }

        for (const route of routes) {
            this.addRoute(route, places);
        }

        if (bounds.length === 1) {
            this.leafletMap.setView(bounds[0], 12);
        } else if (bounds.length > 1) {
            this.leafletMap.fitBounds(bounds, { padding: [40, 40] });
        }

        this.renderRouteControl();
    }

    private addMarker(place: Place) {
        if (!this.markerLayer || !this.leafletMap) return;

        const farbe = prioritaetFarbe(place.priorität);
        const size = prioritaetGroesse(place.priorität);
        const half = size / 2;

        const icon = L.divIcon({
            className: "tm-pin",
            html: `<div class="tm-pin-inner" style="background:${farbe};width:${size}px;height:${size}px"></div>`,
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
        const parts: string[] = [`Priorität ${place.priorität}`];
        if (place.kategorie) parts.push(place.kategorie);
        metaText.textContent = parts.join(" · ");
        metaEl.appendChild(metaText);
        popupDiv.appendChild(metaEl);

        const openBtn = document.createElement("button");
        openBtn.className = "tm-popup-open";
        openBtn.textContent = "Notiz öffnen";
        openBtn.onclick = () => this.app.workspace.getLeaf().openFile(place.file);
        popupDiv.appendChild(openBtn);

        L.marker([place.lat, place.lng], { icon })
            .bindPopup(popupDiv)
            .addTo(this.markerLayer);
    }

    private addRoute(route: Route, places: Place[]) {
        if (!this.leafletMap) return;

        const coords = resolveRouteCoords(places, route.orte);
        if (coords.length < 2) return;

        const line = L.polyline(coords, {
            color: route.farbe,
            weight: 3,
            opacity: 0.8,
        }).addTo(this.leafletMap);

        this.routeLayers.set(route.file.basename, { line, visible: true });
    }

    private renderRouteControl() {
        if (!this.routeControlEl) return;
        this.routeControlEl.empty();

        if (this.routeLayers.size === 0) return;

        const header = document.createElement("div");
        header.className = "tm-rc-header";
        header.textContent = "Routen";
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
                if (cb.checked) entry.line.addTo(this.leafletMap);
                else entry.line.remove();
                row.classList.toggle("tm-rc-row--off", !cb.checked);
            });

            const colorDot = document.createElement("span");
            colorDot.className = "tm-rc-dot";
            colorDot.style.background = (entry.line.options as L.PolylineOptions).color ?? "#3388ff";

            const nameEl = document.createElement("span");
            nameEl.textContent = name;

            row.appendChild(cb);
            row.appendChild(colorDot);
            row.appendChild(nameEl);
            this.routeControlEl.appendChild(row);
        }
    }
}
