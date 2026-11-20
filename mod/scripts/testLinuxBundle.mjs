import assert from "node:assert/strict";
import { extractFile } from "@electron/asar";
const renderer = extractFile("dist/desktop.asar", "renderer.js").toString();
const main = extractFile("dist/desktop.asar", "patcher.js").toString();
assert.ok(renderer.includes("ByaFlux for Linux (dev-version)"));
assert.ok(main.includes("linux-dev-v") && main.includes("ByaFluxLinuxDev"));
for (const plugin of ["FakeRoles", "FakeBadges", "FakeAccount", "FakeDeafen", "FollowUser", "FollowMe", "ByaBadges"])
    assert.ok(renderer.includes(plugin), `Missing ByaFlux plugin: ${plugin}`);
assert.ok(main.includes("/releases?per_page=50"));
console.log("PASS Linux bundle: dev identity, isolated data and updates, native ByaFlux plugins present.");
