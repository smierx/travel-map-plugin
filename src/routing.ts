import { requestUrl } from "obsidian";

// F8: Echtes Straßen-Routing über den öffentlichen OSRM-Dienst (OpenStreetMap-Daten).
// Opt-in, da die Koordinaten den Vault verlassen. Bei Fehler nimmt der Aufrufer die Luftlinie.

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

// Baut die OSRM-URL. OSRM erwartet lng,lat-Paare, getrennt durch Semikolon.
export function buildOsrmUrl(coords: [number, number][]): string {
    const path = coords.map(([lat, lng]) => `${lng},${lat}`).join(";");
    return `${OSRM_BASE}/${path}?overview=full&geometries=geojson`;
}

// Dekodiert die GeoJSON-Geometrie (lng,lat) der ersten Route in Leaflet-Koordinaten (lat,lng).
export function decodeOsrmGeometry(json: unknown): [number, number][] {
    const routes = (json as { routes?: unknown })?.routes;
    if (!Array.isArray(routes) || routes.length === 0) return [];
    const coords = (routes[0] as { geometry?: { coordinates?: unknown } })?.geometry?.coordinates;
    if (!Array.isArray(coords)) return [];
    return coords
        .filter(
            (c): c is [number, number] =>
                Array.isArray(c) && c.length >= 2 && typeof c[0] === "number" && typeof c[1] === "number",
        )
        .map((c) => [c[1], c[0]] as [number, number]);
}

// Holt die Straßenroute. Leeres Array bei Fehler oder zu wenigen Punkten.
export async function fetchRoute(coords: [number, number][]): Promise<[number, number][]> {
    if (coords.length < 2) return [];
    try {
        const res = await requestUrl({ url: buildOsrmUrl(coords) });
        return decodeOsrmGeometry(res.json);
    } catch {
        return [];
    }
}

// Stabile Signatur einer Koordinatenfolge für den Cache.
export function routeSignature(coords: [number, number][]): string {
    return coords.map((c) => c.join(",")).join(";");
}
