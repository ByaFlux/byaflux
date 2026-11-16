import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { build } = createRequire(new URL('../mod/package.json', import.meta.url))('esbuild');
const catalog = {schemaVersion:1,badges:{developer:{name:'Developer',description:'Equipe',icon:'icons/developer.svg'}},users:{'123456789012345678':['developer']}};
async function compile(entry, source) {
    const modules = {
        './generated': `export const BADGES_URL=${JSON.stringify(source)};`,
        '@api/Badges': 'export const BadgePosition={START:0,END:1,FIRST:2}; export function notifyBadgeUpdates(){globalThis.__byaNotifications=(globalThis.__byaNotifications??0)+1}; export function subscribeToBadgeUpdates(){return ()=>{}}; export const getBadgeRevision=()=>0; export const addProfileBadge=b=>globalThis.__byaRegistry.add(b); export const removeProfileBadge=b=>globalThis.__byaRegistry.delete(b);',
        '@api/DataStore': 'export async function get(){ return globalThis.__byaCache; }; export async function set(_key,value){globalThis.__byaCache=value};',
        '@components/Button': 'export function Button(){}',
        '@components/Paragraph': 'export function Paragraph(){}',
        '@shared/byaflux': 'export const BYAFLUX_ICON="logo";',
        '@utils/Logger': 'export class Logger {warn(){} error(){}}',
        '@utils/types': 'export default x=>x;',
        '@webpack/common': 'export const React={}; export const UserStore={getCurrentUser:()=>({id:"123456789012345678"})}; export function showToast(){};'
    };
    const result=await build({entryPoints:[fileURLToPath(new URL(`../mod/src/byafluxplugins/byaBadges/${entry}`,import.meta.url))],bundle:true,write:false,format:'esm',platform:'node',plugins:[{
        name:'test-runtime',setup(b){
            b.onResolve({filter:/.*/},args=>Object.hasOwn(modules,args.path)?{path:args.path,namespace:'fixture'}:undefined);
            b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:modules[args.path]}));
        }
    }]});
    return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}

test('ByaBadges is required, registers actual profile badges, and removes its provider on stop', async t => {
    globalThis.__byaRegistry=new Set();
    globalThis.__byaCache={source:'https://example.test/badges.json',catalog};
    globalThis.VencordNative={pluginHelpers:{ByaBadges:{fetchCatalog:async()=>catalog}}};
    t.after(()=>{delete globalThis.__byaRegistry;delete globalThis.VencordNative;delete globalThis.__byaCache;});
    const {default:plugin}=await compile('index.tsx','https://example.test/badges.json');
    assert.equal(plugin.required,true);assert.equal(plugin.enabledByDefault,true);
    assert.ok(plugin.dependencies.includes('BadgeAPI'));
    await plugin.start();
    assert.equal(globalThis.__byaRegistry.size,1);
    const [provider]=globalThis.__byaRegistry;
    assert.equal(provider.position, 2);
    const badges=provider.getBadges({userId:'123456789012345678',guildId:''});
    assert.equal(badges[0].name,'Developer');assert.equal(badges[0].infoLabel,'ByaFlux');
    assert.deepEqual(provider.getBadges({userId:'999999999999999999',guildId:''}),[]);
    plugin.stop();assert.equal(globalThis.__byaRegistry.size,0);
});

test('native catalog fetch handles public JSON and rejects failed or oversized responses', async t => {
    const previous=globalThis.fetch;
    t.after(()=>{globalThis.fetch=previous;});
    const {fetchCatalog}=await compile('native.ts','https://example.test/badges.json');
    globalThis.fetch=async()=>new Response(JSON.stringify(catalog),{status:200});
    assert.deepEqual(await fetchCatalog(null),catalog);
    globalThis.fetch=async()=>new Response('Not found',{status:404});
    await assert.rejects(fetchCatalog(null),/HTTP 404/);
    globalThis.fetch=async()=>new Response('x'.repeat(1024*1024+1),{status:200});
    await assert.rejects(fetchCatalog(null),/1 MiB/);
});


test('without a configured source the plugin exposes no embedded or cached badges', async t => {
    globalThis.__byaRegistry = new Set();
    globalThis.__byaCache = {source:'https://example.test/badges.json',catalog};
    globalThis.VencordNative = {pluginHelpers:{ByaBadges:{fetchCatalog:async()=>{throw new Error('must not fetch');}}}};
    t.after(()=>{delete globalThis.__byaRegistry;delete globalThis.__byaCache;delete globalThis.VencordNative;});
    const {default:plugin} = await compile('index.tsx',null);
    await plugin.start();
    const [provider] = globalThis.__byaRegistry;
    assert.deepEqual(provider.getBadges({userId:'123456789012345678',guildId:''}),[]);
    plugin.stop();
});


test('renderer fallback loads badges when the native bridge has not been refreshed', async t => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify(catalog), {status:200});
    globalThis.__byaRegistry = new Set();
    globalThis.__byaNotifications = 0;
    delete globalThis.__byaCache;
    globalThis.VencordNative = {pluginHelpers:{}};
    t.after(()=>{globalThis.fetch=previousFetch;delete globalThis.__byaRegistry;delete globalThis.__byaCache;delete globalThis.VencordNative;delete globalThis.__byaNotifications;});
    const {default:plugin} = await compile('index.tsx','https://example.test/fallback.json');
    await plugin.start();
    await new Promise(resolve=>setImmediate(resolve));
    const [provider] = globalThis.__byaRegistry;
    assert.equal(provider.getBadges({userId:'123456789012345678',guildId:''})[0].name,'Developer');
    assert.ok(globalThis.__byaNotifications > 0);
    plugin.stop();
});
