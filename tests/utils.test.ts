import { describe, it, expect } from "vitest";
import {
    parseWikilink,
    resolveRouteCoords,
    getPlaces,
    getRoutes,
    getVacationFiles,
    getVacations,
    roundCoord,
    getCategories,
    buildPlaceFileContent,
    parseCategoryIcons,
    serializeCategoryIcons,
    haversineKm,
    routeDistanceKm,
    formatDistance,
    sortPlacesByPriority,
} from "../src/utils";
import { priorityColor, prioritySize, categoryIcon, DEFAULT_FRONTMATTER_KEYS } from "../src/types";
import type { Place } from "../src/types";
import { makeFile, makeFolder, makeApp } from "./helpers";
import type { App } from "obsidian";

// ── priorityColor / prioritySize ───────────────────────────────────────────────

describe("priorityColor", () => {
    it("returns grey for 1–2", () => {
        expect(priorityColor(1)).toBe("#95a5a6");
        expect(priorityColor(2)).toBe("#95a5a6");
    });
    it("returns blue for 3–4", () => {
        expect(priorityColor(3)).toBe("#3498db");
        expect(priorityColor(4)).toBe("#3498db");
    });
    it("returns green for 5–6", () => {
        expect(priorityColor(5)).toBe("#2ecc71");
        expect(priorityColor(6)).toBe("#2ecc71");
    });
    it("returns orange for 7–8", () => {
        expect(priorityColor(7)).toBe("#f39c12");
        expect(priorityColor(8)).toBe("#f39c12");
    });
    it("returns red for 9–10", () => {
        expect(priorityColor(9)).toBe("#e74c3c");
        expect(priorityColor(10)).toBe("#e74c3c");
    });
});

describe("prioritySize", () => {
    it("grows with priority", () => {
        const sizes = [1, 3, 5, 7, 9].map(prioritySize);
        for (let i = 0; i < sizes.length - 1; i++) {
            expect(sizes[i]).toBeLessThan(sizes[i + 1]);
        }
    });
    it("returns 18 for priority 10", () => {
        expect(prioritySize(10)).toBe(18);
    });
});

// ── parseWikilink ─────────────────────────────────────────────────────────────

describe("parseWikilink", () => {
    it("parses a simple wikilink", () => {
        expect(parseWikilink("[[Split]]")).toBe("Split");
    });

    it("parses a wikilink with alias", () => {
        expect(parseWikilink("[[Split|Old Town of Split]]")).toBe("Split");
    });

    it("trims whitespace in the name", () => {
        expect(parseWikilink("[[  Split  ]]")).toBe("Split");
    });

    it("returns empty string for empty link", () => {
        expect(parseWikilink("[[]]")).toBe("");
    });
});

// ── resolveRouteCoords ────────────────────────────────────────────────────────

describe("resolveRouteCoords", () => {
    it("resolves wikilinks to coordinates", () => {
        const split = makeFile("Trips/Croatia/Split.md");
        const dubrovnik = makeFile("Trips/Croatia/Dubrovnik.md");
        const places = [
            { file: split, lat: 43.5081, lng: 16.4402, priority: 5 },
            { file: dubrovnik, lat: 42.6507, lng: 18.0944, priority: 5 },
        ];

        const coords = resolveRouteCoords(places, ["[[Split]]", "[[Dubrovnik]]"]);
        expect(coords).toEqual([[43.5081, 16.4402], [42.6507, 18.0944]]);
    });

    it("skips unresolvable wikilinks", () => {
        const split = makeFile("Trips/Croatia/Split.md");
        const places = [{ file: split, lat: 43.5, lng: 16.4, priority: 5 }];

        const coords = resolveRouteCoords(places, ["[[Split]]", "[[DoesNotExist]]"]);
        expect(coords).toEqual([[43.5, 16.4]]);
    });

    it("resolves wikilinks with alias correctly", () => {
        const split = makeFile("Trips/Croatia/Split.md");
        const places = [{ file: split, lat: 43.5, lng: 16.4, priority: 5 }];

        const coords = resolveRouteCoords(places, ["[[Split|Old Town]]"]);
        expect(coords).toEqual([[43.5, 16.4]]);
    });

    it("returns empty array for empty wikilink list", () => {
        expect(resolveRouteCoords([], [])).toEqual([]);
    });

    it("returns empty array when no places available", () => {
        const coords = resolveRouteCoords([], ["[[Split]]"]);
        expect(coords).toEqual([]);
    });
});

// ── getPlaces ─────────────────────────────────────────────────────────────────

