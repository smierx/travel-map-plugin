import { TFile } from "obsidian";

export interface Place {
    file: TFile;
    lat: number;
    lng: number;
    kategorie?: string;
    priorität: number;
}

export interface Route {
    file: TFile;
    farbe: string;
    orte: string[];
}

export interface TravelMapSettings {
    rootFolder: string;
    activeVacation: string;
}

export const DEFAULT_SETTINGS: TravelMapSettings = {
    rootFolder: "Reisen",
    activeVacation: "",
};

export const PRIORITAET_DEFAULT = 5;

// Farbe und Größe des Pins basieren auf der Priorität (1–10)
export function prioritaetFarbe(p: number): string {
    if (p <= 2) return "#95a5a6"; // grau   – niedrig
    if (p <= 4) return "#3498db"; // blau   – gering
    if (p <= 6) return "#2ecc71"; // grün   – mittel
    if (p <= 8) return "#f39c12"; // orange – hoch
    return "#e74c3c";             // rot    – must-see
}

export function prioritaetGroesse(p: number): number {
    if (p <= 2) return 10;
    if (p <= 4) return 12;
    if (p <= 6) return 14;
    if (p <= 8) return 16;
    return 18;
}

export const PRIORITAET_LEGENDE = [
    { label: "1–2 Niedrig",  farbe: "#95a5a6" },
    { label: "3–4 Gering",   farbe: "#3498db" },
    { label: "5–6 Mittel",   farbe: "#2ecc71" },
    { label: "7–8 Hoch",     farbe: "#f39c12" },
    { label: "9–10 Must-see", farbe: "#e74c3c" },
];
