import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../mod/node_modules/esbuild/lib/main.js';
const { outputFiles } = await build({ entryPoints: ['mod/src/byafluxplugins/profileBadges/local.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { applyLocalBadges, accountPatch, profilePatch, accountContextPatch, badgeOrder, moveBadge, dragTarget, dragOffset } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
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

test('account action uses the private native row and follows Orbs even when Orbs is hidden', () => {
    const source = 'function Row(){}function menu(close,enabled){return (0,r.jsxs)("div",{children:[(0,r.jsx)(Overlay,{children:(0,r.jsxs)(List,{children:["badges","clips",enabled&&(0,r.jsx)(Orbs,{popoutContainerRef:p,scrollerRef:s,shouldScrollIntoView:v,onCloseAccountPopout:close})]})}),(0,r.jsx)(Profile.A.Overlay,{className:classes.base,children:(0,r.jsxs)(List,{children:[(0,r.jsx)(Row,{action:"PRESS_SWITCH_ACCOUNTS"})]})})]})}';
    const regex = canonical(accountPatch.replacement.match);
    assert.ok(regex.test(source));
    const result = source.replace(regex, accountPatch.replacement.replace.replaceAll('$self', 'plugin'));
    const calls = [];
    const jsx = (type, props) => ({type,props});
    const plugin = {renderAccountAction(Row,close){calls.push({Row,close});return {type:Row,props:{label:'Set badges',onClick:close}};}};
    const menu = new Function('r','Overlay','List','Orbs','Profile','classes','p','s','v','plugin',result+';return menu;')({jsx,jsxs:jsx},'overlay','list','orbs',{A:{Overlay:'overlay'}},{base:'base'},null,null,false,plugin);
    const close = () => {};
    for (const enabled of [true,false]) {
        const tree = menu(close,enabled);
        const rows = tree.props.children[0].props.children.props.children;
        assert.equal(rows.at(-1).props.label, 'Set badges');
        assert.equal(enabled ? rows.at(-2).type : rows.at(-2), enabled ? 'orbs' : false);
        assert.equal(calls.at(-1).Row, tree.props.children[1].props.children.props.children[0].type);
        assert.equal(calls.at(-1).close, close);
    }
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

async function loadPlugin(entry = "index.tsx") {
    const modules = {
        '@api/Badges': 'export function notifyBadgeUpdates(){};',
        '@api/PluginManager': 'export const isPluginEnabled=()=>!!globalThis.__accountProfileEnabled;',
        '@api/Settings': 'export function definePluginSettings(){return {withPrivateSettings(){return this},store:{}}}',
        '@components/Button': 'export function Button(){}',
        '@components/ErrorBoundary': 'export default {wrap:component=>component}',
        '@components/FormSwitch': 'export function FormSwitch(){}',
        '@components/Icons': 'export function StarFilled(){}',
        '@components/Paragraph': 'export function Paragraph(){}',
        '@utils/constants': 'export const Devs={Ven:{id:1n,name:"Ven"}}',
        '@utils/types': 'export default x=>x;',
        '@utils/misc': 'export const classes=(...values)=>values.filter(Boolean).join(" ");',
        '@webpack/common': `export const UserStore={getCurrentUser:()=>({id:"${self}"})}; export const React={createElement(type,props,...children){return {type,props:{...props,...(children.length?{children:children.length===1?children[0]:children}:{})}}}}; export const Menu={Menu:"menu",MenuGroup:"group",MenuItem:"item"}; export const ContextMenuApi={openContextMenu(event,render){globalThis.__selfContextRender=render;},closeContextMenu(){}}; export const Modal="modal",Select="select"; export function openModal(render){globalThis.__localBadgeModal=render;}`
    };
    const result = await build({entryPoints:[`mod/src/byafluxplugins/profileBadges/${entry}`],bundle:true,write:false,format:'esm',platform:'node',loader:{'.css':'empty'},plugins:[{name:'runtime',setup(b){
        b.onResolve({filter:/.*/},args=>Object.hasOwn(modules,args.path)?{path:args.path,namespace:'fixture'}:undefined);
        b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:modules[args.path]}));
    }}]});
    const module = await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
    return entry === 'index.tsx' ? module.default : module;
}

test('self context menus open the local editor while other user menus stay unchanged', async t => {
    t.after(()=>{delete globalThis.__localBadgeModal;});
    const plugin = await loadPlugin();
    for (const menu of ['user-context','user-profile']) {
        const children = [];
        plugin.contextMenus[menu](children,{user:{id:'other'}});
        plugin.contextMenus[menu](children,{});
        assert.equal(children.length,0);
        plugin.contextMenus[menu](children,{user:{id:self}});
        const item = children[0].props.children;
        assert.equal(item.props.label,'Set badges');
        item.props.action();
        assert.equal(globalThis.__localBadgeModal({onClose(){},transitionState:0}).props.userId,self);
    }
});

test('account row renders using the supplied component without a webpack export lookup', async () => {
    const plugin = await loadPlugin();
    plugin.start();
    const Row = () => null;
    let closed = 0;
    const element = plugin.renderAccountAction(Row,()=>{closed++;});
    const native = element.type(element.props);
    assert.equal(native.type,Row);
    assert.equal(native.props.label,'Set badges');
    native.props.onClick();
    assert.equal(closed,1);
    plugin.stop();
    assert.equal(element.type(element.props),null);
});


test('account panel right click opens Set badges and preserves the server-profile context menu', async t => {
    t.after(()=>{delete globalThis.__selfContextRender;delete globalThis.__accountProfileEnabled;});
    const plugin = await loadPlugin();
    plugin.start();
    plugin.openSelfContextMenu({});
    const element = globalThis.__selfContextRender();
    const menu = element.type(element.props);
    assert.equal(menu.props.children.props.label,'Set badges');
    delete globalThis.__selfContextRender;
    globalThis.__accountProfileEnabled=true;
    plugin.openSelfContextMenu({});
    assert.equal(globalThis.__selfContextRender,undefined);
    const existing=[{props:{id:'vc-ap-view-alternate-popout'}}];
    plugin.contextMenus['vc-ap-server-profile'](existing);
    assert.equal(existing.length,2);
    assert.equal(existing[0].props.id,'vc-ap-view-alternate-popout');
    assert.equal(existing[1].props.children.props.label,'Set badges');
    const source='jsx(Button,{focusProps:{ringTarget:ref},className:classes.name,"data-jump-section":section})';
    const patched=source.replace(canonical(accountContextPatch.replacement.match),accountContextPatch.replacement.replace.replaceAll('$self','plugin'));
    assert.match(patched,/onContextMenu:plugin.openSelfContextMenu/);
    plugin.stop();
});


test('badge ordering survives duplicate, unknown and older saved entries', () => {
    const order = badgeOrder(['boost','unknown','nitro','boost']);
    assert.deepEqual(order.slice(0,2),['boost','nitro']);
    assert.equal(order.length,14);
    assert.deepEqual(badgeOrder(),badgeOrder(undefined));
    const selected = {...selection,order};
    assert.deepEqual(applyLocalBadges(self,self,[],selected).map(b=>b.id),['byaflux-local-boost','byaflux-local-nitro','byaflux-local-staff']);
    assert.deepEqual(moveBadge(['nitro','boost','staff'],0,2),['boost','staff','nitro']);
});

test('drag offsets account for expanded level rows and support both directions', () => {
    const rects=[{top:0,height:60},{top:60,height:280},{top:340,height:60}];
    assert.equal(dragTarget(rects,400),2);
    assert.equal(dragTarget(rects,-50),0);
    assert.equal(dragOffset(rects,0,2,0),340);
    assert.equal(dragOffset(rects,0,2,1),-60);
    assert.equal(dragOffset(rects,1,0,1),-60);
    assert.equal(dragOffset(rects,1,0,0),280);
    assert.equal(dragOffset(rects,1,1,2),0);
});


test('every Nitro and Boost level is selectable by its exact saved ID', async () => {
    const { LevelPicker } = await loadPlugin('editor.tsx');
    const { nitroLevels, boostLevels } = await import('../mod/src/byafluxplugins/profileBadges/badges.ts');
    for (const levels of [nitroLevels,boostLevels]) {
        const selected=[];
        const tree=LevelPicker({levels,value:levels[2].id,onChange:value=>selected.push(value)});
        const buttons=tree.props.children;
        for (const button of buttons) button.props.onClick();
        assert.deepEqual(selected,levels.map(level=>level.id));
        assert.equal(buttons[2].props['aria-pressed'],true);
        assert.equal(buttons.filter(button=>button.props['aria-pressed']).length,1);
    }
});