describe("getPlaces", () => {
    it("returns a Place when type=place and coordinates are present", () => {
        const file = makeFile("Trips/Croatia/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { type: "place", lat: 43.5081, lng: 16.4402, category: "city" }]]),
        }) as App;

        const places = getPlaces(app, [file]);
        expect(places).toHaveLength(1);
        expect(places[0].lat).toBe(43.5081);
        expect(places[0].lng).toBe(16.4402);
        expect(places[0].category).toBe("city");
        expect(places[0].file).toBe(file);
    });

    it("excludes files without type=place", () => {
        const file = makeFile("Trips/Croatia/Route.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { type: "route", color: "#f00" }]]),
        }) as App;

        expect(getPlaces(app, [file])).toHaveLength(0);
    });

    it("excludes files without coordinates", () => {
        const file = makeFile("Trips/Croatia/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { type: "place" }]]),
        }) as App;

        expect(getPlaces(app, [file])).toHaveLength(0);
    });

    it("excludes files with string coordinates", () => {
        const file = makeFile("Trips/Croatia/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { type: "place", lat: "43.5", lng: "16.4" }]]),
        }) as App;

        expect(getPlaces(app, [file])).toHaveLength(0);
    });

    it("excludes files without frontmatter", () => {
        const file = makeFile("Trips/Croatia/Note.md");
        const app = makeApp({ frontmatters: new Map() }) as App;

        expect(getPlaces(app, [file])).toHaveLength(0);
    });

    it("returns multiple places", () => {
        const split = makeFile("Trips/Croatia/Split.md");
        const dubrovnik = makeFile("Trips/Croatia/Dubrovnik.md");
        const app = makeApp({
            frontmatters: new Map([
                [split.path, { type: "place", lat: 43.5, lng: 16.4 }],
                [dubrovnik.path, { type: "place", lat: 42.6, lng: 18.1 }],
            ]),
        }) as App;

        expect(getPlaces(app, [split, dubrovnik])).toHaveLength(2);
    });

    it("sets category to undefined when not provided", () => {
        const file = makeFile("Trips/Croatia/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { type: "place", lat: 43.5, lng: 16.4 }]]),
        }) as App;

        const places = getPlaces(app, [file]);
        expect(places[0].category).toBeUndefined();
    });

    it("defaults priority to 5 when not provided", () => {
        const file = makeFile("Trips/Croatia/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { type: "place", lat: 43.5, lng: 16.4 }]]),
        }) as App;

        expect(getPlaces(app, [file])[0].priority).toBe(5);
    });

    it("reads priority correctly", () => {
        const file = makeFile("Trips/Croatia/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { type: "place", lat: 43.5, lng: 16.4, priority: 9 }]]),
        }) as App;

        expect(getPlaces(app, [file])[0].priority).toBe(9);
    });

    it("clamps priority to minimum 1", () => {
        const file = makeFile("Trips/Croatia/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { type: "place", lat: 43.5, lng: 16.4, priority: -5 }]]),
        }) as App;

        expect(getPlaces(app, [file])[0].priority).toBe(1);
    });

    it("clamps priority to maximum 10", () => {
        const file = makeFile("Trips/Croatia/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { type: "place", lat: 43.5, lng: 16.4, priority: 99 }]]),
        }) as App;

        expect(getPlaces(app, [file])[0].priority).toBe(10);
    });

    it("rounds decimal priority", () => {
        const file = makeFile("Trips/Croatia/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { type: "place", lat: 43.5, lng: 16.4, priority: 7.6 }]]),
        }) as App;

        expect(getPlaces(app, [file])[0].priority).toBe(8);
    });

    it("ignores string priority and uses default", () => {
        const file = makeFile("Trips/Croatia/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { type: "place", lat: 43.5, lng: 16.4, priority: "high" }]]),
        }) as App;

        expect(getPlaces(app, [file])[0].priority).toBe(5);
    });
});

// ── getRoutes ─────────────────────────────────────────────────────────────────

