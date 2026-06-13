# Travel Map Plugin – Entwicklerdokumentation

Obsidian-Plugin für visuelle Urlaubsplanung. Gebaut mit TypeScript, esbuild, Obsidian Plugin API und Leaflet.js.

---

## Schnellstart

```bash
cd /Users/smierx/Projects/travel-map-plugin
npm install
npm run dev       # Watch-Mode: baut bei jeder Änderung und kopiert in den Vault
npm run build     # Einmaliger Produktions-Build (mit TS-Check)
```

Der Build kopiert `main.js`, `manifest.json` und `styles.css` automatisch nach:
```
/Users/smierx/Desktop/Smierx/.obsidian/plugins/travel-map/
```

Nach dem Build Obsidian neu laden: Strg/Cmd+P → "Reload app without saving".

---

## Projektstruktur

```
travel-map-plugin/
├── main.ts                  # Plugin-Einstiegspunkt, registriert View/Command/Settings
├── manifest.json            # Obsidian Plugin-Metadaten (id, name, version)
├── package.json             # Dependencies + Build-Skripte
├── tsconfig.json            # TypeScript-Konfiguration
├── esbuild.config.mjs       # Build-Pipeline mit Auto-Copy in den Vault
├── styles.css               # Leaflet CSS (statisch) + Plugin UI CSS
└── src/
    ├── types.ts             # Interfaces: Place, Route, TravelMapSettings
    ├── utils.ts             # Datei-Scanning, Frontmatter-Parsing, Wikilink-Auflösung
    ├── MapView.ts           # ItemView mit Leaflet-Karte (Hauptkomponente)
    └── SettingsTab.ts       # Plugin-Einstellungen (Root-Ordner)
```

---

## Architektur

### Datenfluss

```
Vault (Markdown-Dateien)
  ↓ metadataCache (Obsidian intern)
utils.ts: getVacationFiles → getPlaces / getRoutes
  ↓
MapView.ts: refreshMap()
  ↓ L.marker / L.polyline
Leaflet-Karte (DOM)
```

### Komponenten

**`main.ts` – TravelMapPlugin**
Einstiegspunkt. Registriert die MapView, den Ribbon-Button, den Command und den SettingsTab. Hält die Settings und exponiert `saveSettings()`.

**`src/MapView.ts` – MapView extends ItemView**
Die eigentliche Karte. Zuständig für:
- UI aufbauen (Toolbar mit Dropdown, Map-Container, Routen-Toggles)
- Leaflet initialisieren
- Orts-Pins rendern
- Routen als farbige Polylines rendern
- Live-Updates über `metadataCache.on("changed")`

Lifecycle:
- `onOpen()` → baut UI, registriert Event-Listener
- `buildUI()` → kann auch vom Refresh-Button aufgerufen werden, re-initialisiert alles
- `initLeaflet()` → initialisiert die Leaflet-Map (mit 50ms Delay wegen DOM-Layout)
- `refreshMap()` → löscht und re-rendert Pins/Routen (kein Map-Neustart)
- `onClose()` → räumt Leaflet auf

**`src/utils.ts` – Datei-Scanning**
Reine Funktionen ohne Seiteneffekte:
- `getVacations(app, rootFolder)` → direkte Unterordner als TFolder[]
- `getVacationFiles(app, vacationPath)` → alle .md-Dateien rekursiv
- `getPlaces(app, files)` → Place[] aus Dateien mit `typ: ort`
- `getRoutes(app, files)` → Route[] aus Dateien mit `typ: route`
- `resolveRouteCoords(places, wikilinks)` → Koordinaten-Array für Polyline

**`src/types.ts` – Typen**
Interfaces und Konstanten. Kein Obsidian-API-Code hier.

**`src/SettingsTab.ts` – SettingsTab extends PluginSettingTab**
Einfacher Settings-Tab mit einem Textfeld für den Root-Ordner.

---

## Frontmatter-Spezifikation

### Ort

```yaml
typ: ort              # Pflicht – identifiziert die Datei als Ort
lat: 43.5081          # Pflicht – Breitengrad (number)
lng: 16.4402          # Pflicht – Längengrad (number)
kategorie: stadt      # Optional – bestimmt Pinfarbe
```

Gültige `kategorie`-Werte und ihre Pinfarben (definiert in `src/types.ts → KATEGORIE_FARBEN`):

| Wert | Farbe |
|------|-------|
| `stadt` | `#4a86cf` (Blau) |
| `unterkunft` | `#27ae60` (Grün) |
| `aktivität` | `#e74c3c` (Rot) |
| `restaurant` | `#f39c12` (Orange) |
| `sonstiges` | `#95a5a6` (Grau) |
| *(kein Wert)* | `#4a86cf` (Blau, Fallback) |

### Route

