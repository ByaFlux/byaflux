/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

const directory = await mkdtemp(join(tmpdir(), "byaflux-iconmaker-"));
try {
    await build({
        entryPoints: {
            animation: "src/shared/iconMaker/animation.ts",
            model: "src/shared/iconMaker/index.ts",
            render: "src/shared/iconMaker/render.ts"
        },
        bundle: true,
        format: "esm",
        platform: "node",
        outdir: directory,
        outExtension: { ".js": ".mjs" },
        logLevel: "silent"
    });
    const model = await import(pathToFileURL(join(directory, "model.mjs"))),
        { renderIcon } = await import(pathToFileURL(join(directory, "render.mjs")));
    let checks = 0;
    const check = assertion => {
        assertion();
        checks++;
    };
    const original = model.defaultProject();
    const { catalog, sampleAnimation } = await import(pathToFileURL(join(directory, "animation.mjs")));
    check(() => assert.equal(Object.keys(model.BODIES).length, 33));
    check(() => assert.equal(Object.keys(model.EYES).length, 32));
    check(() => assert.equal(Object.keys(model.MOTIONS).length, 13));
    check(() => assert.equal(Object.keys(model.EFFECTS).length, 13));
    for (const style of [catalog.modern, catalog.classic]) {
        for (const body of Object.keys(model.BODIES)) check(() => assert.ok(style.bodies[body]));
        for (const eye of Object.keys(model.EYES)) {
            check(() => assert.ok(style.eyes[eye] && style.cuts[eye]));
            check(() =>
                assert.notEqual(
                    renderIcon({ ...original, eyes: eye, eyeAuto: true }),
                    renderIcon({ ...original, eyes: eye, eyeAuto: false })
                )
            );
        }
    }
    check(() =>
        assert.ok(
            !/<script|onload=|https?:|<foreignObject/i.test(
                JSON.stringify([catalog.modern, catalog.classic, catalog.effects])
            )
        )
    );
    const migrated = model.validateProject({
        ...original,
        schema: 1,
        body: "cat",
        eyes: "hearts",
        motion: "float",
        effect: "rays",
        speed: 2
    });
    check(() => assert.equal(migrated.schema, 2));
    check(() => assert.equal(migrated.body, "cat"));
    check(() => assert.equal(migrated.eyes, "heart-eyes"));
    check(() => assert.equal(migrated.duration, 1));
    check(() => assert.equal(migrated.eyeAuto, false));
    check(() => assert.equal(migrated.bodyColor, original.bodyColor));
    check(() => assert.equal(sampleAnimation("rotate-linear-animation", 0.5, true).rotate, 180));
    check(() => assert.deepEqual(model.validateProject(JSON.parse(JSON.stringify(original))), original));
    const bodyShapes = new Set();
    for (const body of Object.keys(model.BODIES))
        for (const classic of [true, false]) {
            const svg = renderIcon({ ...original, body, classic });
            check(() => assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')));
            bodyShapes.add(svg);
        }
    check(() => assert.equal(bodyShapes.size, Object.keys(model.BODIES).length * 2));
    const eyes = new Set(Object.keys(model.EYES).map(eye => renderIcon({ ...original, eyes: eye })));
    check(() => assert.equal(eyes.size, Object.keys(model.EYES).length));
    for (const motion of Object.keys(model.MOTIONS)) {
        const project = { ...original, mode: "animated", motion };
        check(() =>
            assert.equal(
                renderIcon(project, 0) === renderIcon(project, motion === "blink" ? 0.5 : 0.23),
                motion === "none"
            )
        );
        check(() => assert.equal(renderIcon(project, 0), renderIcon(project, 1)));
    }
    for (const effect of Object.keys(model.EFFECTS)) {
        const project = { ...original, mode: "animated", effect, motion: "none" };
        check(() => assert.equal(renderIcon(project, 0) === renderIcon(project, 0.23), effect === "none"));
    }
    check(() => assert.equal(renderIcon(original, 0), renderIcon(original, 0.7)));
    check(() =>
        assert.notEqual(
            renderIcon({ ...original, mode: "animated", effect: "hearts-effect", effectLayer: "front" }),
            renderIcon({ ...original, mode: "animated", effect: "hearts-effect", effectLayer: "behind" })
        )
    );
    check(() =>
        assert.deepEqual(model.animationTiming({ ...original, duration: 3, fps: 20 }), {
            frames: 60,
            delay: 50,
            duration: 3000
        })
    );
    for (const duration of [1, 3, 5])
        for (const fps of [12, 20, 24]) {
            const timing = model.animationTiming({ ...original, duration, fps });
            check(() => assert.ok(timing.frames >= 12 && timing.frames <= 120 && timing.delay >= 20));
        }
    for (const name of ["../escape", "a/b", "a\\b", "CON", "NUL.txt", "", "arquivo.", "a".repeat(65)])
        check(() => assert.throws(() => model.exportName(name)));
    check(() => assert.equal(model.exportName("  Meu ícone  "), "Meu ícone"));
    for (const patch of [
        { bodyColor: 'red"/><script/>' },
        { foregroundImage: "https://example.com/a.png" },
        { backgroundImage: "data:image/svg+xml,<svg/>" },
        { scale: -1 },
        { gifSize: 4096 },
        { motion: "fake" },
        { duration: NaN },
        { classic: "true" },
        { schema: 3 }
    ])
        check(() => assert.throws(() => model.validateProject({ ...original, ...patch })));
    check(() => assert.throws(() => renderIcon(original, 0, 'x" onload="1')));
    check(() => assert.throws(() => renderIcon(original, Infinity)));
    check(() => assert.throws(() => renderIcon(original, 0, "safe", 4096)));
    const random = model.randomProject(original, () => 0.25);
    check(() => assert.deepEqual(model.validateProject(random), random));
    check(() => assert.equal(random.mode, original.mode));
    console.log(
        `PASS IconMaker: ${checks} checks; both silhouette styles, all bodies, eyes, motions, effects, loop seams, bounded GIF timing and input validation.`
    );
} finally {
    await rm(directory, { recursive: true, force: true });
}
