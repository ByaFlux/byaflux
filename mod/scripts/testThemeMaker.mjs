/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

const temp = await mkdtemp(join(tmpdir(), "byaflux-ctm-test-"));
try {
    await build({
        entryPoints: {
            model: "src/shared/themeMaker/index.ts",
            storage: "src/main/themes/themeMaker.ts",
            service: "src/components/settings/tabs/themeMaker/service.ts",
            headers: "src/main/themes/index.ts"
        },
        bundle: true,
        platform: "node",
        format: "esm",
        outdir: temp,
        outExtension: { ".js": ".mjs" },
        logLevel: "silent"
    });
    const model = await import(pathToFileURL(join(temp, "model.mjs")));
    const { saveCtmTheme, listCtmThemes } = await import(pathToFileURL(join(temp, "storage.mjs")));
    const { saveAndActivateTheme } = await import(pathToFileURL(join(temp, "service.mjs")));
    const { getThemeInfo } = await import(pathToFileURL(join(temp, "headers.mjs")));
    let checks = 0;
    const check = fn => {
        fn();
        checks++;
    };
    const doc = (choices = model.defaults()) => ({
        schema: 1,
        id: "12345678-abcd-abcd-abcd-123456789012",
        name: "Haru Midnight",
        choices
    });
    check(() => assert.deepEqual(model.defaults().status.widths, [2, 3, 4]));
    check(() => assert.deepEqual(model.defaults().status.gaps, [2, 3, 4]));
    check(() => assert.equal(model.defaults().status.colors.online, "#43b581"));
    for (const pack of model.EMOJI_PACKS) {
        const c = model.defaults();
        c.emoji = pack;
        const css = model.generateTheme(doc(c));
        check(() => assert.equal((css.match(/EmojiReplace\/base\//g) || []).length, pack === "Discord" ? 0 : 1));
        if (pack !== "Discord") check(() => assert.ok(css.includes("/base/" + pack + ".css")));
        check(() => assert.deepEqual(model.parseTheme(css), doc(c)));
    }
    for (const shape of model.ICON_SHAPES) {
        const c = model.defaults();
        c.icons.shape = shape;
        const css = model.generateTheme(doc(c));
        check(() => assert.equal(css.includes("clip-path:"), shape !== "native"));
        if (shape !== "native") check(() => assert.ok(css.includes(model.iconClip(shape, 16))));
    }
    for (const mode of ["normal", "radial"]) {
        const c = model.defaults();
        c.status.mode = mode;
        const css = model.generateTheme(doc(c));
        check(() => assert.equal(css.includes(model.RADIAL_URL), mode === "radial"));
        if (mode === "radial") {
            check(() => assert.ok(css.indexOf("@import") < css.indexOf(":root")));
            check(() => assert.ok(css.includes("--rs-small-spacing: 2px")));
            check(() => assert.ok(css.includes("--rs-large-width: 4px")));
        }
    }
    // New controls must survive round-trip and old saved themes must still open.
    for (const font of Object.keys(model.FONTS)) {
        const choices = model.defaults();
        choices.typography = { font, size: 20, lineHeight: 1.8, weight: 500 };
        choices.palette.chat = "#121820";
        choices.layout = { sidebarWidth: 320, messageGap: 24, radius: 12 };
        const css = model.generateTheme(doc(choices));
        check(() => assert.deepEqual(model.parseTheme(css), doc(choices)));
        check(() => assert.ok(css.includes("--byaflux-ctm-font-size: 20px")));
        check(() => assert.ok(css.includes("--background-base-low: #121820 !important")));
        check(() => assert.equal(css.includes("fonts.googleapis.com"), !!model.FONTS[font].url));
    }
    const legacy = model.defaults();
    delete legacy.palette;
    delete legacy.typography;
    delete legacy.layout;
    const legacyCss = "/**\n * @byafluxCTM " + encodeURIComponent(JSON.stringify(doc(legacy))) + "\n */";
    check(() => assert.deepEqual(model.parseTheme(legacyCss).choices, model.defaults()));
    for (const patch of [
        { typography: { ...model.defaults().typography, font: "invalid; color: red" } },
        { typography: { ...model.defaults().typography, size: 99 } },
        { typography: { ...model.defaults().typography, lineHeight: 0 } },
        { layout: { ...model.defaults().layout, sidebarWidth: -10 } },
        { palette: { ...model.defaults().palette, chat: "red; background:url(x)" } }
    ])
        check(() => assert.throws(() => model.validateChoices({ ...model.defaults(), ...patch })));
    const combo = model.defaults();
    combo.emoji = "Microsoft-3D";
    combo.status.mode = "radial";
    combo.icons.shape = "triangle";
    combo.background = {
        enabled: true,
        url: "https://example.com/fundo.png?name=%22x%22",
        opacity: 70
    };
    combo.compact = true;
    const all = model.generateTheme(doc(combo));
    check(() => assert.equal((all.match(/@import/g) || []).length, 2));
    check(() => assert.ok(all.lastIndexOf("@import") < all.indexOf(":root")));
    check(() => assert.ok(all.includes("Gibbu") && all.includes("DevilBro")));
    check(() => assert.equal(getThemeInfo(all, "Haru Midnight.theme.css").name, "Haru Midnight"));
    check(() => assert.deepEqual(model.parseTheme(all), doc(combo)));
    for (const name of [
        "",
        "../escape",
        "a/b",
        "a\\b",
        "CON",
        "NUL.txt",
        "LPT1",
        "a*",
        "a?",
        "x\n@import",
        "nome.",
        " nome",
        "nome ",
        "a".repeat(65)
    ])
        check(() => assert.throws(() => model.validateName(name)));
    for (const patch of [
        { accent: "#fff; color:red" },
        { emoji: "apple" },
        { emoji: "Microsoft3D" },
        { background: { enabled: true, url: "javascript:alert(1)", opacity: 75 } }
    ])
        check(() => assert.throws(() => model.validateChoices({ ...model.defaults(), ...patch })));
    const dir = join(temp, "themes");
    await mkdir(dir);
    await writeFile(join(dir, "Other.theme.css"), "/**\n * @name Outro tema\n */\n:root { color:red; }");
    const created = await saveCtmTheme(dir, { name: "Haru Midnight", choices: combo });
    const oldFile = created.fileName;
    const duplicate = await saveCtmTheme(dir, { name: "haru midnight", choices: model.defaults() });
    check(() => assert.notEqual(duplicate.fileName.toLowerCase(), oldFile.toLowerCase()));
    const simultaneous = await Promise.all(
        Array.from({ length: 3 }, () => saveCtmTheme(dir, { name: "Concorrente", choices: model.defaults() }))
    );
    check(() => assert.equal(new Set(simultaneous.map(s => s.fileName)).size, 3));
    const edited = await saveCtmTheme(dir, {
        name: "Laranja noturna",
        choices: { ...combo, accent: "#ff5500" },
        editing: { fileName: created.fileName, id: created.document.id, revision: created.revision }
    });
    check(() => assert.equal(edited.fileName, created.fileName));
    check(() => assert.equal(edited.document.id, created.document.id));
    const restored = model.parseTheme(await readFile(join(dir, oldFile), "utf8"));
    check(() => assert.equal(restored.name, "Laranja noturna"));
    check(() => assert.equal(restored.choices.accent, "#ff5500"));
    await assert.rejects(() =>
        saveCtmTheme(dir, {
            name: "Conflict",
            choices: model.defaults(),
            editing: { fileName: oldFile, id: created.document.id, revision: created.revision }
        })
    );
    checks++;
    await assert.rejects(() =>
        saveCtmTheme(dir, {
            name: "Invalid",
            choices: model.defaults(),
            editing: {
                fileName: "../outside.theme.css",
                id: created.document.id,
                revision: edited.revision
            }
        })
    );
    checks++;
    const restart = spawnSync(
        process.execPath,
        [
            "--input-type=module",
            "-e",
            `import {listCtmThemes} from ${JSON.stringify(pathToFileURL(join(temp, "storage.mjs")).href)};console.log(JSON.stringify(await listCtmThemes(${JSON.stringify(dir)})));`
        ],
        { encoding: "utf8" }
    );
    check(() => assert.equal(restart.status, 0, restart.stderr));
    const reloaded = JSON.parse(restart.stdout);
    check(() => assert.deepEqual(reloaded.find(t => t.fileName === oldFile).document, edited.document));
    check(() => assert.ok(!reloaded.some(t => t.fileName === "Other.theme.css")));
    const settings = {
        enabledThemes: ["Other.theme.css", oldFile],
        themeActivationModes: { "Other.theme.css": "dark" }
    };
    const adapter = {
        getCtmThemes: () => listCtmThemes(dir),
        saveCtmTheme: request => saveCtmTheme(dir, request)
    };
    const saved = await saveAndActivateTheme(adapter, settings, {
        name: "Tema final",
        choices: combo
    });
    check(() => assert.deepEqual(settings.enabledThemes, ["Other.theme.css", saved.fileName]));
    check(() => assert.equal(settings.themeActivationModes["Other.theme.css"], "dark"));
    check(() => assert.equal(settings.themeActivationModes[saved.fileName], "always"));
    const before = JSON.stringify(settings);
    await assert.rejects(() =>
        saveAndActivateTheme(
            {
                ...adapter,
                saveCtmTheme: async () => {
                    throw Error("disk full");
                }
            },
            settings,
            { name: "Fail", choices: combo }
        )
    );
    check(() => assert.equal(JSON.stringify(settings), before));
    let release;
    const written = new Promise(resolve => {
        release = resolve;
    });
    const inFlight = saveAndActivateTheme(
        {
            ...adapter,
            saveCtmTheme: async request => {
                await written;
                return adapter.saveCtmTheme(request);
            }
        },
        settings,
        { name: "Aguardando disco", choices: model.defaults() }
    );
    check(() => assert.equal(JSON.stringify(settings), before));
    release();
    await inFlight;
    console.log(
        `PASS CTM: ${checks} checks; all shapes, status modes and emoji packs; collision safety, concurrent writes, editing, restart persistence and activation order.`
    );
} finally {
    await rm(temp, { recursive: true, force: true });
}
