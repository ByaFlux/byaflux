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
        let data = "";
        for await (const chunk of req) data += chunk;
        const body = data ? JSON.parse(data) : undefined;
        let value;
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
                (
                    await Promise.all(settings.enabledThemes.map(f => readFile(dir + "/" + f, "utf8").catch(() => "")))
                ).join("\n")
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
