import { App, Modal, Setting, Notice } from "obsidian";

export interface NewPlaceInput {
    category?: string;
    priority?: number;
}

type SubmitHandler = (name: string, opts: NewPlaceInput) => void | Promise<void>;

// F1: Dialog zum Anlegen eines Ortes nach Rechtsklick auf die Karte.
// Koordinaten kommen vom Klick, Name ist Pflicht, Kategorie + Priorität optional.
export class CreatePlaceModal extends Modal {
    private name = "";
    private category = "";
    private priority: number | undefined;

    constructor(
        app: App,
        private lat: number,
        private lng: number,
        private onSubmit: SubmitHandler,
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h3", { text: "New place" });
        contentEl.createEl("p", {
            text: `${this.lat}, ${this.lng}`,
            cls: "tm-modal-coords",
        });

        new Setting(contentEl)
            .setName("Name")
            .addText((t) => {
                t.setPlaceholder("e.g. Split").onChange((v) => (this.name = v));
                t.inputEl.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") this.submit();
                });
                window.setTimeout(() => t.inputEl.focus(), 0);
            });

        new Setting(contentEl)
            .setName("Category")
            .setDesc("Optional")
            .addText((t) =>
                t.setPlaceholder("city, restaurant, …").onChange((v) => (this.category = v)),
            );

        new Setting(contentEl)
            .setName("Priority")
            .setDesc("Optional, 1–10")
            .addText((t) => {
                t.inputEl.type = "number";
                t.inputEl.min = "1";
                t.inputEl.max = "10";
                t.setPlaceholder("5").onChange((v) => {
                    const n = Number(v);
                    this.priority = v.trim() && !Number.isNaN(n) ? n : undefined;
                });
            });

        new Setting(contentEl).addButton((b) =>
            b.setButtonText("Create").setCta().onClick(() => this.submit()),
        );
    }

    private submit() {
        if (!this.name.trim()) {
            new Notice("Name darf nicht leer sein.");
            return;
        }
        const opts: NewPlaceInput = {};
        if (this.category.trim()) opts.category = this.category.trim();
        if (typeof this.priority === "number") opts.priority = this.priority;
        this.close();
        void this.onSubmit(this.name.trim(), opts);
    }

    onClose() {
        this.contentEl.empty();
    }
}
