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
    assert.deepEqual(m.readSelection({ added: [b, b, "__proto__", null], hidden: 42 }), {
        added: [b],
        hidden: []
    });
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
    const guild = a,
        self = "6227436212982251533";
    const catalog = [
        { id: b, name: "Equipe", position: 50, hoist: true, color: 0xff8800 },
        { id: c, name: "Membro", position: 1 }
    ];
    const alice = Object.freeze({
        type: "MEMBER",
        user: Object.freeze({ id: "7227436212982251533", username: "Alice" }),
        roles: [b]
    });
    const zoe = Object.freeze({
        type: "MEMBER",
        user: Object.freeze({ id: "8227436212982251533", username: "Zoe" }),
        roles: [b]
    });
    const member = Object.freeze({ userId: self, nick: "Haru", roles: Object.freeze([c]) });
    const user = Object.freeze({ id: self, username: "haru" });
    const selfRow = Object.freeze({ type: "MEMBER", user, roles: member.roles });
    const source = Object.freeze({
        version: 1,
        listId: "channel",
        groups: Object.freeze([
            { id: b, count: 2 },
            { id: "online", count: 1 }
        ]),
        rows: Object.freeze([
            { type: "GROUP", id: b, count: 2 },
            alice,
            zoe,
            { type: "GROUP", id: "online", count: 1 },
            selfRow
        ])
    });
    const selected = { added: [b], hidden: [] };
    const projected = m.projectMemberList(source, guild, self, selected, catalog, member, user, "online");
    assert.deepEqual(projected.groups, [{ id: b, count: 3 }]);
    assert.deepEqual(projected.rows.filter(r => m.memberRowId(r)).map(m.memberRowId), [
        alice.user.id,
        self,
        zoe.user.id
    ]);
    assert.equal(projected.rows[1], alice);
    assert.equal(projected.rows[3], zoe);
    assert.deepEqual(projected.rows[2].roles, [b, c]);
    assert.equal(projected.rows[2].colorString, "#ff8800");
    assert.deepEqual(member.roles, [c]);
    assert.equal(source.groups[0].count, 2);
    assert.equal(source.rows.length, 5);
    const offline = m.projectMemberList(source, guild, self, selected, catalog, member, user, "offline");
    assert.equal(offline.groups.at(-1).id, "offline");
    assert.equal(offline.rows.at(-1).user.id, self);
    assert.equal(offline.rows.filter(r => m.memberRowId(r) === self).length, 1);
    const removed = m.projectMemberList(
        projected,
        guild,
        self,
        { added: [], hidden: [b] },
        catalog,
        { ...member, roles: [b, c] },
        user,
        "online"
    );
    assert.equal(removed.groups.at(-1).id, "online");
    const higher = { ...catalog[0], id: "9227436212982251533", name: "Owners", position: 99 };
    const created = m.projectMemberList(
        source,
        guild,
        self,
        { added: [higher.id], hidden: [] },
        [...catalog, higher],
        member,
        user,
        "online"
    );
    assert.equal(created.groups[0].id, higher.id);
    assert.equal(created.rows[0].id, higher.id);
    assert.equal(created.rows.filter(r => m.memberRowId(r) === self).length, 1);
    assert.deepEqual(
        m.sortedVisibleRoles([c], selected, catalog, guild).map(r => r.id),
        [b, c]
    );
    assert.equal(
        m.orderedRoles(
            [
                { id: "1000000000000000000", name: "A", position: 1 },
                { id: "999999999999999999", name: "B", position: 1 }
            ],
            guild
        )[0].name,
        "B"
    );
    const native = { getProps: () => source, getRows: () => source.rows, emitChange() {} };
    const oldProps = native.getProps,
        oldRows = native.getRows;
    let revision = 1,
        currentSelection = selected;
    const context = () => ({
        guildId: guild,
        userId: self,
        roles: catalog,
        selection: currentSelection,
        member,
        user,
        status: "online",
        revision
    });
    const dispose = m.bindMemberListStore(native, context);
    assert.equal(native.getProps(), native.getProps());
    assert.equal(native.getRows(), native.getProps().rows);
    currentSelection = undefined;
    revision++;
    assert.equal(native.getProps(), source);
    dispose();
    assert.equal(native.getProps, oldProps);
    assert.equal(native.getRows, oldRows);
    currentSelection = selected;
    const sections = source.groups.map(g => ({
        id: g.id,
        title: g.id,
        count: g.count,
        data: g.id === b ? [alice, zoe] : [selfRow]
    }));
    const sectionStore = { getSections: () => sections };
    const originalSections = sectionStore.getSections;
    const disposeSections = m.bindSectionListStore(sectionStore, context);
    assert.deepEqual(sectionStore.getSections()[0].data.map(m.memberRowId), [
        alice.user.id,
        self,
        zoe.user.id
    ]);
    assert.equal(sectionStore.getSections(), sectionStore.getSections());
    disposeSections();
    assert.equal(sectionStore.getSections, originalSections);
    console.log(
        "PASS FakeRoles: hierarchy, native tie break, hoisted groups, online/offline, live removal, counts, immutable real roles, stable snapshots and cleanup."
    );

    const modern = {
        id: b,
        name: "Owner",
        position: 100,
        hoist: true,
        color: 0,
        colors: { primary_color: 0xff6600, secondary_color: 0xffcc00 },
        unicodeEmoji: "👑"
    };
    const realMember = Object.freeze({
        userId: self,
        roles: Object.freeze([c]),
        hoistRoleId: c,
        highestRoleId: c,
        colorRoleId: c,
        iconRoleId: c,
        colorString: "#123456",
        colorStrings: { primaryColor: "#123456" }
    });
    const appearance = m.projectMember(
        realMember,
        selected,
        [modern, { id: c, name: "Member", position: 1 }],
        guild
    );
    assert.equal(appearance.hoistRoleId, b);
    assert.equal(appearance.highestRoleId, b);
    assert.equal(appearance.colorRoleId, b);
    assert.equal(appearance.iconRoleId, b);
    assert.equal(appearance.colorRoleName, "Owner");
    assert.equal(appearance.colorString, "#ff6600");
    assert.deepEqual(appearance.colorStrings, {
        primaryColor: "#ff6600",
        secondaryColor: "#ffcc00",
        tertiaryColor: undefined
    });
    assert.equal(realMember.iconRoleId, c);
    const cleared = m.projectMember(
        realMember,
        { added: [], hidden: [c] },
        [modern, { id: c, name: "Member", position: 1 }],
        guild
    );
    assert.equal(cleared.iconRoleId, undefined);
    assert.equal(cleared.hoistRoleId, undefined);
    assert.equal(cleared.colorStrings, null);
    const nativeSelf = { ...selfRow, id: "native-row-key", member: realMember, groupId: "online" };
    const keyed = {
        ...source,
        rowCount: 100,
        rows: source.rows.map(row => (row === selfRow ? nativeSelf : row))
    };
    const keyedProjection = m.projectMemberList(
        keyed,
        guild,
        self,
        selected,
        [modern, { id: c, name: "Member", position: 1 }],
        realMember,
        user,
        "online"
    );
    const own = keyedProjection.rows.find(row => m.memberRowId(row) === self);
    assert.equal(own.id, "native-row-key");
    assert.equal(own.groupId, b);
    assert.equal(own.member.hoistRoleId, b);
    assert.equal(own.iconRoleId, b);
    assert.equal(keyedProjection.rowCount, 99);
    const unread = { ...source, rows: source.rows.filter(row => row !== selfRow) };
    assert.equal(m.projectMemberList(unread, guild, self, selected, catalog, member, user, "online"), unread);
    let cachedRevision = 10,
        cachedSelection = selected;
    const virtualStore = { getProps: () => source, getRows: () => source.rows };
    const unbindVirtual = m.bindMemberListStore(virtualStore, () => ({
        guildId: guild,
        userId: self,
        selection: cachedSelection,
        roles: catalog,
        member,
        user,
        status: "online",
        revision: cachedRevision
    }));
    const firstVirtual = virtualStore.getProps();
    assert.equal(virtualStore.getProps(), firstVirtual);
    cachedRevision++;
    cachedSelection = { added: [], hidden: [c] };
    const nextVirtual = virtualStore.getProps();
    assert.ok(nextVirtual.version > firstVirtual.version);
    assert.equal(virtualStore.getProps(), nextVirtual);
    cachedRevision++;
    cachedSelection = selected;
    assert.ok(virtualStore.getProps().version > nextVirtual.version);
    unbindVirtual();
    assert.equal(virtualStore.getProps(), source);
    console.log(
        "PASS native FakeRoles: current metadata, gradients, icon selection/clearing, native row keys, row counts, unloaded rows and monotonic virtual-list versions."
    );

    const freshStore = {
        getProps: () => ({ ...source, rows: [...source.rows] }),
        getRows: () => [...source.rows]
    };
    const unbindFresh = m.bindMemberListStore(freshStore, () => ({
        guildId: guild,
        userId: self,
        selection: selected,
        roles: catalog,
        member,
        user,
        status: "online",
        revision: 200
    }));
    assert.equal(freshStore.getProps(), freshStore.getProps());
    unbindFresh();
    const pluginSource = await readFile("src/byafluxplugins/fakeRoles/index.tsx", "utf8");
    assert.ok(
        !/GuildMemberStore\.[\w]+\s*=|PermissionStore|\.dispatch\(|\.patch\(|\.put\(/.test(pluginSource)
    );
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
