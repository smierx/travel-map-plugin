import { App, PluginSettingTab, Setting } from "obsidian";
import TravelMapPlugin from "../main";

export class SettingsTab extends PluginSettingTab {
    private plugin: TravelMapPlugin;

    constructor(app: App, plugin: TravelMapPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName("Urlaubs-Ordner")
            .setDesc("Pfad zum Root-Ordner im Vault. Alle direkten Unterordner werden als Urlaube erkannt.")
            .addText(text =>
                text
                    .setPlaceholder("Reisen")
                    .setValue(this.plugin.settings.rootFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.rootFolder = value.trim();
                        this.plugin.settings.activeVacation = "";
                        await this.plugin.saveSettings();
                    })
            );
    }
}
