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
    ├── types.ts             # Interfaces: Place, Route, TravelMapSettings
    ├── utils.ts             # File scanning, frontmatter parsing, wikilink resolution
    ├── MapView.ts           # ItemView with Leaflet map (main component)
    └── SettingsTab.ts       # Plugin settings (root folder, key names, colors)
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
- Building the UI (toolbar with dropdown, map container, route toggles)
- Initializing Leaflet
- Rendering place pins
- Rendering routes as colored polylines
- Live updates via `metadataCache.on("changed")`

Lifecycle:
- `onOpen()` → builds UI, registers event listeners
- `buildUI()` → can also be called from the refresh button; re-initializes everything
- `initLeaflet()` → initializes the Leaflet map (with 50 ms delay for DOM layout)
- `refreshMap()` → clears and re-renders pins/routes (no map restart)
- `onClose()` → cleans up Leaflet

**`src/utils.ts` – File scanning**
Pure functions without side effects:
- `getVacations(app, rootFolder)` → direct subfolders as TFolder[]
- `getVacationFiles(app, vacationPath)` → all .md files recursively
- `getPlaces(app, files)` → Place[] from files with `type: place`
- `getRoutes(app, files)` → Route[] from files with `type: route`
- `resolveRouteCoords(places, wikilinks)` → coordinate array for polylines

**`src/types.ts` – Types**
Interfaces and constants. No Obsidian API code here.

**`src/SettingsTab.ts` – SettingsTab extends PluginSettingTab**
Settings tab for the root folder, frontmatter key names, and priority colors.

---

## Frontmatter specification

### Place

```yaml
type: place           # required – identifies the file as a location
lat: 43.5081          # required – latitude (number)
lng: 16.4402          # required – longitude (number)
category: city        # optional – shown in the popup
priority: 9           # optional – 1–10, defaults to 5
```

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

### New category / pin color

In `src/types.ts` → add to `PRIORITY_LEGEND` or extend the `Place` interface.

### New frontmatter field for places

1. Add to the `Place` interface in `src/types.ts`
2. Read the field in `src/utils.ts → getPlaces()`
3. Use it in `src/MapView.ts → addMarker()` (e.g. show in popup)

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
