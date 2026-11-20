import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
const dir = await mkdtemp(join(tmpdir(), "byaflux-linux-"));
try {
    await build({
        entryPoints: ["src/main/updater/byafluxRelease.ts"],
        bundle: true,
        platform: "node",
        format: "esm",
        outfile: join(dir, "channel.mjs")
    });
    const { selectLinuxRelease, selectRelease } = await import(pathToFileURL(join(dir, "channel.mjs")));
    const hash = "a".repeat(40),
        repo = "ByaFlux/byaflux",
        tag = "linux-dev-v0.1.12.1";
    const release = {
        name: "ByaFlux for Linux (dev-version) " + hash,
        tag_name: tag,
        prerelease: true,
        draft: false,
        assets: [
            {
                name: "desktop.asar",
                size: 100,
                browser_download_url: `https://github.com/${repo}/releases/download/${tag}/desktop.asar`
            }
        ]
    };
    const stable = { ...release, tag_name: "v9.0.0", prerelease: false };
    const mobile = { ...release, tag_name: "mobile-v9.0.0" };
    const incomplete = { ...release, assets: [] };
    const draft = { ...release, draft: true };
    assert.equal(selectLinuxRelease([stable, mobile, incomplete, draft, release]), release);
    assert.equal(selectLinuxRelease([stable, mobile, incomplete, draft]), undefined);
    assert.equal(selectRelease(release, "b".repeat(40), repo, "desktop.asar"), null);
    assert.equal(selectRelease(release, hash, repo, "desktop.asar", true), null);
    assert.equal(selectRelease(release, "b".repeat(40), repo, "desktop.asar", true).hash, hash);
    assert.throws(() =>
        selectRelease(
            { ...release, assets: [{ ...release.assets[0], browser_download_url: "https://example.com/evil" }] },
            "b".repeat(40),
            repo,
            "desktop.asar",
            true
        )
    );
    console.log(
        "PASS Linux release selection: isolated prerelease channel, stable/mobile rejection, incomplete/draft handling, update hash and asset origin."
    );
} finally {
    await rm(dir, { recursive: true, force: true });
}
