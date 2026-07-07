# Travel Map Plugin

An [Obsidian](https://obsidian.md) plugin for visual trip planning. Locations live as Markdown files with coordinates in the frontmatter. An interactive [Leaflet](https://leafletjs.com) map shows all pins for a selected trip and overlays color-coded routes.

---

## Features

- **Folder-based trips** – one subfolder per trip inside a configurable root folder
- **Location pins** – any Markdown file with `type: place` + coordinates appears as a pin
- **Priority coloring** – pin color and size reflect a 1–10 priority field at a glance
- **Category icons** – an emoji per category, shown inside the pin and the filter (configurable)
- **Create by right-click** – right-click the map to drop a new place note with coordinates prefilled
- **Drag to reposition** – drag a pin and its `lat`/`lng` are written back to the note
- **Category filter** – show/hide pins by category from a control panel
- **Day filter** – plan an itinerary with a `day` field and toggle days on/off
- **Place list** – a sortable list of all stops; click one to fly to it and open its popup
- **Routes** – ordered lists of wiki-linked locations drawn as colored polylines
- **Real road routing** – optionally draw routes along real roads via OSRM (opt-in)
- **Numbered waypoints** – each route stop is numbered in route order
- **Route distance** – each route shows its total distance
- **Route toggles** – show/hide individual routes via a control panel on the map
- **Priority legend** – always-visible legend explaining the five color tiers
- **Live updates** – map refreshes automatically when you edit a file
- **Click to open** – clicking a pin's popup opens the linked note

---

## Installation

### Community plugins (once listed)

**Settings → Community Plugins → Browse** → search for **Travel Map** → Install → Enable.

### BRAT (beta)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. **BRAT → Add Beta Plugin** → paste `https://github.com/smierx/obsidian-travel-map`
3. Enable **Travel Map** under Community Plugins

### Manual

1. Download `main.js`, `manifest.json`, `styles.css` from the [latest release](https://github.com/smierx/obsidian-travel-map/releases/latest)
2. Copy the files into your vault:
   ```
   <vault>/.obsidian/plugins/travel-map/
   ├── main.js
   ├── manifest.json
   └── styles.css
   ```
3. **Settings → Community Plugins** → disable Restricted Mode → enable **Travel Map**

---

## Setup

### 1. Configure the root folder

**Settings → Travel Map → Trips folder**

Enter the path to your trips root folder relative to your vault root, e.g. `Trips` or `99 Reisen`.

Every **direct subfolder** is treated as a separate trip. Subfolders within a trip are scanned recursively.

```
Trips/                  ← root folder (set this in settings)
├── Croatia 2026/       ← trip
│   ├── Split.md        ← location
│   ├── Dubrovnik.md    ← location
│   ├── Coastal Route.md ← route
│   └── Islands/        ← subfolder (allowed)
│       └── Hvar.md     ← location (found recursively)
└── Seoul 2026/         ← another trip
    └── ...
```

### 2. Open the map

- Click the **map icon** in the left ribbon, or
- `Ctrl/Cmd + P` → **Travel Map: Open map**

Select a trip from the dropdown at the top.

---

## Usage

### Creating a location

The fastest way: **right-click the map** at the spot you want, enter a name (category and priority are optional), and the note is created in the active trip folder with coordinates prefilled. By default the new note opens right away (toggle in settings).

Or create the file by hand inside a trip folder:

```yaml
---
type: place
lat: 43.5081
lng: 16.4402
category: city
priority: 9
day: 1
---

Your notes, links, images – anything goes here.
```

| Field | Required | Description |
|-------|----------|-------------|
| `type: place` | ✅ | Marks the file as a location |
| `lat` | ✅ | Latitude as a decimal number |
| `lng` | ✅ | Longitude as a decimal number |
| `category` | – | Shown in the popup and drives the category filter + icon (e.g. `city`, `restaurant`) |
| `priority` | – | 1–10, defaults to **5** |
| `day` | – | Itinerary day as a number; enables the day filter |

**Finding coordinates:** right-click any point in Google Maps → copy the first line (lat, lng). Or just right-click the map in the plugin. You can also **drag a pin** to fine-tune its position – the new coordinates are saved back to the note.

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

### Category icons

Each category can show an emoji inside its pin and in the category filter. Defaults cover common English and German categories (`city` → 🏙️, `restaurant` → 🍴, `hotel` → 🏨, …). Edit the mapping under **Settings → Travel Map → Category icons**, one `category: emoji` per line. Categories are case-insensitive; unknown ones just show a plain colored dot.

### Itinerary (days)

Add a numeric `day` field to places to plan a multi-day trip:

```yaml
type: place
lat: 43.5081
lng: 16.4402
day: 2
```

When at least two days are present, a **Days** panel appears top-right. Toggle days on and off to focus on one part of the trip. Places without a `day` group under **(no day)**. The day and category filters combine – a pin shows only when both its day and category are active.

### Creating a route

Create a Markdown file with `type: route` and an ordered list of wiki-links:

```yaml
---
type: route
color: "#e74c3c"
locations:
  - "[[Split]]"
  - "[[Hvar]]"
  - "[[Dubrovnik]]"
---
```

| Field | Required | Description |
|-------|----------|-------------|
| `type: route` | ✅ | Marks the file as a route |
| `color` | – | Hex color for the line, defaults to `#3388ff` |
| `locations` | ✅ | Ordered list of wiki-links to location files |

The wiki-link must match the **exact filename** (without extension) of the location file.

Each route is drawn with **numbered waypoints** in route order and shows its **total distance** in the route panel.

### Real road routing (optional)

By default routes are straight lines (fully offline). Enable **Settings → Travel Map → Real road routing** to draw them along actual roads via the public [OSRM](https://project-osrm.org) service. This sends the route's coordinates to an external server, so it is off by default. On any network error the route falls back to the straight line. Responses are cached per route, so toggling files does not refetch.

> **Note:** this uses the free public OSRM demo server (`router.project-osrm.org`), which is intended for light/testing use only and offers no uptime guarantee. For heavy or reliable routing, host your own OSRM instance.

### Map controls

| Control | Position | Function |
|---------|----------|----------|
| Trip dropdown + ⟳ | Top toolbar | Select trip, refresh trip list |
| Place list | Top left | All stops by priority; click to fly there and open the popup |
| Days panel | Top right | Toggle itinerary days (when ≥2 days exist) |
| Categories panel | Top right | Toggle categories (when ≥2 categories exist) |
| Route panel | Top right | Toggle routes; shows distance per route |
| Priority legend | Bottom left | Color reference |
| Zoom / pan | Standard | Scroll to zoom, drag to pan |

Right-click the map to **create a place**, drag a pin to **move it**, and click **"Open note"** in a popup to open the location's Markdown file.

---

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
git clone https://github.com/smierx/obsidian-travel-map
cd obsidian-travel-map
npm install
```

### Build

```bash
# Watch mode – set OBSIDIAN_PLUGIN_DIR to auto-copy files to your vault
OBSIDIAN_PLUGIN_DIR="/path/to/vault/.obsidian/plugins/travel-map" npm run dev

# One-shot production build (runs TypeScript check first)
npm run build

# Run tests
npm test
```

After each build, reload the plugin in Obsidian:
`Ctrl/Cmd + P` → **Reload app without saving**

See [`DEVELOPMENT.md`](DEVELOPMENT.md) for architecture details, API patterns, and extension guides.

---

## License

MIT