describe("getRoutes", () => {
    it("returns a Route when type=route", () => {
        const file = makeFile("Trips/Croatia/Coastal Route.md");
        const app = makeApp({
            frontmatters: new Map([[
                file.path,
                { type: "route", color: "#e74c3c", locations: ["[[Split]]", "[[Dubrovnik]]"] },
            ]]),
        }) as App;

        const routes = getRoutes(app, [file]);
        expect(routes).toHaveLength(1);
        expect(routes[0].color).toBe("#e74c3c");
        expect(routes[0].locations).toEqual(["[[Split]]", "[[Dubrovnik]]"]);
        expect(routes[0].file).toBe(file);
    });

    it("uses default color when color is missing", () => {
        const file = makeFile("Trips/Croatia/Route.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { type: "route", locations: [] }]]),
        }) as App;

        const routes = getRoutes(app, [file]);
        expect(routes[0].color).toBe("#3388ff");
    });

    it("returns empty locations list when locations is missing", () => {
        const file = makeFile("Trips/Croatia/Route.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { type: "route" }]]),
        }) as App;

        const routes = getRoutes(app, [file]);
        expect(routes[0].locations).toEqual([]);
    });

    it("excludes files without type=route", () => {
        const file = makeFile("Trips/Croatia/Split.md");
        const app = makeApp({
            frontmatters: new Map([[file.path, { type: "place", lat: 43.5, lng: 16.4 }]]),
        }) as App;

        expect(getRoutes(app, [file])).toHaveLength(0);
    });
});

// ── getVacationFiles ──────────────────────────────────────────────────────────

describe("getVacationFiles", () => {
    it("returns all markdown files in a folder", () => {
        const split = makeFile("Trips/Croatia/Split.md");
        const dubrovnik = makeFile("Trips/Croatia/Dubrovnik.md");
        const folder = makeFolder("Trips/Croatia", [split, dubrovnik]);
        const app = makeApp({ files: new Map([["Trips/Croatia", folder]]) }) as App;

        const files = getVacationFiles(app, "Trips/Croatia");
        expect(files).toHaveLength(2);
    });

    it("finds files in subfolders recursively", () => {
        const hvar = makeFile("Trips/Croatia/Islands/Hvar.md");
        const subfolder = makeFolder("Trips/Croatia/Islands", [hvar]);
        const split = makeFile("Trips/Croatia/Split.md");
        const folder = makeFolder("Trips/Croatia", [split, subfolder]);
        const app = makeApp({ files: new Map([["Trips/Croatia", folder]]) }) as App;

        const files = getVacationFiles(app, "Trips/Croatia");
        expect(files).toHaveLength(2);
        expect(files.map(f => f.basename)).toContain("Split");
        expect(files.map(f => f.basename)).toContain("Hvar");
    });

    it("excludes non-markdown files", () => {
        const md = makeFile("Trips/Croatia/Split.md");
        const img = makeFile("Trips/Croatia/photo.jpg");
        img.extension = "jpg";
        const folder = makeFolder("Trips/Croatia", [md, img]);
        const app = makeApp({ files: new Map([["Trips/Croatia", folder]]) }) as App;

        const files = getVacationFiles(app, "Trips/Croatia");
        expect(files).toHaveLength(1);
        expect(files[0].basename).toBe("Split");
    });

    it("returns empty array for non-existent path", () => {
        const app = makeApp({ files: new Map() }) as App;
        expect(getVacationFiles(app, "Trips/DoesNotExist")).toHaveLength(0);
    });

    it("returns empty array for empty folder", () => {
        const folder = makeFolder("Trips/Croatia", []);
        const app = makeApp({ files: new Map([["Trips/Croatia", folder]]) }) as App;

        expect(getVacationFiles(app, "Trips/Croatia")).toHaveLength(0);
    });
});

// ── getVacations ──────────────────────────────────────────────────────────────

describe("getVacations", () => {
    it("returns direct subfolders as trips", () => {
        const croatia = makeFolder("Trips/Croatia");
        const portugal = makeFolder("Trips/Portugal");
        const root = makeFolder("Trips", [croatia, portugal]);
        const app = makeApp({ files: new Map([["Trips", root]]) }) as App;

        const vacations = getVacations(app, "Trips");
        expect(vacations).toHaveLength(2);
        expect(vacations.map(v => v.name)).toContain("Croatia");
        expect(vacations.map(v => v.name)).toContain("Portugal");
    });

    it("excludes files in the root folder", () => {
        const readme = makeFile("Trips/README.md");
        const croatia = makeFolder("Trips/Croatia");
        const root = makeFolder("Trips", [readme, croatia]);
        const app = makeApp({ files: new Map([["Trips", root]]) }) as App;

        const vacations = getVacations(app, "Trips");
        expect(vacations).toHaveLength(1);
        expect(vacations[0].name).toBe("Croatia");
    });

    it("sorts trips alphabetically", () => {
        const z = makeFolder("Trips/Cyprus");
        const a = makeFolder("Trips/Albania");
        const m = makeFolder("Trips/Montenegro");
        const root = makeFolder("Trips", [z, a, m]);
        const app = makeApp({ files: new Map([["Trips", root]]) }) as App;

        const vacations = getVacations(app, "Trips");
        expect(vacations.map(v => v.name)).toEqual(["Albania", "Cyprus", "Montenegro"]);
    });

    it("returns empty array when root folder does not exist", () => {
        const app = makeApp({ files: new Map() }) as App;
        expect(getVacations(app, "DoesNotExist")).toHaveLength(0);
    });

    it("returns empty array for empty root folder", () => {
        const root = makeFolder("Trips", []);
        const app = makeApp({ files: new Map([["Trips", root]]) }) as App;

        expect(getVacations(app, "Trips")).toHaveLength(0);
    });
});

