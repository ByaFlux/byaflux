import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const dir = await mkdtemp(join(tmpdir(), "byaflux-fake-account-"));
const real = { id: "1227436212982251533", username: "Real", globalName: "Real", avatar: "real-avatar", discriminator: "0" };
const custom = { id: "1337436212982251533", username: "Visual Linux", avatarUrl: "https://example.com/avatar.png" };
const other = { id: "1447436212982251533", username: "Other", avatar: null };
const H = globalThis.__fakeAccountTest = {
    real: { ...real }, other, data: new Map([["FakeSwitcher_customAccounts", [custom]], ["fakeAccount_switcher", [other.id]]]),
    contexts: new Map(), actions: [], headers: new Map(), modal: null,
    UserStore: null,
};
H.UserStore = { getCurrentUser: () => H.real, getUser: id => id === H.real.id ? H.real : id === other.id ? other : undefined };
const shim = `
const H = globalThis.__fakeAccountTest;
export const DataStore = { get: async key => H.data.get(key), set: async (key, value) => H.data.set(key, value) };
export const addContextMenuPatch = (key, fn) => H.contexts.set(key, fn);
export const removeContextMenuPatch = key => H.contexts.delete(key);
export const addHeaderBarButton = (key, fn) => H.headers.set(key, fn);
export const removeHeaderBarButton = key => H.headers.delete(key);
export const migratePluginSettings = () => {};
export const Button = 'button', Paragraph = 'p', HeaderBarButton = 'header-button', TextInput = 'input';
export const Modal = 'modal', openModal = fn => { H.modal = fn({ onClose() {} }); };
export const UserStore = H.UserStore;
export const IconUtils = { getUserAvatarURL: () => 'real-avatar' };
export const FluxDispatcher = { subscribe() {}, unsubscribe() {}, dispatch(action) {
 H.actions.push(action);
 if (action.type === 'USER_UPDATE') Object.assign(H.real, { username: action.user.username, globalName: action.user.global_name, avatar: action.user.avatar });
} };
export const React = {
 createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }),
 useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
 useSyncExternalStore: (subscribe, snapshot) => snapshot()
};
export const Menu = { MenuGroup: 'group', MenuItem: 'item' };
export const findStoreLazy = () => ({ getUserProfile: () => ({}) });
export const waitFor = () => {}; // Linux regression: no native MultiAccountStore.
export default value => value;
`;
function nodes(node) {
    if (!node || typeof node !== "object") return [];
    return [node, ...(node.props?.children ?? []).flatMap(nodes)];
}
function text(node) {
    if (typeof node === "string") return node;
    return (node?.props?.children ?? []).map(text).join("");
}
try {
    await build({ entryPoints: ["src/byafluxplugins/fakeAccount/index.tsx"], bundle: true, platform: "node", format: "esm", outfile: join(dir, "plugin.mjs"), plugins: [{ name: "discord-fixture", setup(b) {
        b.onResolve({ filter: /^@/ }, args => ({ path: args.path, namespace: "fixture" }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: shim, loader: "js" }));
    } }] });
    const { default: plugin, CustomAccountPanel } = await import(pathToFileURL(join(dir, "plugin.mjs")));
    const originalGetter = H.UserStore.getUser;
    await plugin.start();
    let panel = CustomAccountPanel();
    assert.ok(text(panel).includes(custom.username), "Saved custom profiles must load without a native account store");
    assert.ok(text(panel).includes(other.username), "Saved copied profiles must also load");
    let userMenu = [];
    H.contexts.get("user-context")(userMenu, { user: H.real });
    nodes(userMenu[0]).find(n => n.props.id === "byaflux-fake-account-open").props.action();
    assert.ok(H.modal, "Own-profile menu must open the picker");
    const header = [...H.headers.values()][0]();
    header.type(header.props).props.onClick();
    assert.ok(H.modal, "Header shortcut must work without the native switcher");
    const buttons = nodes(panel).filter(n => n.type === "button" && text(n) === "Usar aparência");
    buttons.at(-1).props.onClick();
    assert.equal(H.real.id, real.id);
    assert.equal(H.real.username, custom.username);
    assert.equal(plugin.getAvatarHook(() => "original")(H.real), custom.avatarUrl);
    assert.ok(!H.actions.some(a => a.type.startsWith("MULTI_ACCOUNT_")), "Visual picker must not attempt account authentication");
    panel = CustomAccountPanel();
    nodes(panel).find(n => n.type === "button" && text(n) === "Restaurar meu perfil").props.onClick();
    assert.equal(H.real.username, real.username);
    assert.equal(H.real.avatar, real.avatar);
    assert.ok(!H.actions.some(a => a.type === "USER_SETTINGS_PROTO_UPDATE"));
    plugin.stop();
    assert.equal(H.UserStore.getUser, originalGetter);
    assert.equal(H.contexts.size, 0);
    await plugin.start();
    assert.ok(text(CustomAccountPanel()).includes(custom.username), "Profiles must survive restart");
    const use = nodes(CustomAccountPanel()).filter(n => n.type === "button" && text(n) === "Usar aparência").at(-1);
    use.props.onClick();
    H.real = { ...other };
    plugin.stop();
    assert.equal(H.real.username, other.username, "Stopping after a real account change must not overwrite that account");
    console.log("PASS FakeAccount: Linux without native switcher, saved profiles, context/header access, local username/photo, restore, restart, lifecycle and real account isolation.");
} finally { delete globalThis.__fakeAccountTest; await rm(dir, { recursive: true, force: true }); }
