import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { build } = createRequire(new URL('../mod/package.json', import.meta.url))('esbuild');
const settings = {};
let load;

async function fixture() {
    for (const key of Object.keys(settings)) delete settings[key];
    Object.assign(settings,{plugins:{ByaBadges:{enabled:true}},themeLinks:[]});
    globalThis.__backupSettings = settings;
    globalThis.__backupStore = [];
    globalThis.__backupCss = 'old css';
    globalThis.__backupSaved = [];
    globalThis.VencordNative = {
        settings: { get:()=>settings, set:async()=>{} },
        quickCss: { get:async()=>globalThis.__backupCss, set:async value=>{globalThis.__backupCss=value;} }
    };
    globalThis.DiscordNative = {fileManager:{saveWithDialog:(data,name)=>globalThis.__backupSaved.push({data,name})}};
    if (!load) load = (async()=>{
        const mocks = {
            '@api/Settings':'export const PlainSettings=globalThis.__backupSettings;',
            '@utils/Logger':'export class Logger {warn(){} error(){}}',
            '@utils/web':'export function chooseFile(){}; export function saveFile(){};',
            '@webpack/common':'export const moment=()=>({format:()=>"2026-11-16"}); export function showToast(){};',
            '..':'export const DataStore={keys:async()=>[],get:async()=>null,setMany:async pairs=>{globalThis.__backupStore=pairs}};'
        };
        const result = await build({entryPoints:[fileURLToPath(new URL('../mod/src/api/SettingsSync/offline.ts',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node',define:{IS_DISCORD_DESKTOP:'true'},plugins:[{
            name:'backup-environment',setup(b){
                b.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);
                b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path]}));
            }
        }]});
        return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
    })();
    return load;
}

test('imports Vencord settings and QuickCSS while retaining ByaFlux-only plugin settings', async()=>{
    const api=await fixture();
    await api.importSettings(JSON.stringify({settings:{plugins:{MessageLogger:{enabled:true}},themeLinks:['https://example.com/theme.css']},quickCss:'body {color:red;}'}));
    assert.equal(settings.plugins.MessageLogger.enabled,true);
    assert.equal(settings.plugins.ByaBadges.enabled,true);
    assert.equal(globalThis.__backupCss,'body {color:red;}');
});

test('imports Equicord DataStore and plugin settings from full backups', async()=>{
    const api=await fixture();
    await api.importSettings(JSON.stringify({settings:{plugins:{EquiTweaks:{enabled:true,showAllBadges:true}}},quickCss:'',dataStore:[['pinned-users',['123']]]}));
    assert.equal(settings.plugins.EquiTweaks.showAllBadges,true);
    assert.equal(globalThis.__backupCss,'');
    assert.deepEqual(globalThis.__backupStore,[['pinned-users',['123']]]);
});

test('accepts raw legacy settings files and partial QuickCSS/DataStore backups', async()=>{
    const api=await fixture();
    await api.importSettings(JSON.stringify({plugins:{Experiments:{enabled:true}}}));
    assert.equal(settings.plugins.Experiments.enabled,true);
    await api.importSettings('{"quickCss":""}','css');
    assert.equal(globalThis.__backupCss,'');
    await api.importSettings('{"dataStore":[]}','datastore');
    assert.deepEqual(globalThis.__backupStore,[]);
});

test('rejects malformed or unsafe backups before modifying current configuration', async()=>{
    const api=await fixture();
    const before=JSON.stringify(settings);
    for(const input of ['null','[]','{"hello":"world"}','{"settings":null}','{"settings":{},"quickCss":12}','{"settings":{},"dataStore":[["key"]]}','{"settings":{"__proto__":{"polluted":true}}}']){
        await assert.rejects(api.importSettings(input));
        assert.equal(JSON.stringify(settings),before);
    }
    assert.equal({}.polluted,undefined);
});

test('all backup variants download with the ByaFlux filename and retain the shared JSON format', async()=>{
    const api=await fixture();
    for(const type of ['all','plugins','css','datastore']) await api.downloadSettingsBackup(type);
    assert.deepEqual(globalThis.__backupSaved.map(file=>file.name),['all','plugins','css','datastore'].map(type=>`ByaFlux-${type}-backup-2026-11-16.json`));
    const payload=JSON.parse(new TextDecoder().decode(globalThis.__backupSaved[0].data));
    assert.ok(payload.settings.plugins.ByaBadges);
    assert.equal(payload.quickCss,'old css');
});
