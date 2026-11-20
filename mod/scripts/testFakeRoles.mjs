/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const dir = await mkdtemp(join(tmpdir(), "fake-roles-"));
try {
    await build({
        entryPoints: ["src/byafluxplugins/fakeRoles/model.ts"],
        bundle: true,
        format: "esm",
        platform: "node",
        outfile: join(dir, "model.mjs")
    });
    const m = await import(pathToFileURL(join(dir, "model.mjs")));
    const a = "1227436212982251533",
        b = "2227436212982251533",
        c = "3227436212982251533";
    const real = Object.freeze([a]);
    let value = m.emptyRoles();
    assert.deepEqual(m.visibleRoles(real, value, [a, b, c]), [a]);
    value = m.toggleRole(real, value, b, true);
    assert.deepEqual(m.visibleRoles(real, value, [a, b, c]), [a, b]);
    value = m.toggleRole(real, value, a, false);
    assert.deepEqual(m.visibleRoles(real, value, [a, b, c]), [b]);
    assert.deepEqual(m.visibleRoles([...real, c], value, [a, b, c]), [c, b]);
    assert.deepEqual(m.visibleRoles(real, value, [a, c]), []);
    value = m.toggleRole(real, value, a, true);
    value = m.toggleRole(real, value, b, false);
    assert.deepEqual(value, m.emptyRoles());
    assert.deepEqual(real, [a]);
    assert.deepEqual(m.visibleRoles(real, undefined, []), [a]);
    assert.notEqual(m.roleKey(a, b), m.roleKey(b, a));
    assert.notEqual(m.roleKey(a, b), m.roleKey(a, c));
    assert.deepEqual(m.readSelection({ added: [b, b, "__proto__", null], hidden: 42 }), { added: [b], hidden: [] });
    const roles = Object.freeze([
        { id: a, name: "everyone", position: 0 },
        { id: b, name: "bot", position: 10, managed: true },
        { id: c, name: "owner", position: 100 }
    ]);
    assert.deepEqual(
        m.orderedRoles(roles, a).map(x => x.id),
        [c, b]
    );
    assert.equal(m.roleColour({ color: 0xff8800 }), "#ff8800");
    assert.equal(m.roleColour({ colorString: "javascript:bad" }), "#99aab5");
    const source = await readFile("src/byafluxplugins/fakeRoles/index.tsx", "utf8");
    assert.ok(!/GuildMemberStore\.[\w]+\s*=|PermissionStore|\.dispatch\(|\.patch\(|\.put\(/.test(source));
    const fixture =
        "function Profile(e){let{member:t,guildId:n}=e;return jsx(RoleList,{member:t,id:n.id,spacing:14,})}";
    const patched = fixture.replace(
        /(let\{member:[a-zA-Z_$][\w$]*[^}]*\}=)([a-zA-Z_$][\w$]*)(?=[,;])/,
        "$1plugin.useVisualProfile($2)"
    );
    assert.ok(patched.includes("}=plugin.useVisualProfile(e);"));
    console.log(
        "PASS FakeRoles: local roles, removal, restoration, live server changes, deleted roles, managed roles, account/server isolation, immutable source and display-only patch."
    );
} finally {
    await rm(dir, { recursive: true, force: true });
}
