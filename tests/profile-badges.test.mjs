import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeProfileBadges, profileBadgeUpdatesPatch } from '../mod/src/plugins/_api/badges/profile.ts';

test('profile row merges current custom badges first and removes obsolete cached revisions', () => {
    const current = [{id:'byaflux_developer_3'}, {id:'byaflux_supporter_3'}, {id:'other-mod'}];
    const native = [{id:'nitro'}, {id:'byaflux_developer_2'}, {id:'other-mod'}, {id:'hypesquad'}];
    assert.deepEqual(mergeProfileBadges(current,native).map(b=>b.id),
        ['byaflux_developer_3','byaflux_supporter_3','other-mod','nitro','hypesquad']);
    assert.deepEqual(mergeProfileBadges([],native).map(b=>b.id), ['nitro','other-mod','hypesquad']);
});

test('current Discord profile row subscribes to updates and merges badges before display ordering', () => {
    let source = 'function row(n,f){let N=(0,o.d)({location:"UserProfileBadgeListRows"}),R=(0,_.A)(n,f),{pendingBadgeDisplayOrder:L}=c;return R}';
    for(const {match,replace} of profileBadgeUpdatesPatch.replacement) {
        const canonical = new RegExp(match.source.replaceAll('\\i','(?:[A-Za-z_$][\\w$]*)'),match.flags);
        assert.ok(canonical.test(source));
        source=source.replace(canonical,replace.replaceAll('$self','BadgeAPI'));
    }
    let subscriptions=0;
    const native=[{id:'nitro'}], custom=[{id:'byaflux_developer_1'}];
    const api={useBadgeUpdates(){subscriptions++;},mergeProfileBadges(_profile,badges){return mergeProfileBadges(custom,badges);}};
    const row=new Function('o','_','c','BadgeAPI',source+';return row;')({d:()=>true},{A:()=>native},{pendingBadgeDisplayOrder:[]},api);
    assert.deepEqual(row({userId:'assigned'},null).map(b=>b.id),['byaflux_developer_1','nitro']);
    assert.equal(subscriptions,1);
});
