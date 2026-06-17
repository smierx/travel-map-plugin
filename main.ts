import { Plugin } from "obsidian";
import { MapView, TRAVEL_MAP_VIEW_TYPE } from "./src/MapView";
import { SettingsTab } from "./src/SettingsTab";
import { TravelMapSettings, DEFAULT_SETTINGS } from "./src/types";

export default class TravelMapPlugin extends Plugin {
    settings: TravelMapSettings = DEFAULT_SETTINGS;

    async onload() {
        await this.loadSettings();

        this.registerView(TRAVEL_MAP_VIEW_TYPE, (leaf) => new MapView(leaf, this));

        this.addRibbonIcon("map", "Travel Map", () => this.activateView());

        this.addCommand({
            id: "open",
            name: "Open map",
            callback: () => this.activateView(),
        });

        this.addSettingTab(new SettingsTab(this.app, this));
    }

    async onunload() {
        this.app.workspace.detachLeavesOfType(TRAVEL_MAP_VIEW_TYPE);
    }

    async loadSettings() {
        const saved = await this.loadData();
        this.settings = {
            ...DEFAULT_SETTINGS,
            ...saved,
            keys: { ...DEFAULT_SETTINGS.keys, ...(saved?.keys ?? {}) },
            colors: { ...DEFAULT_SETTINGS.colors, ...(saved?.colors ?? {}) },
            categoryIcons: saved?.categoryIcons ?? { ...DEFAULT_SETTINGS.categoryIcons },
        };
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private async activateView(): Promise<void> {
        const existing = this.app.workspace.getLeavesOfType(TRAVEL_MAP_VIEW_TYPE);
        if (existing.length) {
            this.app.workspace.revealLeaf(existing[0]);
            return;
        }
        const leaf = this.app.workspace.getRightLeaf(false);
        if (!leaf) return;
        await leaf.setViewState({ type: TRAVEL_MAP_VIEW_TYPE, active: true });
        this.app.workspace.revealLeaf(leaf);
    }
}
