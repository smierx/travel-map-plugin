import { TFile } from "obsidian";

export interface Place {
    file: TFile;
    lat: number;
    lng: number;
    category?: string;
    priority: number;
}

export interface Route {
    file: TFile;
    color: string;
    locations: string[];
}

export interface FrontmatterKeys {
    typeField: string;
    placeValue: string;
    routeValue: string;
    categoryField: string;
    priorityField: string;
    colorField: string;
    locationsField: string;
}

export interface PriorityColors {
    tier1: string;
    tier2: string;
    tier3: string;
    tier4: string;
    tier5: string;
}

export interface TravelMapSettings {
    rootFolder: string;
    activeVacation: string;
    keys: FrontmatterKeys;
    colors: PriorityColors;
}

export const DEFAULT_FRONTMATTER_KEYS: FrontmatterKeys = {
    typeField: "type",
    placeValue: "place",
    routeValue: "route",
    categoryField: "category",
    priorityField: "priority",
    colorField: "color",
    locationsField: "locations",
};

export const DEFAULT_PRIORITY_COLORS: PriorityColors = {
    tier1: "#95a5a6",
    tier2: "#3498db",
    tier3: "#2ecc71",
    tier4: "#f39c12",
    tier5: "#e74c3c",
};

export const DEFAULT_SETTINGS: TravelMapSettings = {
    rootFolder: "Reisen",
    activeVacation: "",
    keys: { ...DEFAULT_FRONTMATTER_KEYS },
    colors: { ...DEFAULT_PRIORITY_COLORS },
};

export const PRIORITY_DEFAULT = 5;

export function priorityColor(p: number, colors: PriorityColors = DEFAULT_PRIORITY_COLORS): string {
    if (p <= 2) return colors.tier1;
    if (p <= 4) return colors.tier2;
    if (p <= 6) return colors.tier3;
    if (p <= 8) return colors.tier4;
    return colors.tier5;
}

export function prioritySize(p: number): number {
    if (p <= 2) return 10;
    if (p <= 4) return 12;
    if (p <= 6) return 14;
    if (p <= 8) return 16;
    return 18;
}

export function buildLegend(colors: PriorityColors = DEFAULT_PRIORITY_COLORS) {
    return [
        { label: "1–2 Low",       color: colors.tier1 },
        { label: "3–4 Minor",     color: colors.tier2 },
        { label: "5–6 Medium",    color: colors.tier3 },
        { label: "7–8 High",      color: colors.tier4 },
        { label: "9–10 Must-see", color: colors.tier5 },
    ];
}
