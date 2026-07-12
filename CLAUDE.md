# CLAUDE.md

Anleitung für Claude Code in diesem Repo.

## Was dieses Repo ist

Obsidian-Community-Plugin **Travel Map** (`id: travel-map`, aktuell v0.4.0): visuelle Reiseplanung im Vault. Orte sind Markdown-Dateien mit `type: place` + `lat`/`lng` im Frontmatter und erscheinen als prioritätsgefärbte Pins auf einer Leaflet-Karte. Routen sind Dateien mit `type: route` und einer `locations`-Liste aus Wikilinks, gezeichnet als Polylines. Features: Trip-Auswahl per Ordner, Rechtsklick-Anlegen, draggable Pins (schreiben Koordinaten zurück), Kategorie- und Tages-Filter, Orts-Liste, Routen-Distanz, nummerierte Wegpunkte, optionales Straßen-Routing via OSRM.

Stand: kurz vor der Einreichung als offizielles Community-Plugin. Repo: `smierx/travel-map-plugin`, Release 0.4.0 mit den drei Assets (`main.js`, `manifest.json`, `styles.css`) existiert. Offen: PR an `obsidianmd/obsidian-releases` und BRAT-Test. Schritt-für-Schritt-Plan in `RELEASE.md`.

Zugehörige Vault-Doku (Roadmap, Abnahmen): `/Users/smierx/Smierx/02 Projekte/Travel Map Plugin/`.

## Commands

```bash
npm run dev          # esbuild Watch-Mode; mit OBSIDIAN_PLUGIN_DIR=<vault>/.obsidian/plugins/travel-map werden main.js/manifest.json/styles.css nach jedem Build in den Vault kopiert
npm run build        # tsc -noEmit -skipLibCheck (voller strict-Check), dann Production-Build ohne Sourcemaps
npm test             # vitest run – 95 Tests in tests/utils.test.ts
npm run test:watch   # vitest im Watch-Mode
```

Nach jedem Build in Obsidian neu laden: `Cmd+P` → "Reload app without saving".

Tests laufen in Node ohne Obsidian: `vitest.config.ts` aliast `obsidian` auf den Mock `tests/__mocks__/obsidian.ts`. Neue Obsidian-API-Nutzung in getesteten Modulen braucht ggf. eine Mock-Erweiterung.

## Architektur

Strikte Trennung: pure Logik ist testbar, die DOM-/Leaflet-Schicht nicht.

**Pure Logik (von den 95 Tests abgedeckt):**
- `src/utils.ts` – Vault-Scanning (`getVacations`, `getVacationFiles` rekursiv), Frontmatter-Parsing zu `Place`/`Route` (`getPlaces`, `getRoutes` mit Typprüfung statt blindem Cast), `buildPlaceFileContent`, `parseWikilink`, `roundCoord`, `syncFilter`, Distanz (`haversineKm`, `routeDistanceKm`, `formatDistance`), Kategorie-Icon-Serialisierung
- `src/types.ts` – Interfaces (`Place`, `Route`, `TravelMapSettings`, konfigurierbare `FrontmatterKeys`), Defaults, `priorityColor`/`prioritySize`/`categoryIcon`/`buildLegend`
- `src/routing.ts` – OSRM: `buildOsrmUrl` (lng,lat-Reihenfolge!), `decodeOsrmGeometry`, `routeSignature` (Cache-Key), `fetchRoute` via Obsidian `requestUrl`

**DOM-/Obsidian-Schicht (ungetestet, manuell verifizieren):**
- `main.ts` – Plugin-Entry: registriert View, Ribbon, Command, SettingsTab; `loadSettings` merged Defaults tief (keys/colors/categoryIcons)
- `src/MapView.ts` – die ItemView mit der ganzen Leaflet-Karte: Marker-Registry, Places/Routes-Cache, Controls (Orts-Liste, Kategorie-/Tages-/Routen-Panel, Legende), Drag-Persistenz via `processFrontMatter`
- `src/CreatePlaceModal.ts` – Rechtsklick-Dialog
- `src/SettingsTab.ts` – Settings-UI