```yaml
typ: route            # Pflicht – identifiziert die Datei als Route
farbe: "#e74c3c"      # Optional – Hex-Farbcode, Default: "#3388ff"
orte:                 # Liste von Wikilinks zu Orts-Dateien (in Reihenfolge)
  - "[[Split]]"
  - "[[Dubrovnik]]"
```

Wikilink-Auflösung: `parseWikilink("[[Split|Altstadt]]")` → `"Split"`. Vergleich über `file.basename`.

---

## Leaflet-Integration

Leaflet wird vollständig von esbuild gebündelt (nicht in `external`). Der Import in `MapView.ts`:
```typescript
import * as L from "leaflet";
```

**Leaflet CSS** ist statisch in `styles.css` eingebettet (aus `node_modules/leaflet/dist/leaflet.css` kopiert). Obsidian lädt `styles.css` automatisch beim Plugin-Start.

**Marker-Icons**: Es werden `L.divIcon`-Marker verwendet (kein Default-Icon). Dadurch entfällt das klassische Leaflet-Bundler-Problem mit kaputten Marker-Bildpfaden.

**Map-Container-Höhe**: Leaflet braucht einen Container mit definierter Höhe. Das wird über CSS gelöst:
```css
.tm-view { display: flex; flex-direction: column; height: 100%; }
.tm-map  { flex: 1; min-height: 0; }
```
Das 50ms-`setTimeout` in `initLeaflet()` stellt sicher, dass das Layout gesetzt ist, bevor Leaflet die Container-Dimensionen liest.

---

## Neues Feature hinzufügen

### Neue Kategorie / Pinfarbe

In `src/types.ts` → `KATEGORIE_FARBEN`:
```typescript
export const KATEGORIE_FARBEN: Record<string, string> = {
    stadt: "#4a86cf",
    unterkunft: "#27ae60",
    meinstrand: "#00bcd4",  // ← neu
    ...
};
```

### Neues Frontmatter-Feld für Orte

1. Interface in `src/types.ts → Place` ergänzen
2. In `src/utils.ts → getPlaces()` das Feld auslesen
3. In `src/MapView.ts → addMarker()` das Feld verwenden (z.B. im Popup anzeigen)

### Neuer Tab / neue Ansicht

Analog zum LernX-Plugin (`/Users/smierx/Projects/lernx-plugin/src/SessionView.ts`) kann der View um Tabs erweitert werden:
- Private `tab`-Variable in MapView
- Tab-Bar im Toolbar rendern
- Im Content-Bereich je nach Tab rendern

### Popup-Inhalt erweitern

In `src/MapView.ts → addMarker()` → `popupDiv` anpassen. Das Popup bekommt einen DOM-Node übergeben, also volle Freiheit mit `document.createElement`.

---

## Build-System

`esbuild.config.mjs`:
- Entry: `main.ts`
- Output: `main.js` (CommonJS, ES2018, tree-shaken)
- Extern: `obsidian` und alle Node-Builtins (nicht gebündelt, vom Obsidian-Runtime geliefert)
- **Nicht** extern: `leaflet` (wird gebündelt)
- `copy-to-vault`-Plugin kopiert nach jedem Build die 3 Dateien in den Vault

Dev vs. Prod:
- `npm run dev` → Watch-Mode, inline Sourcemaps
- `npm run build` → einmaliger Build, kein Sourcemap, TypeScript-Check vorab

---

## Obsidian API – verwendete Patterns

| API | Verwendung |
|-----|-----------|
| `ItemView` | Kartenansicht als eigener Tab |
| `Plugin.registerView()` | View-Typ registrieren |
| `Plugin.addRibbonIcon()` | Icon in der Ribbon-Leiste |
| `Plugin.addCommand()` | Command-Palette-Eintrag |
| `Plugin.addSettingTab()` | Einstellungen-Tab |
| `Plugin.loadData() / saveData()` | Einstellungen persistieren |
| `app.metadataCache.getFileCache()` | Frontmatter auslesen |
| `metadataCache.on("changed")` | Live-Updates bei Datei-Änderungen |
| `app.vault.getAbstractFileByPath()` | Ordner/Datei per Pfad |
| `app.workspace.getRightLeaf()` | View rechts öffnen |
| `app.workspace.revealLeaf()` | Bestehende View in den Fokus |
| `workspace.getLeaf().openFile()` | Datei im Editor öffnen |

---

## Abhängigkeiten

| Paket | Zweck |
|-------|-------|
| `obsidian` | Obsidian Plugin API (Dev-Only, zur Laufzeit vom Host bereitgestellt) |
| `leaflet` | Interaktive Karte |
| `@types/leaflet` | TypeScript-Typen für Leaflet |
| `esbuild` | Bundler |
| `typescript` | Typ-Checker |
| `builtin-modules` | Liste der Node-Builtins für esbuild `external` |
