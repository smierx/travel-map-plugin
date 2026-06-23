# Release-Guide – Travel Map als offizielles Obsidian-Plugin

Lokal ist alles vorbereitet (manifest/package.json 0.4.0, versions.json, LICENSE,
Branch `main`). Es fehlen nur die Schritte, die GitHub-Login bzw. -Zugriff brauchen.

## 1. GitHub-Login (interaktiv, im Terminal)

```
! gh auth login
```

## 2. Public Repo anlegen und main pushen

```
gh repo create smierx/travel-map-plugin --public --source=. --remote=origin --push
git push -u origin main
git push origin dev
```

> Wichtig: Default-Branch in den Repo-Settings auf `main` stellen, falls nicht automatisch.

## 3. Release 0.4.0 erstellen

Der Workflow `.github/workflows/release.yml` triggert auf Tags wie `0.4.0`
(ohne `v`) und hängt `main.js`, `manifest.json`, `styles.css` als Assets an.

```
git checkout main
git tag 0.4.0
git push origin 0.4.0
```

Danach unter Actions prüfen, dass der Release-Workflow grün durchläuft und die
drei Dateien einzeln am Release hängen.

## 4. PR an obsidian-releases

Fork `obsidianmd/obsidian-releases`, ans **Ende** des Arrays in
`community-plugins.json` diesen Eintrag anhängen (Komma zum vorigen Eintrag nicht
vergessen), dann PR stellen:

```json
{
    "id": "travel-map",
    "name": "Travel Map",
    "author": "Michel Dudas",
    "description": "Visual trip planning with an interactive map. Location files with coordinates appear as priority-colored pins; route files draw polylines between them.",
    "repo": "smierx/travel-map-plugin"
}
```

Im PR-Template alle Checkboxen abhaken. Danach läuft erst ein Validierungs-Bot,
dann ein manuelles Review (dauert Wochen).

## Checkliste vor dem PR (Obsidian-Guidelines)

- [x] `id` in manifest = `id` im Registry-Eintrag (`travel-map`)
- [x] Name ohne "Obsidian"/"Plugin"
- [x] `minAppVersion` gesetzt (1.7.2)
- [x] LICENSE vorhanden (MIT)
- [x] versions.json vorhanden
- [x] keine `console.log`-Reste, kein `innerHTML`
- [ ] Release 0.4.0 mit 3 einzelnen Assets existiert
- [ ] README erklärt Installation + Nutzung
