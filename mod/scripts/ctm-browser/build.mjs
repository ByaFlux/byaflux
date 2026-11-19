/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { resolve } from "node:path";

import { build } from "esbuild";
const root = import.meta.dirname;
const project = resolve(root, "../..");
await build({
    entryPoints: [root + "/entry.jsx"],
    bundle: true,
    format: "esm",
    target: "chrome120",
    outfile: root + "/.runtime/app.js",
    nodePaths: [root + "/node_modules"],
    alias: {
        "@webpack/common": root + "/react-shim.js",
        "@api/Settings": root + "/settings.js",
        "@api/Themes": root + "/themes.js",
        "@components/settings/tabs/BaseTab": root + "/base.jsx"
    },
    jsx: "transform",
    tsconfig: project + "/tsconfig.json",
    loader: { ".css": "css" }
});
await build({
    entryPoints: {
        storage: project + "/src/main/themes/themeMaker.ts",
        headers: project + "/src/main/themes/index.ts"
    },
    bundle: true,
    format: "esm",
    platform: "node",
    outdir: root + "/.runtime",
    outExtension: { ".js": ".mjs" }
});
