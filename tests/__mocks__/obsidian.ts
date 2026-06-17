// Minimaler Obsidian-API-Mock für Tests.
// instanceof-Checks in utils.ts funktionieren nur wenn diese Klassen
// die gleichen sind wie die, die im Produktions-Code importiert werden –
// das garantiert der vitest-Alias auf diese Datei.

export class TAbstractFile {
    path: string = "";
    name: string = "";
    parent: TFolder | null = null;
    vault: unknown = null;
}

export class TFile extends TAbstractFile {
    stat = { ctime: 0, mtime: 0, size: 0 };
    basename: string = "";
    extension: string = "";
}

export class TFolder extends TAbstractFile {
    children: (TFile | TFolder)[] = [];
    isRoot(): boolean { return !this.parent; }
}

// Weitere Obsidian-Exporte die von types.ts / main.ts importiert werden
export class App {}
export class Plugin {}
export class ItemView {}
export class WorkspaceLeaf {}
export class Notice { constructor(_msg: string) {} }
export class Modal { constructor(_app: unknown) {} }
export class PluginSettingTab { constructor(_app: unknown, _plugin: unknown) {} }
export class Setting { constructor(_el: HTMLElement) {} }
export class Component {}

// Netzwerk-Helfer – im Test nicht aufgerufen, nur als Export vorhanden,
// damit Module die ihn importieren (routing.ts) sich laden lassen.
export function requestUrl(_opts: unknown): Promise<{ json: unknown }> {
    throw new Error("requestUrl is not mocked in unit tests");
}
