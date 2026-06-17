import { App, PluginSettingTab, Setting } from "obsidian";
import TravelMapPlugin from "../main";
import { DEFAULT_FRONTMATTER_KEYS, DEFAULT_PRIORITY_COLORS, DEFAULT_CATEGORY_ICONS } from "./types";
import { parseCategoryIcons, serializeCategoryIcons } from "./utils";

export class SettingsTab extends PluginSettingTab {
    private plugin: TravelMapPlugin;

    constructor(app: App, plugin: TravelMapPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // ── General ────────────────────────────────────────────────────────────

        new Setting(containerEl)
            .setName("Trips folder")
            .setDesc("Path to the root folder inside your vault. Every direct subfolder is treated as a trip.")
            .addText(text =>
                text
                    .setPlaceholder("Trips")
                    .setValue(this.plugin.settings.rootFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.rootFolder = value.trim();
                        this.plugin.settings.activeVacation = "";
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Open new place after creating")
            .setDesc("When you create a place by right-clicking the map, open its note right away.")
            .addToggle(toggle =>
                toggle
                    .setValue(this.plugin.settings.openNewPlace)
                    .onChange(async (value) => {
                        this.plugin.settings.openNewPlace = value;
                        await this.plugin.saveSettings();
                    })
            );

        // ── Frontmatter keys ───────────────────────────────────────────────────

        containerEl.createEl("h3", { text: "Frontmatter keys" });
        containerEl.createEl("p", {
            text: "Customize the YAML field names to match your existing notes.",
            cls: "setting-item-description",
        });

        const keyDefs: Array<{
            name: string;
            desc: string;
            prop: keyof typeof DEFAULT_FRONTMATTER_KEYS;
        }> = [
            { name: "Type field", desc: 'Field that identifies the entry type (e.g. "type")', prop: "typeField" },
            { name: "Place value", desc: 'Value that marks a location (e.g. "place")', prop: "placeValue" },
            { name: "Route value", desc: 'Value that marks a route (e.g. "route")', prop: "routeValue" },
            { name: "Category field", desc: 'Field for the location category (e.g. "category")', prop: "categoryField" },
            { name: "Priority field", desc: 'Field for the 1–10 priority (e.g. "priority")', prop: "priorityField" },
            { name: "Color field", desc: 'Field for the route line color (e.g. "color")', prop: "colorField" },
            { name: "Locations field", desc: 'Field listing the route stops (e.g. "locations")', prop: "locationsField" },
        ];

        for (const { name, desc, prop } of keyDefs) {
            new Setting(containerEl)
                .setName(name)
                .setDesc(desc)
                .addText(text =>
                    text
                        .setPlaceholder(DEFAULT_FRONTMATTER_KEYS[prop])
                        .setValue(this.plugin.settings.keys[prop])
                        .onChange(async (value) => {
                            this.plugin.settings.keys[prop] = value.trim() || DEFAULT_FRONTMATTER_KEYS[prop];
                            await this.plugin.saveSettings();
                        })
                );
        }

        new Setting(containerEl)
            .setName("Reset keys to defaults")
            .addButton(btn =>
                btn
                    .setButtonText("Reset")
                    .onClick(async () => {
                        this.plugin.settings.keys = { ...DEFAULT_FRONTMATTER_KEYS };
                        await this.plugin.saveSettings();
                        this.display();
                    })
            );

        // ── Priority colors ────────────────────────────────────────────────────

        containerEl.createEl("h3", { text: "Priority colors" });
        containerEl.createEl("p", {
            text: "Hex colors for each priority tier. Used for pin colors and the legend.",
            cls: "setting-item-description",
        });

        const colorDefs: Array<{
            name: string;
            prop: keyof typeof DEFAULT_PRIORITY_COLORS;
        }> = [
            { name: "Tier 1 – Low (1–2)",       prop: "tier1" },
            { name: "Tier 2 – Minor (3–4)",      prop: "tier2" },
            { name: "Tier 3 – Medium (5–6)",     prop: "tier3" },
            { name: "Tier 4 – High (7–8)",       prop: "tier4" },
            { name: "Tier 5 – Must-see (9–10)",  prop: "tier5" },
        ];

        for (const { name, prop } of colorDefs) {
            new Setting(containerEl)
                .setName(name)
                .addColorPicker(picker =>
                    picker
                        .setValue(this.plugin.settings.colors[prop])
                        .onChange(async (value) => {
                            this.plugin.settings.colors[prop] = value;
                            await this.plugin.saveSettings();
                        })
                );
        }

        new Setting(containerEl)
            .setName("Reset colors to defaults")
            .addButton(btn =>
                btn
                    .setButtonText("Reset")
                    .onClick(async () => {
                        this.plugin.settings.colors = { ...DEFAULT_PRIORITY_COLORS };
                        await this.plugin.saveSettings();
                        this.display();
                    })
            );

        // ── Category icons ─────────────────────────────────────────────────────

        containerEl.createEl("h3", { text: "Category icons" });
        containerEl.createEl("p", {
            text: "One emoji per category, format \"category: 🏙️\" (one per line). Shown inside the pin and in the category filter. Category names are case-insensitive.",
            cls: "setting-item-description",
        });

        new Setting(containerEl)
            .setName("Icons")
            .addTextArea(area => {
                area
                    .setValue(serializeCategoryIcons(this.plugin.settings.categoryIcons))
                    .onChange(async (value) => {
                        this.plugin.settings.categoryIcons = parseCategoryIcons(value);
                        await this.plugin.saveSettings();
                    });
                area.inputEl.rows = 8;
                area.inputEl.addClass("tm-icons-textarea");
            });

        new Setting(containerEl)
            .setName("Reset icons to defaults")
            .addButton(btn =>
                btn
                    .setButtonText("Reset")
                    .onClick(async () => {
                        this.plugin.settings.categoryIcons = { ...DEFAULT_CATEGORY_ICONS };
                        await this.plugin.saveSettings();
                        this.display();
                    })
            );
    }
}
