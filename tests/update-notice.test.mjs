import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(new URL("../mod/package.json", import.meta.url));
const ts = require("typescript");

function notices(readyImmediately = false) {
    const calls = [];
    let ready;
    const native = { show: (...args) => calls.push(args), dismiss() {} };
    const exports = {};
    const source = readFileSync(new URL("../mod/src/api/Notices.tsx", import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React }
    });
    runInNewContext(outputText, {
        exports,
        require(id) {
            if (id === "@webpack") return { waitFor(_filter, callback) {
                ready = () => callback(native);
                if (readyImmediately) ready();
            } };
            if (id === "@utils/react") return { isPrimitiveReactNode: () => true };
            if (id === "@components/ErrorBoundary") return {};
            throw new Error(`Unexpected import: ${id}`);
        }
    });
    return { api: exports, calls, ready: () => ready() };
}

test("holds an early banner until Discord's notices module is ready", () => {
    const { api, calls, ready } = notices();
    const action = () => {};
    api.showNotice("Nova versão", "Atualizar e reiniciar", action);
    assert.equal(calls.length, 0);
    assert.equal(api.currentNotice, null);
    ready();
    assert.equal(calls.length, 1);
    assert.deepEqual(Array.from(calls[0]), ["GENERIC", "Nova versão", "Atualizar e reiniciar", action, "EquicordNotice"]);
});

test("preserves queued banners and advances after dismissal", () => {
    const { api, calls, ready } = notices();
    api.showNotice("Primeiro", "OK", () => {});
    api.showNotice("Segundo", "OK", () => {});
    ready();
    assert.equal(calls.length, 1);
    api.nextNotice();
    assert.equal(calls[1][1], "Segundo");
    api.nextNotice();
    assert.equal(api.currentNotice, null);
});

test("also works when Discord's notices module is already loaded", () => {
    const { api, calls } = notices(true);
    api.showNotice("Nova versão", "Atualizar e reiniciar", () => {});
    assert.equal(calls.length, 1);
});

function updater({ outdated = true, disabled = false } = {}) {
    const banners = [];
    const errors = [];
    let updates = 0;
    let checks = 0;
    const source = readFileSync(new URL("../mod/src/Vencord.ts", import.meta.url), "utf8");
    const start = source.indexOf("let notifiedForUpdatesThisSession");
    const end = source.indexOf("async function init()", start);
    const run = runInNewContext(source.slice(start, end) + "\nrunUpdateCheck", {
        IS_UPDATER_DISABLED: disabled,
        Settings: { autoUpdate: true, autoUpdateNotification: false },
        checkForUpdates: async () => { checks++; return outdated; },
        updateAndRestart: async () => { updates++; },
        showNotice: (...args) => banners.push(args),
        showToast() {},
        UpdateLogger: { error: (...args) => errors.push(args) }
    });
    return { run, banners, errors, updates: () => updates, checks: () => checks };
}

test("offers one top banner and waits for a click even with legacy automatic settings", async () => {
    const app = updater();
    await app.run();
    await app.run();
    assert.equal(app.errors.length, 0);
    assert.equal(app.banners.length, 1);
    assert.equal(app.banners[0][1], "Atualizar e reiniciar");
    assert.equal(app.updates(), 0);
    app.banners[0][2]();
    assert.equal(app.updates(), 1);
});

test("does not show an update banner for an up-to-date or disabled build", async () => {
    for (const options of [{ outdated: false }, { disabled: true }]) {
        const app = updater(options);
        await app.run();
        assert.equal(app.banners.length, 0);
        assert.equal(app.updates(), 0);
        if (options.disabled) assert.equal(app.checks(), 0);
    }
});
