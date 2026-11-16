import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

function fixture(t, built = true) {
    const root = mkdtempSync(join(tmpdir(), 'byaflux-cli-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const mod = join(root, 'mod');
    const scripts = join(mod, 'scripts');
    mkdirSync(scripts, { recursive: true });
    for (const name of ['runInstaller.mjs', 'checkNodeVersion.js']) {
        copyFileSync(fileURLToPath(new URL(`../mod/scripts/${name}`, import.meta.url)), join(scripts, name));
    }
    if (built) {
        mkdirSync(join(mod, 'dist', 'desktop'), { recursive: true });
        writeFileSync(join(mod, 'dist', 'desktop', 'patcher.js'), '// fixture');
    }
    return { mod, run: args => spawnSync(process.execPath, [join(scripts, 'runInstaller.mjs'), '--', ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, BYAFLUX_INSTALLER_PATH: process.execPath }
    }) };
}

test('dev injector points the CLI at local code without a configured repository', t => {
    const { mod, run } = fixture(t);
    const result = run(['--eval', 'console.log(JSON.stringify({dev:process.env.EQUICORD_DEV_INSTALL,dir:process.env.EQUICORD_DIRECTORY,data:process.env.EQUICORD_USER_DATA_DIR}))']);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
        dev: '1', dir: join(mod, 'dist', 'desktop'), data: mod
    });
});

test('installer failures reach pnpm as a failure', t => {
    const { run } = fixture(t);
    assert.equal(run(['--eval', 'process.exit(7)']).status, 7);
});

test('missing build gets an actionable error before executing the CLI', t => {
    const { run } = fixture(t, false);
    const result = run(['--install']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /pnpm build/);
});

test('CLI version is available before building', t => {
    const { run } = fixture(t, false);
    const result = run(['--version']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^v\d+/);
});