// ── roundCoord ────────────────────────────────────────────────────────────────

describe("roundCoord", () => {
    it("rounds to 6 decimal places", () => {
        expect(roundCoord(43.50812345)).toBe(43.508123);
        expect(roundCoord(16.4402)).toBe(16.4402);
    });

    it("handles negative coordinates", () => {
        expect(roundCoord(-8.6109876)).toBe(-8.610988);
    });

    it("leaves whole numbers unchanged", () => {
        expect(roundCoord(45)).toBe(45);
    });
});

// ── getCategories ─────────────────────────────────────────────────────────────

describe("getCategories", () => {
    const mk = (category?: string): Place => ({
        file: makeFile(`Trips/Croatia/${category ?? "x"}.md`),
        lat: 0,
        lng: 0,
        category,
        priority: 5,
    });

    it("returns distinct categories sorted alphabetically", () => {
        const places = [mk("restaurant"), mk("city"), mk("restaurant"), mk("activity")];
        expect(getCategories(places)).toEqual(["activity", "city", "restaurant"]);
    });

    it("ignores places without a category", () => {
        const places = [mk("city"), mk(undefined), mk("city")];
        expect(getCategories(places)).toEqual(["city"]);
    });

    it("returns empty array when no categories present", () => {
        expect(getCategories([mk(undefined), mk(undefined)])).toEqual([]);
    });

    it("returns empty array for no places", () => {
        expect(getCategories([])).toEqual([]);
    });
});

// ── buildPlaceFileContent ─────────────────────────────────────────────────────

describe("buildPlaceFileContent", () => {
    const keys = DEFAULT_FRONTMATTER_KEYS;

    it("builds minimal frontmatter with default keys", () => {
        const content = buildPlaceFileContent(keys, 43.5081, 16.4402);
        expect(content).toBe(
            "---\ntype: place\nlat: 43.5081\nlng: 16.4402\n---\n",
        );
    });

    it("includes category and priority when provided", () => {
        const content = buildPlaceFileContent(keys, 43.5, 16.4, { category: "city", priority: 9 });
        expect(content).toContain("category: city");
        expect(content).toContain("priority: 9");
    });

    it("omits category and priority when not provided", () => {
        const content = buildPlaceFileContent(keys, 43.5, 16.4);
        expect(content).not.toContain("category:");
        expect(content).not.toContain("priority:");
    });

    it("rounds coordinates to 6 decimals", () => {
        const content = buildPlaceFileContent(keys, 43.50812345, 16.44021111);
        expect(content).toContain("lat: 43.508123");
        expect(content).toContain("lng: 16.440211");
    });

    it("clamps priority into 1–10", () => {
        expect(buildPlaceFileContent(keys, 0, 0, { priority: 99 })).toContain("priority: 10");
        expect(buildPlaceFileContent(keys, 0, 0, { priority: -3 })).toContain("priority: 1");
    });

    it("respects custom frontmatter keys", () => {
        const custom = { ...keys, typeField: "typ", placeValue: "ort", categoryField: "kategorie" };
        const content = buildPlaceFileContent(custom, 43.5, 16.4, { category: "stadt" });
        expect(content).toContain("typ: ort");
        expect(content).toContain("kategorie: stadt");
    });
});

// ── categoryIcon ──────────────────────────────────────────────────────────────

describe("categoryIcon", () => {
    const icons = { city: "🏙️", restaurant: "🍴" };

    it("returns the icon for a known category", () => {
        expect(categoryIcon("city", icons)).toBe("🏙️");
    });

    it("matches case-insensitively", () => {
        expect(categoryIcon("City", icons)).toBe("🏙️");
        expect(categoryIcon("RESTAURANT", icons)).toBe("🍴");
    });

    it("returns empty string for unknown category", () => {
        expect(categoryIcon("spaceport", icons)).toBe("");
    });

    it("returns empty string for undefined category", () => {
        expect(categoryIcon(undefined, icons)).toBe("");
    });
});

