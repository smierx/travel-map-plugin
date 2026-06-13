import { describe, it, expect } from "vitest";
import {
    parseWikilink,
    resolveRouteCoords,
    getPlaces,
    getRoutes,
    getVacationFiles,
    getVacations,
} from "../src/utils";
import { prioritaetFarbe, prioritaetGroesse } from "../src/types";
import { makeFile, makeFolder, makeApp } from "./helpers";
import type { App } from "obsidian";

// ── prioritaetFarbe / prioritaetGroesse ───────────────────────────────────────

describe("prioritaetFarbe", () => {
    it("gibt grau für 1–2 zurück", () => {
        expect(prioritaetFarbe(1)).toBe("#95a5a6");
        expect(prioritaetFarbe(2)).toBe("#95a5a6");
    });
    it("gibt blau für 3–4 zurück", () => {
        expect(prioritaetFarbe(3)).toBe("#3498db");
        expect(prioritaetFarbe(4)).toBe("#3498db");
    });
    it("gibt grün für 5–6 zurück", () => {
        expect(prioritaetFarbe(5)).toBe("#2ecc71");
        expect(prioritaetFarbe(6)).toBe("#2ecc71");
    });
    it("gibt orange für 7–8 zurück", () => {
        expect(prioritaetFarbe(7)).toBe("#f39c12");
        expect(prioritaetFarbe(8)).toBe("#f39c12");
    });
    it("gibt rot für 9–10 zurück", () => {
        expect(prioritaetFarbe(9)).toBe("#e74c3c");
        expect(prioritaetFarbe(10)).toBe("#e74c3c");
    });
});

describe("prioritaetGroesse", () => {
    it("wächst mit der Priorität", () => {
        const sizes = [1, 3, 5, 7, 9].map(prioritaetGroesse);
        for (let i = 0; i < sizes.length - 1; i++) {
            expect(sizes[i]).toBeLessThan(sizes[i + 1]);
        }
    });
    it("gibt 18 für Priorität 10 zurück", () => {
        expect(prioritaetGroesse(10)).toBe(18);
    });
});

// ── parseWikilink ─────────────────────────────────────────────────────────────

describe("parseWikilink", () => {
    it("parst einfachen Wikilink", () => {
        expect(parseWikilink("[[Split]]")).toBe("Split");
    });

    it("parst Wikilink mit Alias", () => {
        expect(parseWikilink("[[Split|Altstadt von Split]]")).toBe("Split");
    });

    it("trimmt Leerzeichen im Namen", () => {
        expect(parseWikilink("[[  Split  ]]")).toBe("Split");
    });

    it("gibt leeren String für leeren Link zurück", () => {
        expect(parseWikilink("[[]]")).toBe("");
    });
});

// ── resolveRouteCoords ────────────────────────────────────────────────────────

describe("resolveRouteCoords", () => {
    it("löst Wikilinks zu Koordinaten auf", () => {
        const split = makeFile("Reisen/Kroatien/Split.md");
        const dubrovnik = makeFile("Reisen/Kroatien/Dubrovnik.md");
        const places = [
            { file: split, lat: 43.5081, lng: 16.4402, priorität: 5 },
            { file: dubrovnik, lat: 42.6507, lng: 18.0944, priorität: 5 },
        ];

        const coords = resolveRouteCoords(places, ["[[Split]]", "[[Dubrovnik]]"]);
        expect(coords).toEqual([[43.5081, 16.4402], [42.6507, 18.0944]]);
    });

    it("überspringt nicht auflösbare Wikilinks", () => {
        const split = makeFile("Reisen/Kroatien/Split.md");
        const places = [{ file: split, lat: 43.5, lng: 16.4, priorität: 5 }];

        const coords = resolveRouteCoords(places, ["[[Split]]", "[[NichtExistent]]"]);
        expect(coords).toEqual([[43.5, 16.4]]);
    });

    it("löst Wikilinks mit Alias korrekt auf", () => {
        const split = makeFile("Reisen/Kroatien/Split.md");
        const places = [{ file: split, lat: 43.5, lng: 16.4, priorität: 5 }];

        const coords = resolveRouteCoords(places, ["[[Split|Altstadt]]"]);
        expect(coords).toEqual([[43.5, 16.4]]);
    });

    it("gibt leeres Array bei leerer Wikilink-Liste zurück", () => {
        expect(resolveRouteCoords([], [])).toEqual([]);
    });

    it("gibt leeres Array wenn keine Places vorhanden", () => {
        const coords = resolveRouteCoords([], ["[[Split]]"]);
        expect(coords).toEqual([]);
    });
});

// ── getPlaces ─────────────────────────────────────────────────────────────────

