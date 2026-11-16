import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectRelease } from '../mod/src/main/updater/byafluxRelease.ts';
const hash = 'a'.repeat(40);
const installed = 'b'.repeat(40);
const repo = 'example/ByaFlux';
const release = () => ({name: `ByaFlux ${hash}`, draft: false, prerelease: false, assets: [{name: 'desktop.asar', size: 1024, browser_download_url: `https://github.com/${repo}/releases/download/v0.1.0/desktop.asar`}]});
test('offers a published version different from installed', () => assert.equal(selectRelease(release(), installed, repo, 'desktop.asar').hash, hash));
test('does not offer installed version', () => assert.equal(selectRelease(release(), hash, repo, 'desktop.asar'), null));
test('ignores prereleases and drafts', () => {
    assert.equal(selectRelease({...release(), prerelease: true}, installed, repo, 'desktop.asar'), null);
    assert.equal(selectRelease({...release(), draft: true}, installed, repo, 'desktop.asar'), null);
});
test('rejects missing artifact and invalid commit metadata', () => {
    assert.throws(() => selectRelease({...release(), assets: []}, installed, repo, 'desktop.asar'));
    assert.throws(() => selectRelease({...release(), name: 'ByaFlux v1'}, installed, repo, 'desktop.asar'));
});
test('rejects an asset from another repository or origin', () => {
    const r = release(); r.assets[0].browser_download_url = 'https://github.com/Equicord/Equicord/releases/download/latest/desktop.asar';
    assert.throws(() => selectRelease(r, installed, repo, 'desktop.asar'));
    r.assets[0].browser_download_url = `https://example.com/${repo}/releases/download/latest/desktop.asar`;
    assert.throws(() => selectRelease(r, installed, repo, 'desktop.asar'));
});
