import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../mod/node_modules/esbuild/lib/main.js';
const { outputFiles } = await build({ entryPoints: ['mod/src/byafluxplugins/profileBadges/local.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { applyLocalBadges, accountPatch, profilePatch } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const self = '1227436212982251533';
const selection = { selectedBadges: ['staff', 'nitro', 'boost'], nitroLevel: 'gold', boostLevel: '24m' };
const canonical = regex => new RegExp(regex.source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)'), regex.flags);

test('local badges never change another user or an unauthenticated profile', () => {
    const badges = [{ id: 'real' }];
    assert.equal(applyLocalBadges('other', self, badges, selection), badges);
    assert.equal(applyLocalBadges(undefined, undefined, badges, selection), badges);
    assert.equal(applyLocalBadges(self, 'new-account', badges, selection), badges);
});

test('replaces selected badge visuals without changing native data or project badges', () => {
    const badges = [{ id: 'byaflux_developer_1' }, { id: 'real-nitro', iconSrc: 'https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png' }];
    const before = structuredClone(badges);
    const result = applyLocalBadges(self, self, badges, selection);
    assert.deepEqual(result.map(b => b.id), ['byaflux_developer_1', 'byaflux-local-staff', 'byaflux-local-nitro', 'byaflux-local-boost']);
    assert.match(result[2].iconSrc, /2895086c18d5531d499862e41d1155a6/);
    assert.deepEqual(badges, before);
    assert.deepEqual(applyLocalBadges(self, self, badges).map(b => b.id), badges.map(b => b.id));
    assert.deepEqual(applyLocalBadges(self, self, result, selection), result);
});

test('account action is a sibling immediately after Orbs, outside its visibility condition', () => {
    const source = 'function menu(close,enabled){return ["badges","clips",enabled&&jsx(Orbs,{popoutContainerRef:p,scrollerRef:s,shouldScrollIntoView:v,onCloseAccountPopout:close})]})})';
    const regex = canonical(accountPatch.replacement.match);
    assert.ok(regex.test(source));
    const result = source.replace(regex, accountPatch.replacement.replace.replaceAll('$self', 'plugin'));
    assert.match(result, /onCloseAccountPopout:close\}\),plugin.renderAccountAction\(close\)\]/);
});

test('profile patch uses the profile user ID and preserves native array for other users', () => {
    const source = 'function row(props){return memo(()=>{let e=badges;if(null!=pending){let t=new Set(badges.map(e=>e.id));e=[...e,...pending.filter(e=>!t.has(e.id))]}return e})}';
    const regex = canonical(profilePatch.replacement.match);
    assert.ok(regex.test(source));
    const patched = source.replace(regex, profilePatch.replacement.replace.replaceAll('$self', 'plugin'));
    const badges = [{ id: 'native' }];
    const row = new Function('memo','badges','pending','plugin',patched+';return row;')(fn=>fn(),badges,null,{applyLocalBadges:(userId, native)=>applyLocalBadges(userId,self,native,selection)});
    assert.equal(row({displayProfile:{userId:'other'}}), badges);
    assert.ok(row({displayProfile:{userId:self}}).some(b => b.id === 'byaflux-local-staff'));
});