describe("getPlaces", () => {
    it("gibt Place zurück wenn typ=ort und Koordinaten vorhanden", () => {
        const file = makeFile("Reisen/Kroatien/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { typ: "ort", lat: 43.5081, lng: 16.4402, kategorie: "stadt" }]]),
        }) as App;

        const places = getPlaces(app, [file]);
        expect(places).toHaveLength(1);
        expect(places[0].lat).toBe(43.5081);
        expect(places[0].lng).toBe(16.4402);
        expect(places[0].kategorie).toBe("stadt");
        expect(places[0].file).toBe(file);
    });

    it("schließt Dateien ohne typ=ort aus", () => {
        const file = makeFile("Reisen/Kroatien/Route.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { typ: "route", farbe: "#f00" }]]),
        }) as App;

        expect(getPlaces(app, [file])).toHaveLength(0);
    });

    it("schließt Dateien ohne Koordinaten aus", () => {
        const file = makeFile("Reisen/Kroatien/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { typ: "ort" }]]),
        }) as App;

        expect(getPlaces(app, [file])).toHaveLength(0);
    });

    it("schließt Dateien mit String-Koordinaten aus", () => {
        const file = makeFile("Reisen/Kroatien/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { typ: "ort", lat: "43.5", lng: "16.4" }]]),
        }) as App;

        expect(getPlaces(app, [file])).toHaveLength(0);
    });

    it("schließt Dateien ohne Frontmatter aus", () => {
        const file = makeFile("Reisen/Kroatien/Notiz.md");
        const app = makeApp({ frontmatters: new Map() }) as App;

        expect(getPlaces(app, [file])).toHaveLength(0);
    });

    it("gibt mehrere Places zurück", () => {
        const split = makeFile("Reisen/Kroatien/Split.md");
        const dubrovnik = makeFile("Reisen/Kroatien/Dubrovnik.md");
        const app = makeApp({
            frontmatters: new Map([
                [split.path, { typ: "ort", lat: 43.5, lng: 16.4 }],
                [dubrovnik.path, { typ: "ort", lat: 42.6, lng: 18.1 }],
            ]),
        }) as App;

        expect(getPlaces(app, [split, dubrovnik])).toHaveLength(2);
    });

    it("setzt kategorie auf undefined wenn nicht angegeben", () => {
        const file = makeFile("Reisen/Kroatien/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { typ: "ort", lat: 43.5, lng: 16.4 }]]),
        }) as App;

        const places = getPlaces(app, [file]);
        expect(places[0].kategorie).toBeUndefined();
    });

    it("setzt priorität auf 5 wenn nicht angegeben", () => {
        const file = makeFile("Reisen/Kroatien/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { typ: "ort", lat: 43.5, lng: 16.4 }]]),
        }) as App;

        expect(getPlaces(app, [file])[0].priorität).toBe(5);
    });

    it("liest priorität korrekt aus", () => {
        const file = makeFile("Reisen/Kroatien/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { typ: "ort", lat: 43.5, lng: 16.4, priorität: 9 }]]),
        }) as App;

        expect(getPlaces(app, [file])[0].priorität).toBe(9);
    });

    it("klemmt priorität auf Minimum 1", () => {
        const file = makeFile("Reisen/Kroatien/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { typ: "ort", lat: 43.5, lng: 16.4, priorität: -5 }]]),
        }) as App;

        expect(getPlaces(app, [file])[0].priorität).toBe(1);
    });

    it("klemmt priorität auf Maximum 10", () => {
        const file = makeFile("Reisen/Kroatien/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { typ: "ort", lat: 43.5, lng: 16.4, priorität: 99 }]]),
        }) as App;

        expect(getPlaces(app, [file])[0].priorität).toBe(10);
    });

    it("rundet Dezimal-priorität", () => {
        const file = makeFile("Reisen/Kroatien/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { typ: "ort", lat: 43.5, lng: 16.4, priorität: 7.6 }]]),
        }) as App;

        expect(getPlaces(app, [file])[0].priorität).toBe(8);
    });

    it("ignoriert String-priorität und nutzt Default", () => {
        const file = makeFile("Reisen/Kroatien/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { typ: "ort", lat: 43.5, lng: 16.4, priorität: "hoch" }]]),
        }) as App;

        expect(getPlaces(app, [file])[0].priorität).toBe(5);
    });
});

// ── getRoutes ─────────────────────────────────────────────────────────────────

describe("getRoutes", () => {
    it("gibt Route zurück wenn typ=route", () => {
        const file = makeFile("Reisen/Kroatien/Route Küste.md");
        const app = makeApp({
            frontmatters: new Map([[
                file.path,
                { typ: "route", farbe: "#e74c3c", orte: ["[[Split]]", "[[Dubrovnik]]"] },
            ]]),
        }) as App;

        const routes = getRoutes(app, [file]);
        expect(routes).toHaveLength(1);
        expect(routes[0].farbe).toBe("#e74c3c");
        expect(routes[0].orte).toEqual(["[[Split]]", "[[Dubrovnik]]"]);
        expect(routes[0].file).toBe(file);
    });

    it("verwendet Standardfarbe wenn farbe fehlt", () => {
        const file = makeFile("Reisen/Kroatien/Route.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { typ: "route", orte: [] }]]),
        }) as App;

        const routes = getRoutes(app, [file]);
        expect(routes[0].farbe).toBe("#3388ff");
    });

    it("gibt leere orte-Liste zurück wenn orte fehlt", () => {
        const file = makeFile("Reisen/Kroatien/Route.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { typ: "route" }]]),
        }) as App;

        const routes = getRoutes(app, [file]);
        expect(routes[0].orte).toEqual([]);
    });

    it("schließt Dateien ohne typ=route aus", () => {
        const file = makeFile("Reisen/Kroatien/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { typ: "ort", lat: 43.5, lng: 16.4 }]]),
        }) as App;

        expect(getRoutes(app, [file])).toHaveLength(0);
    });
});

