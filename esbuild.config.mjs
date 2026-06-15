import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { copyFileSync, mkdirSync } from "fs";

const VAULT_PLUGIN_DIR = process.env.OBSIDIAN_PLUGIN_DIR ?? "";

const prod = process.argv[2] === "production";

const plugins = [];

if (VAULT_PLUGIN_DIR) {
    plugins.push({
        name: "copy-to-vault",
        setup(build) {
            build.onEnd(() => {
                mkdirSync(VAULT_PLUGIN_DIR, { recursive: true });
                copyFileSync("main.js", `${VAULT_PLUGIN_DIR}/main.js`);
                copyFileSync("manifest.json", `${VAULT_PLUGIN_DIR}/manifest.json`);
                copyFileSync("styles.css", `${VAULT_PLUGIN_DIR}/styles.css`);
                console.log(`→ Copied to ${VAULT_PLUGIN_DIR}`);
            });
        },
    });
}

const context = await esbuild.context({
    entryPoints: ["main.ts"],
    bundle: true,
    external: [
        "obsidian",
        "electron",
        "@codemirror/autocomplete",
        "@codemirror/collab",
        "@codemirror/commands",
        "@codemirror/language",
        "@codemirror/lint",
        "@codemirror/search",
        "@codemirror/state",
        "@codemirror/view",
        "@lezer/common",
        "@lezer/highlight",
        "@lezer/lr",
        ...builtins,
    ],
    format: "cjs",
    target: "es2018",
    logLevel: "info",
    sourcemap: prod ? false : "inline",
    treeShaking: true,
    outfile: "main.js",
    plugins,
});

if (prod) {
    await context.rebuild();
    process.exit(0);
} else {
    await context.watch();
}
