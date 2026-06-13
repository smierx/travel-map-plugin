# Travel Map Plugin

An [Obsidian](https://obsidian.md) plugin for visual vacation planning. Locations live as Markdown files with coordinates in the frontmatter. An interactive [Leaflet](https://leafletjs.com) map shows all pins for a selected trip and overlays color-coded routes.

![Plugin overview: map with colored pins and route lines]

---

## Features

- **Folder-based trips** – one subfolder per trip inside a configurable root folder
- **Location pins** – any Markdown file with `typ: ort` + coordinates appears as a pin
- **Priority coloring** – pin color and size reflect a 1–10 priority field at a glance
- **Routes** – ordered lists of wiki-linked locations drawn as colored polylines
- **Route toggles** – show/hide individual routes via a control panel on the map
- **Priority legend** – always-visible legend explaining the five color tiers
- **Live updates** – map refreshes automatically when you edit a file
- **Click to open** – clicking a pin's popup opens the linked note

---

## Installation

### Option A – Manual (current)

1. Download or build the plugin (see [Development](#development))
2. Copy the three files into your vault's plugin folder:
   ```
   <vault>/.obsidian/plugins/travel-map/
   ├── main.js
   ├── manifest.json
   └── styles.css
   ```
3. In Obsidian: **Settings → Community Plugins** → disable Restricted Mode → enable **Travel Map**

### Option B – BRAT (recommended for updates)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. **BRAT → Add Beta Plugin** → paste this repository URL
3. Enable **Travel Map** under Community Plugins

---

## Setup

### 1. Configure the root folder

**Settings → Travel Map → Urlaubs-Ordner**

Enter the path to your trips root folder relative to your vault root, e.g. `Reisen` or `99 Reisen`.

Every **direct subfolder** of this folder is treated as a separate trip. Subfolders within a trip folder are allowed and scanned recursively.

```
99 Reisen/              ← root folder (set this in settings)
├── Kroatien 2026/      ← trip
│   ├── Split.md        ← location
│   ├── Dubrovnik.md    ← location
│   ├── Route Küste.md  ← route
│   └── Inseln/         ← subfolder (allowed)
│       └── Hvar.md     ← location (found recursively)
└── Seoul 2026/         ← another trip
    └── ...
```

### 2. Open the map

- Click the **map icon** in the left ribbon, or
- `Ctrl/Cmd + P` → **Travel Map: Karte öffnen**

Select a trip from the dropdown at the top.

---

## Usage

### Creating a location

Create any Markdown file inside a trip folder with the following frontmatter:

```yaml
---
typ: ort
lat: 43.5081
lng: 16.4402
kategorie: stadt
priorität: 9
---

Your notes, links, images – anything goes here.
```

| Field | Required | Description |
|-------|----------|-------------|
| `typ: ort` | ✅ | Marks the file as a location |
| `lat` | ✅ | Latitude as a decimal number |
| `lng` | ✅ | Longitude as a decimal number |
| `kategorie` | – | Shown in the popup (e.g. `stadt`, `unterkunft`, `aktivität`, `restaurant`) |
| `priorität` | – | 1–10, defaults to **5** |

**Finding coordinates:** right-click any point in Google Maps → copy the first line (lat, lng).

### Priority colors

Pin color and size both scale with priority so you can spot must-sees at a glance:

| Priority | Color | Size |
|----------|-------|------|
| 1–2 | Grey | Small |
| 3–4 | Blue | · |
| 5–6 | Green | Medium (default) |
| 7–8 | Orange | · |
| 9–10 | Red | Large |

A legend is always visible in the bottom-left corner of the map.

### Creating a route

Create a Markdown file with `typ: route` and an ordered list of wiki-links:

```yaml
---
typ: route
farbe: "#e74c3c"
orte:
  - "[[Split]]"
  - "[[Hvar]]"
  - "[[Dubrovnik]]"
---
```

| Field | Required | Description |
|-------|----------|-------------|
| `typ: route` | ✅ | Marks the file as a route |
| `farbe` | – | Hex color for the line, defaults to `#3388ff` |
| `orte` | ✅ | Ordered list of wiki-links to location files |

The wiki-link must match the **exact filename** (without extension) of the location file.

### Map controls

| Control | Position | Function |
|---------|----------|----------|
| Trip dropdown + ⟳ | Top toolbar | Select trip, refresh trip list |
| Route panel | Top right | Toggle individual routes on/off |
| Priority legend | Bottom left | Color reference |
| Zoom / pan | Standard | Scroll to zoom, drag to pan |

Clicking **"Notiz öffnen"** in a pin popup opens the location's Markdown file.

---

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
git clone <repo-url>
cd travel-map-plugin
npm install
```

### Build

```bash
# Watch mode – rebuilds on every change and copies files to the vault
npm run dev

# One-shot production build (runs TypeScript check first)
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

The vault plugin path is hardcoded in `esbuild.config.mjs`. Change `VAULT_PLUGIN_DIR` to point to your vault if needed.

After each build, reload the plugin in Obsidian:
`Ctrl/Cmd + P` → **Reload app without saving**

### Project structure

```
travel-map-plugin/
├── main.ts              # Plugin entry point
├── src/
│   ├── types.ts         # Interfaces, priority color/size helpers
│   ├── utils.ts         # File scanning, frontmatter parsing, wikilink resolution
│   ├── MapView.ts       # ItemView with Leaflet map, markers, routes, controls
│   └── SettingsTab.ts   # Settings tab (root folder)
├── tests/
│   ├── __mocks__/
│   │   └── obsidian.ts  # Obsidian API mock for tests
│   ├── helpers.ts       # makeFile / makeFolder / makeApp factories
│   └── utils.test.ts    # 43 unit tests for utils.ts and types.ts
├── styles.css           # Leaflet CSS (bundled) + plugin UI
├── manifest.json
├── esbuild.config.mjs
├── vitest.config.ts
└── DEVELOPMENT.md       # Detailed developer documentation
```

See [`DEVELOPMENT.md`](DEVELOPMENT.md) for architecture details, API patterns, and extension guides.

---

## License

MIT
