import { App, TFile, TFolder } from "obsidian";
import { Place, Route, PRIORITY_DEFAULT, FrontmatterKeys, DEFAULT_FRONTMATTER_KEYS } from "./types";

export function getVacations(app: App, rootFolder: string): TFolder[] {
    const root = app.vault.getAbstractFileByPath(rootFolder);
    if (!(root instanceof TFolder)) return [];
    return root.children
        .filter((c): c is TFolder => c instanceof TFolder)
        .sort((a, b) => a.name.localeCompare(b.name));
}

export function getVacationFiles(app: App, vacationPath: string): TFile[] {
    const folder = app.vault.getAbstractFileByPath(vacationPath);
    if (!(folder instanceof TFolder)) return [];
    return collectMarkdownFiles(folder);
}

function collectMarkdownFiles(folder: TFolder): TFile[] {
    const files: TFile[] = [];
    for (const child of folder.children) {
        if (child instanceof TFile && child.extension === "md") {
            files.push(child);
        } else if (child instanceof TFolder) {
            files.push(...collectMarkdownFiles(child));
        }
    }
    return files;
}

export function getFrontmatter(app: App, file: TFile): Record<string, unknown> | null {
    return app.metadataCache.getFileCache(file)?.frontmatter ?? null;
}

export function getPlaces(
    app: App,
    files: TFile[],
    keys: FrontmatterKeys = DEFAULT_FRONTMATTER_KEYS,
): Place[] {
    const places: Place[] = [];
    for (const file of files) {
        const fm = getFrontmatter(app, file);
        if (!fm || fm[keys.typeField] !== keys.placeValue) continue;
        const lat = fm["lat"];
        const lng = fm["lng"];
        if (typeof lat !== "number" || typeof lng !== "number") continue;
        const raw = fm[keys.priorityField];
        const priority = typeof raw === "number"
            ? Math.min(10, Math.max(1, Math.round(raw)))
            : PRIORITY_DEFAULT;
        const rawDay = fm[keys.dayField];
        const day = typeof rawDay === "number" ? Math.round(rawDay) : undefined;
        places.push({ file, lat, lng, category: fm[keys.categoryField] as string | undefined, priority, day });
    }
    return places;
}

export function getRoutes(
    app: App,
    files: TFile[],
    keys: FrontmatterKeys = DEFAULT_FRONTMATTER_KEYS,
): Route[] {
    const routes: Route[] = [];
    for (const file of files) {
        const fm = getFrontmatter(app, file);
        if (!fm || fm[keys.typeField] !== keys.routeValue) continue;
        const locations = Array.isArray(fm[keys.locationsField]) ? (fm[keys.locationsField] as string[]) : [];
        routes.push({ file, color: (fm[keys.colorField] as string) ?? "#3388ff", locations });
    }
    return routes;
}

export function parseWikilink(link: string): string {
    return link.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
}

// Rundet eine Koordinate auf 6 Nachkommastellen (~11cm Genauigkeit, mehr ist sinnlos).
export function roundCoord(n: number): number {
    return Math.round(n * 1e6) / 1e6;
}

// Parst eine "kategorie: emoji" Zeile-pro-Eintrag-Texteingabe in eine Map.
// Keys werden lowercased, leere Zeilen und Zeilen ohne ":" ignoriert.
export function parseCategoryIcons(text: string): Record<string, string> {
    const map: Record<string, string> = {};
    for (const line of text.split("\n")) {
        const idx = line.indexOf(":");
        if (idx === -1) continue;
        const key = line.slice(0, idx).trim().toLowerCase();
        const icon = line.slice(idx + 1).trim();
        if (key && icon) map[key] = icon;
    }
    return map;
}

// Serialisiert die Map zurück in "kategorie: emoji" Zeilen, alphabetisch sortiert.
export function serializeCategoryIcons(map: Record<string, string>): string {
    return Object.keys(map)
        .sort((a, b) => a.localeCompare(b))
        .map((k) => `${k}: ${map[k]}`)
        .join("\n");
}

// Orte nach Priorität absteigend, bei Gleichstand alphabetisch. Mutiert nicht.
export function sortPlacesByPriority(places: Place[]): Place[] {
    return [...places].sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.file.basename.localeCompare(b.file.basename);
    });
}

// Distinkte, alphabetisch sortierte Kategorien aller Orte.
export function getCategories(places: Place[]): string[] {
    const set = new Set<string>();
    for (const p of places) {
        if (p.category) set.add(p.category);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
}

// Distinkte, aufsteigend sortierte Tage aller Orte (für die Tagesplanung).
export function getDays(places: Place[]): number[] {
    const set = new Set<number>();
    for (const p of places) {
        if (typeof p.day === "number") set.add(p.day);
    }
    return [...set].sort((a, b) => a - b);
}

export interface NewPlaceOptions {
    category?: string;
    priority?: number;
}

// Baut den Markdown-Inhalt einer neuen Orts-Datei. Respektiert die konfigurierten
// Frontmatter-Keys, damit deutsche wie englische Feldnamen funktionieren.
export function buildPlaceFileContent(
    keys: FrontmatterKeys,
    lat: number,
    lng: number,
    opts: NewPlaceOptions = {},
): string {
    const lines = [
        "---",
        `${keys.typeField}: ${keys.placeValue}`,
        `lat: ${roundCoord(lat)}`,
        `lng: ${roundCoord(lng)}`,
    ];
    if (opts.category) lines.push(`${keys.categoryField}: ${opts.category}`);
    if (typeof opts.priority === "number") {
        lines.push(`${keys.priorityField}: ${Math.min(10, Math.max(1, Math.round(opts.priority)))}`);
    }
    lines.push("---", "");
    return lines.join("\n");
}

export function resolveRouteCoords(places: Place[], wikilinks: string[]): [number, number][] {
    return wikilinks
        .map(link => {
            const name = parseWikilink(link);
            return places.find(p => p.file.basename === name);
        })
        .filter((p): p is Place => p !== undefined)
        .map(p => [p.lat, p.lng]);
}

// Luftlinien-Distanz zwischen zwei Koordinaten in km (Haversine).
export function haversineKm(a: [number, number], b: [number, number]): number {
    const R = 6371; // Erdradius in km
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

// Summierte Luftlinien-Distanz entlang einer Koordinatenfolge in km.
export function routeDistanceKm(coords: [number, number][]): number {
    let sum = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        sum += haversineKm(coords[i], coords[i + 1]);
    }
    return sum;
}

// Distanz für die Anzeige formatieren: < 10 km eine Nachkommastelle, sonst gerundet.
export function formatDistance(km: number): string {
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
}
