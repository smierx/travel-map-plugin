import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    test: {
        environment: "node",
    },
    resolve: {
        alias: {
            // Obsidian API ist zur Laufzeit nicht verfügbar – Mock einbinden
            obsidian: path.resolve(__dirname, "tests/__mocks__/obsidian.ts"),
        },
    },
});
