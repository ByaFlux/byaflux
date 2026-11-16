import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isByaFluxPlugin } from '../mod/src/shared/byafluxPlugins.ts';

test('own plugin badge and filter do not classify external or upstream plugins as ByaFlux', () => {
    assert.equal(isByaFluxPlugin('src/byafluxplugins/newPlugin'), true);
    assert.equal(isByaFluxPlugin('src/byafluxplugins/_core/corePlugin'), true);
    assert.equal(isByaFluxPlugin('src/userplugins/ByaFluxInfo'), false);
    assert.equal(isByaFluxPlugin('src/equicordplugins/plugin'), false);
    assert.equal(isByaFluxPlugin(undefined), false);
});

test('build loader registers own plugins and userplugins independently and exposes the local installer', async () => {
    process.env.EQUICORD_HASH ??= '0'.repeat(40);
    const { globPlugins } = await import('../mod/scripts/build/common.mjs');
    const directory = mkdtempSync(join(tmpdir(), 'byaflux-folders-'));
    const originalCwd = process.cwd();
    try {
        for (const folder of ['byafluxplugins/own', 'byafluxplugins/_core/core', 'userplugins/external', 'equicordplugins/userpluginInstaller.dev']) {
            mkdirSync(join(directory, 'src', folder), { recursive: true });
            writeFileSync(join(directory, 'src', folder, 'index.ts'), `export default definePlugin({ name: "${folder.split('/').at(-1)}", description: "fixture", authors: [] });`);
        }
        process.chdir(directory);
        let load;
        globPlugins('discordDesktop').setup({ onResolve() {}, onLoad(_options, callback) { load = callback; } });
        const output = await load();
        assert.match(output.contents, /"folderName":"src\/byafluxplugins\/own","userPlugin":false/);
        assert.match(output.contents, /"folderName":"src\/byafluxplugins\/_core\/core","userPlugin":false/);
        assert.match(output.contents, /"folderName":"src\/userplugins\/external","userPlugin":true/);
        assert.match(output.contents, /"folderName":"src\/equicordplugins\/userpluginInstaller.dev","userPlugin":false/);
    } finally {
        process.chdir(originalCwd);
        rmSync(directory, { recursive: true, force: true });
    }
});
