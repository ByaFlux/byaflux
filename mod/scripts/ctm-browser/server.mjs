/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";

import { getThemeInfo } from "./.runtime/headers.mjs";
import { listCtmThemes, saveCtmTheme } from "./.runtime/storage.mjs";
const root = import.meta.dirname,
    dir = root + "/.runtime/user-themes";
await mkdir(dir, { recursive: true });
await writeFile(dir + "/Other.theme.css", "/**\n * @name Tema externo\n */\n:root { --external-theme-kept: 1; }");
let settings;
try {
    settings = JSON.parse(await readFile(root + "/.runtime/user-settings.json", "utf8"));
} catch {
    settings = {
        enabledThemes: ["Other.theme.css"],
        themeActivationModes: { "Other.theme.css": "dark" }
    };
}
let queue = Promise.resolve();
const server = createServer(async (req, res) => {
    try {
        res.setHeader(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://*.github.io https://fonts.googleapis.com; img-src 'self' data: https://*.github.io https://discord.com https://images.example.test; font-src 'self' https://fonts.gstatic.com; frame-src 'self'; connect-src 'self';"
        );
        let data = "";
        for await (const chunk of req) data += chunk;
        const body = data ? JSON.parse(data) : undefined;
        let value;
        if (req.url === "/native-client") {
            const info = JSON.parse(await readFile(root + "/.runtime/native-info.json", "utf8"));
            res.setHeader("Content-Type", "text/html");
            res.end(
                `<!doctype html><html class="theme-dark"><head><link rel="stylesheet" href="/native-tokens.css"><link rel="stylesheet" href="/native-button.css"><style>body{padding:16px;color:white;background:#25252c}button{padding:10px 16px;cursor:pointer}#native-switch{display:inline-block;width:32px;height:18px;background:var(--switch-background-selected-default)}#native-link{color:var(--text-link)}</style><style id="legacy-proof"></style><style id="client-theme"></style></head><body><button id="native-primary" class="${info.classes}">Ação primária</button><button id="native-critical" class="${info.classes.replace("colorBrand_", "colorRed_")}">Ação destrutiva</button><span id="native-switch"></span><a id="native-link">Link</a></body></html>`
            );
            return;
        }
        if (["/native-button.css", "/native-tokens.css"].includes(req.url)) {
            res.setHeader("Content-Type", "text/css");
            res.end(await readFile(root + "/.runtime" + req.url, "utf8"));
            return;
        }
        if (req.url.startsWith("/theme/")) {
            const fileName = decodeURIComponent(req.url.slice(7).split("?")[0]);
            if (
                fileName.includes("/") ||
                fileName.includes(String.fromCharCode(92)) ||
                !fileName.endsWith(".theme.css")
            )
                throw Error("Invalid theme filename");
            res.setHeader("Content-Type", "text/css");
            res.end(await readFile(dir + "/" + fileName, "utf8"));
            return;
        }
        if (req.url === "/ctm-themes") value = await listCtmThemes(dir);
        else if (req.url === "/ctm-save") value = await saveCtmTheme(dir, body);
        else if (req.url === "/themes")
            value = await Promise.all(
                (await readdir(dir))
                    .filter(f => f.endsWith(".css"))
                    .map(async f => getThemeInfo(await readFile(dir + "/" + f, "utf8"), f))
            );
        else if (req.url === "/settings") {
            if (body) {
                settings = body;
                const text = JSON.stringify(body);
                queue = queue.then(() => writeFile(root + "/.runtime/user-settings.json", text));
                await queue;
            }
            value = settings;
        } else if (req.url === "/active-css") {
            res.setHeader("Content-Type", "text/css");
            res.end(
                settings.enabledThemes
                    .map(file => `@import url("/theme/${encodeURIComponent(file)}?v=${Date.now()}");`)
                    .join("\n")
            );
            return;
        } else {
            const files = { "/": "index.html", "/app.js": "app.js", "/app.css": "app.css" };
            if (!files[req.url]) {
                res.statusCode = 404;
                res.end();
                return;
            }
            res.setHeader(
                "Content-Type",
                req.url.endsWith(".js") ? "text/javascript" : req.url.endsWith(".css") ? "text/css" : "text/html"
            );
            res.end(await readFile(root + (req.url === "/" ? "/" : "/.runtime/") + files[req.url]));
            return;
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(value));
    } catch (error) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: error.message }));
    }
});
server.listen(4173, "127.0.0.1", () => console.log("CTM validation: http://127.0.0.1:4173"));
