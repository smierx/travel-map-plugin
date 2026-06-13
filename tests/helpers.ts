import { TFile, TFolder } from "obsidian";

export function makeFile(path: string, parent?: TFolder): TFile {
    const file = new TFile();
    file.path = path;
    file.extension = path.split(".").pop() ?? "";
    file.basename = (path.split("/").pop() ?? "").replace(/\.[^.]+$/, "");
    file.name = path.split("/").pop() ?? "";
    file.parent = parent ?? null;
    return file;
}

export function makeFolder(path: string, children: (TFile | TFolder)[] = []): TFolder {
    const folder = new TFolder();
    folder.path = path;
    folder.name = path.split("/").pop() ?? "";
    folder.children = children;
    return folder;
}

// Gibt ein minimales App-Objekt zurück das vault und metadataCache simuliert.
// files: Pfad → TFile | TFolder (für vault.getAbstractFileByPath)
// frontmatters: Dateipfad → Frontmatter-Objekt (für metadataCache.getFileCache)
export function makeApp(opts: {
    files?: Map<string, TFile | TFolder>;
    frontmatters?: Map<string, Record<string, unknown>>;
} = {}): unknown {
    const files = opts.files ?? new Map<string, TFile | TFolder>();
    const frontmatters = opts.frontmatters ?? new Map<string, Record<string, unknown>>();

    return {
        vault: {
            getAbstractFileByPath: (path: string) => files.get(path) ?? null,
        },
        metadataCache: {
            getFileCache: (file: TFile) => {
                const fm = frontmatters.get(file.path);
                return fm ? { frontmatter: fm } : null;
            },
        },
    };
}
