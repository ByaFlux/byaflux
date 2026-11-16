import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { build } = createRequire(new URL('../mod/package.json', import.meta.url))('esbuild');

async function badgeApi() {
    const mocks = {
        '@components/ErrorBoundary': 'export default {wrap:component=>component};',
        '@equicordplugins/globalBadges': 'export default {name:"GlobalBadges",getGlobalBadges:()=>[{id:"global"}]};',
        '@plugins/_api/badges': 'export default {getDonorBadges:()=>[{id:"vencord-donor"}],getEquicordDonorBadges:()=>[{id:"equicord-donor"}]};',
        './PluginManager': 'export const isPluginEnabled=()=>true;'
    };
    const output = await build({
        entryPoints: [fileURLToPath(new URL('../mod/src/api/Badges.ts', import.meta.url))],
        bundle: true, format: 'esm', platform: 'node', write: false,
        plugins: [{name:'mock-badge-sources',setup(b){
            b.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);
            b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path]}));
        }}]
    });
    return import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
}

test('FIRST badges precede donor, global and other plugin badges while preserving catalog order', async () => {
    const api = await badgeApi();
    const ordinary = {id:'ordinary',position:api.BadgePosition.START};
    const byaflux = {id:'byaflux',position:api.BadgePosition.FIRST,getBadges:({userId})=>
        userId==='assigned' ? [{id:'developer'},{id:'supporter'}] : []};
    api.addProfileBadge(ordinary);
    api.addProfileBadge(byaflux);
    assert.deepEqual(api._getBadges({userId:'assigned',guildId:''}).map(b=>b.id),
        ['developer','supporter','equicord-donor','vencord-donor','global','ordinary']);
    assert.deepEqual(api._getBadges({userId:'unassigned',guildId:''}).map(b=>b.id),
        ['equicord-donor','vencord-donor','global','ordinary']);
    api.removeProfileBadge(byaflux);
    api.removeProfileBadge(ordinary);
});
