import { App, TFile, TFolder } from "obsidian";
import { Place, Route, PRIORITAET_DEFAULT } from "./types";

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

export function getPlaces(app: App, files: TFile[]): Place[] {
    const places: Place[] = [];
    for (const file of files) {
        const fm = getFrontmatter(app, file);
        if (!fm || fm["typ"] !== "ort") continue;
        const lat = fm["lat"];
        const lng = fm["lng"];
        if (typeof lat !== "number" || typeof lng !== "number") continue;
        const raw = fm["priorität"];
        const priorität = typeof raw === "number"
            ? Math.min(10, Math.max(1, Math.round(raw)))
            : PRIORITAET_DEFAULT;
        places.push({ file, lat, lng, kategorie: fm["kategorie"] as string | undefined, priorität });
    }
    return places;
}

export function getRoutes(app: App, files: TFile[]): Route[] {
    const routes: Route[] = [];
    for (const file of files) {
        const fm = getFrontmatter(app, file);
        if (!fm || fm["typ"] !== "route") continue;
        const orte = Array.isArray(fm["orte"]) ? (fm["orte"] as string[]) : [];
        routes.push({ file, farbe: (fm["farbe"] as string) ?? "#3388ff", orte });
    }
    return routes;
}

export function parseWikilink(link: string): string {
    return link.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
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
