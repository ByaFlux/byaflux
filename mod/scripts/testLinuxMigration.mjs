import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const dir = await mkdtemp(join(tmpdir(), "byaflux-linux-migration-"));
try {
    await build({ entryPoints: ["src/main/utils/migrateLinuxData.ts"], bundle: true, platform: "node", format: "esm", outfile: join(dir, "migration.mjs") });
    const { migrateLinuxData } = await import(pathToFileURL(join(dir, "migration.mjs")));
    const legacy = join(dir, "legacy"), stable = join(dir, "stable");
    await mkdir(join(legacy, "settings"), { recursive: true });
    await mkdir(join(legacy, "themes"), { recursive: true });
    await writeFile(join(legacy, "settings", "settings.json"), '{"plugins":{"FakeAccount":{"enabled":true}}}');
    await writeFile(join(legacy, "themes", "custom.theme.css"), "body{color:orange}");
    migrateLinuxData(stable, legacy);
    assert.equal(await readFile(join(stable, "settings", "settings.json"), "utf8"), await readFile(join(legacy, "settings", "settings.json"), "utf8"));
    assert.equal(await readFile(join(stable, "themes", "custom.theme.css"), "utf8"), "body{color:orange}");
    await writeFile(join(stable, "settings", "settings.json"), "new stable settings");
    migrateLinuxData(stable, legacy);
    assert.equal(await readFile(join(stable, "settings", "settings.json"), "utf8"), "new stable settings");
    assert.ok((await readFile(join(legacy, "settings", "settings.json"), "utf8")).includes("FakeAccount"));
    migrateLinuxData(join(dir, "fresh"), join(dir, "missing"));
    console.log("PASS Linux migration: settings/themes imported, existing stable files preserved, legacy files unchanged and fresh installs supported.");
} finally { await rm(dir, { recursive: true, force: true }); }