// ── parseCategoryIcons / serializeCategoryIcons ───────────────────────────────

describe("parseCategoryIcons", () => {
    it("parses category: emoji lines", () => {
        expect(parseCategoryIcons("city: 🏙️\nrestaurant: 🍴")).toEqual({
            city: "🏙️",
            restaurant: "🍴",
        });
    });

    it("lowercases keys and trims whitespace", () => {
        expect(parseCategoryIcons("  City :  🏙️ ")).toEqual({ city: "🏙️" });
    });

    it("ignores empty lines and lines without a colon", () => {
        expect(parseCategoryIcons("city: 🏙️\n\nnonsense\nrestaurant: 🍴")).toEqual({
            city: "🏙️",
            restaurant: "🍴",
        });
    });

    it("ignores entries with empty key or icon", () => {
        expect(parseCategoryIcons(": 🏙️\ncity: ")).toEqual({});
    });

    it("returns empty object for empty input", () => {
        expect(parseCategoryIcons("")).toEqual({});
    });
});

describe("serializeCategoryIcons", () => {
    it("serializes to sorted category: emoji lines", () => {
        expect(serializeCategoryIcons({ restaurant: "🍴", city: "🏙️" })).toBe(
            "city: 🏙️\nrestaurant: 🍴",
        );
    });

    it("round-trips with parseCategoryIcons", () => {
        const map = { city: "🏙️", restaurant: "🍴", bar: "🍸" };
        expect(parseCategoryIcons(serializeCategoryIcons(map))).toEqual(map);
    });

    it("returns empty string for empty map", () => {
        expect(serializeCategoryIcons({})).toBe("");
    });
});

// ── haversineKm / routeDistanceKm ─────────────────────────────────────────────

describe("haversineKm", () => {
    it("returns 0 for identical points", () => {
        expect(haversineKm([43.5, 16.4], [43.5, 16.4])).toBe(0);
    });

    it("computes a known distance (Split → Dubrovnik ≈ 157 km)", () => {
        const d = haversineKm([43.5081, 16.4402], [42.6507, 18.0944]);
        expect(d).toBeGreaterThan(150);
        expect(d).toBeLessThan(165);
    });

    it("is symmetric", () => {
        const a: [number, number] = [43.5, 16.4];
        const b: [number, number] = [42.6, 18.1];
        expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
    });
});

describe("routeDistanceKm", () => {
    it("sums the legs of a multi-point route", () => {
        const coords: [number, number][] = [
            [43.5081, 16.4402],
            [43.1729, 16.4412],
            [42.6507, 18.0944],
        ];
        const total = routeDistanceKm(coords);
        const expected =
            haversineKm(coords[0], coords[1]) + haversineKm(coords[1], coords[2]);
        expect(total).toBeCloseTo(expected, 9);
    });

    it("returns 0 for fewer than two points", () => {
        expect(routeDistanceKm([])).toBe(0);
        expect(routeDistanceKm([[43.5, 16.4]])).toBe(0);
    });
});

// ── formatDistance ────────────────────────────────────────────────────────────

describe("formatDistance", () => {
    it("uses one decimal below 10 km", () => {
        expect(formatDistance(3.456)).toBe("3.5 km");
    });

    it("rounds to whole km at 10 km and above", () => {
        expect(formatDistance(142.3)).toBe("142 km");
        expect(formatDistance(10)).toBe("10 km");
    });
});

// ── sortPlacesByPriority ──────────────────────────────────────────────────────

describe("sortPlacesByPriority", () => {
    const mk = (name: string, priority: number): Place => ({
        file: makeFile(`Trips/Croatia/${name}.md`),
        lat: 0,
        lng: 0,
        priority,
    });

    it("sorts by priority descending", () => {
        const sorted = sortPlacesByPriority([mk("a", 3), mk("b", 9), mk("c", 5)]);
        expect(sorted.map(p => p.priority)).toEqual([9, 5, 3]);
    });

    it("breaks ties alphabetically by basename", () => {
        const sorted = sortPlacesByPriority([mk("Zadar", 5), mk("Dubrovnik", 5), mk("Split", 5)]);
        expect(sorted.map(p => p.file.basename)).toEqual(["Dubrovnik", "Split", "Zadar"]);
    });

    it("does not mutate the input array", () => {
        const input = [mk("a", 1), mk("b", 9)];
        sortPlacesByPriority(input);
        expect(input.map(p => p.priority)).toEqual([1, 9]);
    });
});