`styles.css` gehört zu den Release-Assets, alle Klassen prefixed mit `tm-`.

## Obsidian-Guidelines (fürs Review tabu)

Diese Punkte wurden im Quality-Pass (Commit f9dd76e) bewusst so gebaut. Nicht rückgängig machen:

- **Kein `detachLeavesOfType` in `onunload`** – von den Review-Guidelines verboten. `onunload` räumt nur die eigene View auf.
- **Kein `innerHTML`**, kein `console.log` – DOM nur über `createEl`/`createDiv`/`textContent`.
- **`requestUrl` statt `fetch`** für HTTP (CORS-sicher, mobile-kompatibel).
- **`processFrontMatter`** für Frontmatter-Writes (Pin-Drag), nie Datei-Text selbst parsen.
- **Kein `setTimeout` für Layout** – Leaflet-Init läuft über `requestAnimationFrame` + `invalidateSize`.
- `manifest.json`: Name ohne "Obsidian"/"Plugin", `minAppVersion` gesetzt, `id` muss dem Registry-Eintrag entsprechen.
- `isDesktopOnly: false` – Änderungen müssen mobile-tauglich bleiben (kein Node/Electron-API).

## Konventionen

- **Marker und Routen über `file.path` keyen, nie `basename`** – gleichnamige Dateien in verschiedenen Unterordnern kollidieren sonst. `basename` nur für Labels.
- `refreshMap()` nur bei Änderungen an Dateien des **aktiven Trips** triggern (Pfad-Prefix-Check), sonst rebuildet jede Vault-Änderung die Karte inkl. OSRM-Refetch.
- TypeScript volles `strict` – Build muss ohne Fehler durch `tsc -noEmit` laufen.
- Frontmatter-Keys sind über Settings konfigurierbar (`FrontmatterKeys`), nie hart `type`/`category`/… annehmen, immer über `settings.keys` gehen.
- Neue pure Logik nach `src/utils.ts`/`src/types.ts`/`src/routing.ts` und testen; `MapView.ts` bleibt dünn auf DOM/Leaflet.
- Kommentare und Commit-Messages auf Deutsch, README/DEVELOPMENT auf Englisch.
- Versionierung: Tags **ohne** `v` (z.B. `0.4.0`), triggern `.github/workflows/release.yml`. Bei Version-Bump `manifest.json`, `package.json` und `versions.json` synchron halten.

## Gotchas

- Der Quality-Pass (f9dd76e) ist gepusht, aber das Release 0.4.0 auf GitHub enthält diese Fixes noch nicht. Vor der Community-Einreichung ggf. neues Release taggen.
- README-Links sind gefixt: Clone- und BRAT-Anleitungen zeigen jetzt auf das echte Repo `smierx/travel-map-plugin`.
- **OSRM-Demo-Server** (`router.project-osrm.org`): nur für leichte Nutzung gedacht, keine Uptime-Garantie, kann drosseln. Darum: Feature opt-in (Default aus), Response-Cache über `routeSignature`, Fallback auf Luftlinie bei jedem Fehler. Diese drei Schutzmechanismen nicht aufweichen.
- **`main.js` ist eingecheckt** (Build-Artefakt, ~430 KB). Nach Quelländerungen neu bauen, sonst divergieren Quelle und Bundle im Repo.
- Release-Weg: aktuell installierbar via BRAT oder manuell; Community-Listing kommt erst nach dem obsidian-releases-PR (Review dauert Wochen). Details in `RELEASE.md`.
- Der Copy-Step in `esbuild.config.mjs` läuft nur wenn `OBSIDIAN_PLUGIN_DIR` gesetzt ist – ohne die Env-Var landet nur `main.js` im Repo-Root.
