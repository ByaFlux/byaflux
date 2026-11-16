import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalog, userBadges } from '../mod/src/byafluxplugins/byaBadges/catalog.ts';
const sample = () => ({schemaVersion: 1, badges: {developer: {name:'Developer', description:'Equipe', icon:'icons/developer.svg'}}, users: {'123456789012345678': ['developer']}});

test('badges are selected per Discord ID, with no badges for unassigned users', () => {
    const catalog = validateCatalog(sample());
    assert.equal(userBadges(catalog, '123456789012345678')[0].name, 'Developer');
    assert.deepEqual(userBadges(catalog, '999999999999999999'), []);
});
test('rejects broken assignments, unsafe icon schemes and invalid user IDs', () => {
    const broken=sample(); broken.users['123456789012345678']=['missing'];
    assert.throws(() => validateCatalog(broken));
    for (const icon of ['javascript:alert(1)', 'http://example.com/a.png', 'file:///tmp/a.png', 'https://user:secret@example.com/a.png']) {
        const catalog=sample(); catalog.badges.developer.icon=icon;
        assert.throws(() => validateCatalog(catalog));
    }
    const invalid=sample(); invalid.users={'not-a-discord-id':['developer']};
    assert.throws(() => validateCatalog(invalid));
});
test('accepts new badge definitions without code changes and deduplicates assignments', () => {
    const catalog=sample(); catalog.badges.vip={name:'VIP',description:'VIP ByaFlux',icon:'https://example.com/vip.png'};
    catalog.users['123456789012345678']=['developer','vip','vip'];
    const parsed=validateCatalog(catalog);
    assert.deepEqual(userBadges(parsed,'123456789012345678').map(b => b.id),['developer','vip']);
});