// ── getVacationFiles ──────────────────────────────────────────────────────────

describe("getVacationFiles", () => {
    it("gibt alle Markdown-Dateien im Ordner zurück", () => {
        const split = makeFile("Reisen/Kroatien/Split.md");
        const dubrovnik = makeFile("Reisen/Kroatien/Dubrovnik.md");
        const folder = makeFolder("Reisen/Kroatien", [split, dubrovnik]);
        const app = makeApp({ files: new Map([["Reisen/Kroatien", folder]]) }) as App;

        const files = getVacationFiles(app, "Reisen/Kroatien");
        expect(files).toHaveLength(2);
    });

    it("findet Dateien in Unterordnern rekursiv", () => {
        const hvar = makeFile("Reisen/Kroatien/Inseln/Hvar.md");
        const subfolder = makeFolder("Reisen/Kroatien/Inseln", [hvar]);
        const split = makeFile("Reisen/Kroatien/Split.md");
        const folder = makeFolder("Reisen/Kroatien", [split, subfolder]);
        const app = makeApp({ files: new Map([["Reisen/Kroatien", folder]]) }) as App;

        const files = getVacationFiles(app, "Reisen/Kroatien");
        expect(files).toHaveLength(2);
        expect(files.map(f => f.basename)).toContain("Split");
        expect(files.map(f => f.basename)).toContain("Hvar");
    });

    it("schließt Nicht-Markdown-Dateien aus", () => {
        const md = makeFile("Reisen/Kroatien/Split.md");
        const img = makeFile("Reisen/Kroatien/foto.jpg");
        img.extension = "jpg";
        const folder = makeFolder("Reisen/Kroatien", [md, img]);
        const app = makeApp({ files: new Map([["Reisen/Kroatien", folder]]) }) as App;

        const files = getVacationFiles(app, "Reisen/Kroatien");
        expect(files).toHaveLength(1);
        expect(files[0].basename).toBe("Split");
    });

    it("gibt leeres Array bei nicht vorhandenem Pfad zurück", () => {
        const app = makeApp({ files: new Map() }) as App;
        expect(getVacationFiles(app, "Reisen/NichtExistent")).toHaveLength(0);
    });

    it("gibt leeres Array für leeren Ordner zurück", () => {
        const folder = makeFolder("Reisen/Kroatien", []);
        const app = makeApp({ files: new Map([["Reisen/Kroatien", folder]]) }) as App;

        expect(getVacationFiles(app, "Reisen/Kroatien")).toHaveLength(0);
    });
});

// ── getVacations ──────────────────────────────────────────────────────────────

describe("getVacations", () => {
    it("gibt direkte Unterordner als Urlaube zurück", () => {
        const kroatien = makeFolder("Reisen/Kroatien");
        const portugal = makeFolder("Reisen/Portugal");
        const root = makeFolder("Reisen", [kroatien, portugal]);
        const app = makeApp({ files: new Map([["Reisen", root]]) }) as App;

        const vacations = getVacations(app, "Reisen");
        expect(vacations).toHaveLength(2);
        expect(vacations.map(v => v.name)).toContain("Kroatien");
        expect(vacations.map(v => v.name)).toContain("Portugal");
    });

    it("schließt Dateien im Root-Ordner aus", () => {
        const readme = makeFile("Reisen/README.md");
        const kroatien = makeFolder("Reisen/Kroatien");
        const root = makeFolder("Reisen", [readme, kroatien]);
        const app = makeApp({ files: new Map([["Reisen", root]]) }) as App;

        const vacations = getVacations(app, "Reisen");
        expect(vacations).toHaveLength(1);
        expect(vacations[0].name).toBe("Kroatien");
    });

    it("sortiert Urlaube alphabetisch", () => {
        const z = makeFolder("Reisen/Zypern");
        const a = makeFolder("Reisen/Albanien");
        const m = makeFolder("Reisen/Montenegro");
        const root = makeFolder("Reisen", [z, a, m]);
        const app = makeApp({ files: new Map([["Reisen", root]]) }) as App;

        const vacations = getVacations(app, "Reisen");
        expect(vacations.map(v => v.name)).toEqual(["Albanien", "Montenegro", "Zypern"]);
    });

    it("gibt leeres Array zurück wenn Root-Ordner nicht existiert", () => {
        const app = makeApp({ files: new Map() }) as App;
        expect(getVacations(app, "NichtExistent")).toHaveLength(0);
    });

    it("gibt leeres Array zurück für leeren Root-Ordner", () => {
        const root = makeFolder("Reisen", []);
        const app = makeApp({ files: new Map([["Reisen", root]]) }) as App;

        expect(getVacations(app, "Reisen")).toHaveLength(0);
    });
});
