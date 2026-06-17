# Travel Map Plugin – Developer Docs

Obsidian plugin for visual trip planning. Built with TypeScript, esbuild, Obsidian Plugin API, and Leaflet.js.

---

## Quick start

```bash
git clone https://github.com/smierx/obsidian-travel-map
cd obsidian-travel-map
npm install
```

### Dev build (watch mode)

Set `OBSIDIAN_PLUGIN_DIR` to the plugin folder inside your vault, then run:

```bash
OBSIDIAN_PLUGIN_DIR="/path/to/your/vault/.obsidian/plugins/travel-map" npm run dev
```

On every change the plugin files are built and copied there automatically.
Reload the plugin in Obsidian: `Ctrl/Cmd+P` → **Reload app without saving**.

### Production build

```bash
npm run build
```

Runs a TypeScript type-check first, then builds `main.js` without source maps.

### Tests

```bash
npm test          # single run
npm run test:watch
```

---

## Project structure

```
travel-map-plugin/
├── main.ts                  # Plugin entry point – registers view, command, settings
├── manifest.json            # Obsidian plugin metadata (id, name, version)
├── package.json             # Dependencies + build scripts
├── tsconfig.json            # TypeScript configuration
├── esbuild.config.mjs       # Build pipeline; reads OBSIDIAN_PLUGIN_DIR env var
├── styles.css               # Leaflet CSS (static) + plugin UI CSS
└── src/
    ├── types.ts             # Interfaces + helpers: Place, Route, TravelMapSettings, priority/category/day
    ├── utils.ts             # File scanning, frontmatter parsing, wikilink resolution, distance, filters
    ├── routing.ts           # OSRM real-road routing (buildOsrmUrl, decodeOsrmGeometry, fetchRoute)
    ├── MapView.ts           # ItemView with Leaflet map (main component)
    ├── CreatePlaceModal.ts  # Modal for right-click "new place"
    └── SettingsTab.ts       # Plugin settings (root folder, key names, colors, icons, toggles)
```

---

## Architecture

### Data flow

```
Vault (Markdown files)
  ↓ metadataCache (Obsidian internal)
utils.ts: getVacationFiles → getPlaces / getRoutes
  ↓
MapView.ts: refreshMap()
  ↓ L.marker / L.polyline
Leaflet map (DOM)
```

### Components

**`main.ts` – TravelMapPlugin**
Entry point. Registers the MapView, ribbon button, command, and SettingsTab. Holds settings and exposes `saveSettings()`.

**`src/MapView.ts` – MapView extends ItemView**
The map component. Responsible for:
- Building the UI (toolbar with dropdown, map container, control panels)
- Initializing Leaflet
- Rendering place pins (with category emoji), draggable with write-back
- Rendering routes as colored polylines with numbered waypoints and distance
- Category and day filter panels, place list (fly-to), real-road routing
- Live updates via `metadataCache.on("changed")`

State worth knowing:
- `places` / `routes` – cached data for the active trip, so filter toggles re-render without re-reading the vault
- `markers` – registry by `file.basename`, used by the place list to open popups
- `activeCategories` / `activeDays` – `Set<string>` filter state, kept in sync via `syncFilter()`
- `routeLayers` – per route: a `LayerGroup` (line + numbered waypoints), color, distance
- `routeCache` – OSRM geometry by route signature, avoids refetching

Lifecycle:
- `onOpen()` → builds UI, registers event listeners
- `buildUI()` → can also be called from the refresh button; re-initializes everything
- `initLeaflet()` → initializes the Leaflet map (with 50 ms delay for DOM layout), registers `contextmenu`
- `refreshMap()` → reloads data, syncs filters, re-renders pins/routes/panels (no map restart)
- `onClose()` → cleans up Leaflet

**`src/utils.ts` – Pure helpers**
No side effects, fully unit-tested:
- `getVacations` / `getVacationFiles` → trip folders and their `.md` files
- `getPlaces` / `getRoutes` → parse frontmatter (incl. `priority`, `day`) into `Place[]` / `Route[]`
- `resolveRouteCoords` / `parseWikilink` → wikilinks to coordinates
- `getCategories` / `getDays` → distinct filter values
- `sortPlacesByPriority` → place-list ordering
- `haversineKm` / `routeDistanceKm` / `formatDistance` → route distances
- `roundCoord`, `buildPlaceFileContent` → new-place creation
- `parseCategoryIcons` / `serializeCategoryIcons` → settings ↔ icon map

**`src/routing.ts` – OSRM routing** (opt-in)
`buildOsrmUrl`, `decodeOsrmGeometry`, `routeSignature` are pure; `fetchRoute(coords)` calls Obsidian's `requestUrl` and falls back to `[]` on error.

**`src/CreatePlaceModal.ts` – CreatePlaceModal extends Modal**
Name (required) + optional category/priority. On submit calls back into MapView, which writes the note via `vault.create()`.

**`src/types.ts` – Types**
Interfaces, defaults, and pure helpers (`priorityColor`, `prioritySize`, `buildLegend`, `categoryIcon`). No Obsidian API code here.

**`src/SettingsTab.ts` – SettingsTab extends PluginSettingTab**
Root folder, frontmatter key names (incl. `dayField`), priority colors, category-icon editor, and the open-new-place + real-routing toggles.

---

## Frontmatter specification

### Place

```yaml
type: place           # required – identifies the file as a location
lat: 43.5081          # required – latitude (number)
lng: 16.4402          # required – longitude (number)
category: city        # optional – popup + category filter + icon
priority: 9           # optional – 1–10, defaults to 5
day: 1                # optional – itinerary day (number), enables the day filter
```

All field names are configurable in settings via `FrontmatterKeys` (`typeField`, `categoryField`, `priorityField`, `dayField`, `colorField`, `locationsField`, …), so existing vaults can keep their own naming.

### Route

```yaml
type: route           # required – identifies the file as a route
color: "#e74c3c"      # optional – hex color, default: "#3388ff"
locations:            # ordered list of wikilinks to place files
  - "[[Split]]"
  - "[[Dubrovnik]]"
```

Wikilink resolution: `parseWikilink("[[Split|Old Town]]")` → `"Split"`. Compared against `file.basename`.

---

## Leaflet integration

Leaflet is fully bundled by esbuild (not in `external`). Import in `MapView.ts`:
```typescript
import * as L from "leaflet";
```

**Leaflet CSS** is embedded statically in `styles.css` (copied from `node_modules/leaflet/dist/leaflet.css`). Obsidian loads `styles.css` automatically at plugin start.

**Marker icons**: `L.divIcon` markers are used (no default icon). This avoids the classic Leaflet bundler problem with broken marker image paths.

**Map container height**: Leaflet needs a container with a defined height. Solved via CSS:
```css
.tm-view { display: flex; flex-direction: column; height: 100%; }
.tm-map  { flex: 1; min-height: 0; }
```
The 50 ms `setTimeout` in `initLeaflet()` ensures the layout is set before Leaflet reads container dimensions.

---

## Adding a new feature

### New priority tier color

In `src/types.ts` → adjust `DEFAULT_PRIORITY_COLORS`, `priorityColor()`, `prioritySize()`, and `buildLegend()`.

### New frontmatter field for places

1. Add to the `Place` interface and a key to `FrontmatterKeys` in `src/types.ts`
2. Read the field in `src/utils.ts → getPlaces()`
3. Expose the key in `src/SettingsTab.ts` (`keyDefs`)
4. Use it in `src/MapView.ts → addMarker()` (popup) or add a filter panel (see the category/day panels)

### Extend popup content

In `src/MapView.ts → addMarker()` → modify `popupDiv`. The popup receives a DOM node, so full freedom with `document.createElement`.

---

## Build system

`esbuild.config.mjs`:
- Entry: `main.ts`
- Output: `main.js` (CommonJS, ES2018, tree-shaken)
- External: `obsidian` and all Node builtins (not bundled, provided by Obsidian runtime)
- **Not** external: `leaflet` (bundled)
- `copy-to-vault` plugin copies the 3 files to `OBSIDIAN_PLUGIN_DIR` after each build (only when env var is set)

Dev vs. prod:
- `npm run dev` → watch mode, inline source maps
- `npm run build` → one-shot build, no source map, TypeScript check first

---

## Obsidian API patterns used

| API | Usage |
|-----|-------|
| `ItemView` | Map view as its own tab |
| `Plugin.registerView()` | Register view type |
| `Plugin.addRibbonIcon()` | Icon in the ribbon |
| `Plugin.addCommand()` | Command palette entry |
| `Plugin.addSettingTab()` | Settings tab |
| `Plugin.loadData() / saveData()` | Persist settings |
| `app.metadataCache.getFileCache()` | Read frontmatter |
| `metadataCache.on("changed")` | Live updates on file changes |
| `app.vault.getAbstractFileByPath()` | Get folder/file by path |
| `app.vault.create()` | Create a new place note (right-click) |
| `app.fileManager.processFrontMatter()` | Write `lat`/`lng` back after a drag |
| `requestUrl()` | Fetch OSRM road geometry |
| `Modal` | "New place" dialog |
| `app.workspace.getRightLeaf()` | Open view on the right |
| `app.workspace.revealLeaf()` | Focus an existing view |
| `workspace.getLeaf().openFile()` | Open file in editor |

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `obsidian` | Obsidian Plugin API (dev-only, provided by host at runtime) |
| `leaflet` | Interactive map |
| `@types/leaflet` | TypeScript types for Leaflet |
| `esbuild` | Bundler |
| `typescript` | Type checker |
| `builtin-modules` | List of Node builtins for esbuild `external` |
