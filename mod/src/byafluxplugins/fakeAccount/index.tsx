/*
 * Equicord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addContextMenuPatch, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import { addHeaderBarButton, HeaderBarButton, removeHeaderBarButton } from "@api/HeaderBar";
import { DataStore } from "@api/index";
import { Button } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import definePlugin from "@utils/types";
import { migratePluginSettings } from "@api/Settings";
import { CustomAccount, customAccount, isCustomAccount } from "./custom";
import { findStoreLazy, waitFor } from "@webpack";
import { FluxDispatcher, IconUtils, Menu, Modal, openModal, React, TextInput, UserStore } from "@webpack/common";

migratePluginSettings("FakeAccount", "FakeSwitcher");

import type { RenderModalProps } from "@vencord/discord-types";

const UserProfileStore = findStoreLazy("UserProfileStore");
const DS_KEY = "fakeAccount_switcher";
const CUSTOM_KEY = "FakeSwitcher_customAccounts";
let customAccounts: CustomAccount[] = [];
let running = false;
let runId = 0;
let originalGetUser: typeof UserStore.getUser | null = null;
let originalHasAccounts: (() => boolean) | null = null;
const panelListeners = new Set<() => void>();
let panelRevision = 0;
function refreshPanel() { panelRevision++; for (const listener of panelListeners) listener(); }
function subscribePanel(listener: () => void) { panelListeners.add(listener); return () => { panelListeners.delete(listener); }; }
const getPanelRevision = () => panelRevision;

function asFakeAccount(profile: CustomAccount) {
    return { id: profile.id, username: profile.username, globalName: profile.username, discriminator: "0", avatar: null };
}

function persistCustom() {
    void DataStore.set(CUSTOM_KEY, customAccounts);
    refreshPanel();
}

function removeCustom(id: string) {
    if (activeFakeId === id) restoreRealAccount();
    customAccounts = customAccounts.filter(p => p.id !== id);
    fakeAccounts = fakeAccounts.filter(p => p.id !== id);
    persistCustom();
    void DataStore.set(DS_KEY, fakeAccounts.map(p => p.id));
    _store?.emitChange?.();
}

export function CustomAccountPanel() {
    React.useSyncExternalStore(subscribePanel, getPanelRevision, getPanelRevision);
    const [username, setUsername] = React.useState("");
    const [photo, setPhoto] = React.useState("");
    const [feedback, setFeedback] = React.useState("");
    return <div>
        <Paragraph>Escolha um perfil visual ou crie um com nome e foto. Nenhum login é feito em outra conta.</Paragraph>
        <Button type="button" onClick={restoreRealAccount} disabled={!activeFakeId}>Restaurar meu perfil</Button>
        {fakeAccounts.filter(account => !customAccounts.some(custom => custom.id === account.id)).map(account => <div key={account.id}>
            <Paragraph>{account.globalName ?? account.username}</Paragraph>
            <Button type="button" onClick={() => simulateSwitch(account)}>Usar aparência</Button>{" "}
            <Button type="button" variant="dangerPrimary" onClick={() => onRemoveAccount({ userId: account.id })}>Remover</Button>
        </div>)}
        <Paragraph>Username</Paragraph>
        <TextInput value={username} onChange={setUsername} placeholder="Nome do perfil" maxLength={32} />
        <Paragraph>Foto por URL (HTTPS)</Paragraph>
        <TextInput value={photo} onChange={setPhoto} placeholder="https://exemplo.com/foto.png" />
        <Button type="button" onClick={() => {
            try {
                const profile = customAccount(username, photo);
                customAccounts = [...customAccounts, profile];
                fakeAccounts.push(asFakeAccount(profile));
                persistCustom();
                patchStore();
                _store?.emitChange?.();
                setUsername(""); setPhoto(""); setFeedback("Perfil adicionado ao seletor de contas.");
            } catch (error) { setFeedback(error instanceof Error ? error.message : "Não foi possível criar o perfil."); }
        }}>Adicionar ao switcher</Button>
        <Paragraph>{feedback}</Paragraph>
        {customAccounts.map(profile => <div key={profile.id}>
            <img src={profile.avatarUrl} width={40} height={40} alt="" referrerPolicy="no-referrer" />
            <Paragraph>{profile.username}</Paragraph>
            <Button type="button" onClick={() => simulateSwitch(asFakeAccount(profile))}>Usar aparência</Button>{" "}
            <Button type="button" variant="dangerPrimary" onClick={() => removeCustom(profile.id)}>Remover</Button>
        </div>)}
    </div>;
}

// ── Global State ────────────────────────────────────────────────────────────
let fakeAccounts: any[] = [];
let activeFakeId: string | null = null;
let realUserSnapshot: any = null;
let _store: any = null;
let _origGetUsers: (() => any[]) | null = null;
let _origGetValidUsers: (() => any[]) | null = null;

// ── Store Validation ────────────────────────────────────────────────────
// Critical Guard: waitFor("getUsers","getValidUsers","getHasLoggedInAccounts") can match
// several Webpack stores that share these method names. If we patch the wrong store
// (e.g., a permissions or channels store), corrupted results make all rooms disappear
// on servers with permissions.
// We verify that the matched store is indeed the MultiAccountStore by ensuring that:
// 1. getUsers() returns an array (not a Map, not an object)
// 2. getHasLoggedInAccounts() returns a boolean
// 3. Elements returned by getUsers() have the expected shape of a Discord account (id + tokenStatus)
function isMultiAccountStore(mod: any): boolean {
    try {
        if (typeof mod.getUsers !== "function") return false;
        if (typeof mod.getValidUsers !== "function" && typeof mod.getHasLoggedInAccounts !== "function") return false;

        // getUsers() doit retourner un Array (pas un objet, pas null)
        const users = mod.getUsers();
        if (!Array.isArray(users)) return false;

        // Si des users sont présents, ils doivent avoir une structure de account Discord
        // (id string + tokenStatus number) — caractéristique exclusive du MultiAccountStore
        if (users.length > 0) {
            const first = users[0];
            if (typeof first !== "object" || first === null) return false;
            // EmojiStore a aussi getUsers mais il contient des objets complexes
            // MultiAccountStore contient des objets simples avec id/username/avatar/tokenStatus
            if (typeof first.id !== "string") return false;
            // tokenStatus is exclusive to MultiAccountStore (0 = invalid, 1 = valid, 2 = fake)
            // Other stores may have objects with id but not tokenStatus
            if (!("tokenStatus" in first) && !("pushSyncToken" in first)) {
                // Tolerate empty stores (no accounts registered yet)
                // but reject if the object looks like a channel, role, or permission
                if ("type" in first || "permissions" in first || "parentId" in first) return false;
            }
        }

        // Vérification finale anti-EmojiStore : EmojiStore a souvent "getFrequentlyUsedEmojis"
        if (typeof mod.getFrequentlyUsedEmojis === "function") return false;

        return true;
    } catch {
        return false;
    }
}

// ── Store Patch ─────────────────────────────────────────────────────────
function patchStore() {
    if (!_store || _origGetUsers) return;

    _origGetUsers = _store.getUsers;
    originalHasAccounts = _store.getHasLoggedInAccounts;
    _origGetValidUsers = _store.getValidUsers;

    _store.getUsers = () => {
        const real: any[] = _origGetUsers?.call(_store) ?? [];
        const realIds = new Set(real.map((u: any) => u.id));
        const extras = fakeAccounts
            .filter(f => !realIds.has(f.id))
            .map(f => ({
                id: f.id,
                username: f.username,
                globalName: f.globalName ?? f.username,
                discriminator: f.discriminator ?? "0",
                avatar: f.avatar ?? null,
                tokenStatus: 2,
                pushSyncToken: null,
            }));
        return [...real, ...extras];
    };

    _store.getValidUsers = () => {
        const real: any[] = _origGetValidUsers?.call(_store) ?? [];
        const realIds = new Set(real.map((u: any) => u.id));
        const extras = fakeAccounts
            .filter(f => !realIds.has(f.id))
            .map(f => ({
                id: f.id,
                username: f.username,
                globalName: f.globalName ?? f.username,
                discriminator: f.discriminator ?? "0",
                avatar: f.avatar ?? null,
                tokenStatus: 2,
                pushSyncToken: null,
            }));
        return [...real, ...extras.filter(e => !realIds.has(e.id))];
    };

    _store.getHasLoggedInAccounts = () => true;
    console.log("[FakeAccount] Store patched ✅");
}

function unpatchStore() {
    if (!_store || !_origGetUsers) return;
    _store.getUsers = _origGetUsers;
    if (_origGetValidUsers) _store.getValidUsers = _origGetValidUsers;
    if (originalHasAccounts) _store.getHasLoggedInAccounts = originalHasAccounts;
    originalHasAccounts = null;
    _origGetUsers = null;
    _origGetValidUsers = null;
    _store.emitChange?.();
}

// ── simulateSwitch ─────────────────────────────────────────────────────────
function simulateSwitch(fake: any) {
    const me = UserStore.getCurrentUser();
    if (!me) return;

    if (!realUserSnapshot || realUserSnapshot.id !== me.id) {
        realUserSnapshot = {
            id: me.id,
            username: me.username,
            globalName: (me as any).globalName ?? me.username,
            avatar: me.avatar,
            banner: (me as any).banner ?? null,
            bio: (me as any).bio ?? "",
            accentColor: (me as any).accentColor ?? null,
            discriminator: me.discriminator,
            publicFlags: (me as any).publicFlags ?? 0,
            flags: (me as any).flags ?? 0,
            premiumType: (me as any).premiumType ?? 0,
        };
    }

    activeFakeId = fake.id;
    refreshPanel();

    FluxDispatcher.dispatch({
        type: "USER_UPDATE",
        user: {
            id: me.id,
            username: fake.username,
            global_name: fake.globalName ?? fake.username,
            avatar: fake.avatar ?? null,
            banner: fake._banner ?? null,
            bio: fake._bio ?? "",
            accent_color: fake._accentColor ?? null,
            discriminator: fake.discriminator ?? "0",
            public_flags: fake._publicFlags ?? 0,
            flags: fake._flags ?? 0,
            premium_type: fake._premiumType ?? 0,
        },
    });

    // Force the bottom-left panel (AccountPanel) to re-render
    try {
        const updated = UserStore.getCurrentUser();
        if (updated) FluxDispatcher.dispatch({ type: "CURRENT_USER_UPDATE", user: { ...updated } });
        FluxDispatcher.dispatch({ type: "IDLE" });
    } catch { }

    _store?.emitChange?.();
    console.log("[FakeAccount] ✅ Profile changed:", fake.username);
}

// ── restoreRealAccount ─────────────────────────────────────────────────────
function restoreRealAccount() {
    if (!realUserSnapshot) return;
    const me = UserStore.getCurrentUser();
    if (!me) return;
    if (me.id !== realUserSnapshot.id) {
        activeFakeId = null;
        realUserSnapshot = null;
        refreshPanel();
        return;
    }

    FluxDispatcher.dispatch({
        type: "USER_UPDATE",
        user: {
            id: me.id,
            username: realUserSnapshot.username,
            global_name: realUserSnapshot.globalName,
            avatar: realUserSnapshot.avatar ?? null,
            banner: realUserSnapshot.banner ?? null,
            bio: realUserSnapshot.bio ?? "",
            accent_color: realUserSnapshot.accentColor ?? null,
            discriminator: realUserSnapshot.discriminator ?? "0",
            public_flags: realUserSnapshot.publicFlags ?? 0,
            flags: realUserSnapshot.flags ?? 0,
            premium_type: realUserSnapshot.premiumType ?? 0,
        },
    });

    activeFakeId = null;
    realUserSnapshot = null;
    refreshPanel();

    // Force the bottom-left panel (AccountPanel) to re-render
    try {
        const updated = UserStore.getCurrentUser();
        if (updated) FluxDispatcher.dispatch({ type: "CURRENT_USER_UPDATE", user: { ...updated } });
        FluxDispatcher.dispatch({ type: "IDLE" });
    } catch { }

    _store?.emitChange?.();
    console.log("[FakeAccount] ✅ Profile restored");
}

// ── Switch action subscriptions ──────────────────────────────────
function onSwitchFailure(action: any) {
    console.log("[FakeAccount] SWITCH_FAILURE action:", JSON.stringify(action));
    const userId = action.userId ?? action.user_id ?? action.id;
    const fake = fakeAccounts.find(f => f.id === userId);
    if (!fake) return;
    console.log("[FakeAccount] → simulateSwitch:", fake.username);
    simulateSwitch(fake);
}

function onSwitchAttempt(action: any) {
    console.log("[FakeAccount] SWITCH_ATTEMPT action:", JSON.stringify(action));
    const userId = action.userId ?? action.user_id ?? action.id;
    const fake = fakeAccounts.find(f => f.id === userId);
    if (!fake) return;
    console.log("[FakeAccount] ATTEMPT → simulateSwitch:", fake.username);
    simulateSwitch(fake);
}

// ── DISCONNECT Handler (removal) of a fake account ──────────────────
function onRemoveAccount(action: any) {
    const userId = action.userId ?? action.user_id ?? action.id;
    if (!userId) return;

    const idx = fakeAccounts.findIndex(f => f.id === userId);
    if (idx === -1) return; // Not a fake account, ignore

    console.log("[FakeAccount] Removing fake account:", fakeAccounts[idx].username);

    // If it's the currently active fake, restore real profile
    if (activeFakeId === userId) {
        restoreRealAccount();
    }

    if (customAccounts.some(p => p.id === userId)) { removeCustom(userId); return; }

    // Remove from array and persist
    fakeAccounts.splice(idx, 1);
    refreshPanel();
    DataStore.set(DS_KEY, fakeAccounts.map(f => f.id));

    // Force re-render of switcher
    _store?.emitChange?.();
}

// ── Add user to switcher ────────────────────────────────────────────
function addToSwitcher(userId: string) {
    if (fakeAccounts.find(f => f.id === userId)) return;

    const user = UserStore.getUser(userId);
    const profile = UserProfileStore.getUserProfile?.(userId) ?? {};
    const username = user?.username ?? `User_${userId.slice(-4)}`;

    fakeAccounts.push({
        id: userId,
        username,
        globalName: (user as any)?.globalName ?? username,
        discriminator: user?.discriminator ?? "0",
        avatar: user?.avatar ?? null,
        _bio: profile.bio ?? "",
        _banner: profile.banner ?? null,
        _accentColor: profile.accentColor ?? null,
        _publicFlags: (user as any)?.publicFlags ?? 0,
        _flags: (user as any)?.flags ?? 0,
        _premiumType: (user as any)?.premiumType ?? 0,
    });

    DataStore.set(DS_KEY, fakeAccounts.map(f => f.id));
    patchStore();
    refreshPanel();
    _store?.emitChange?.();
    console.log("[FakeAccount] Added:", username);
}

// ── UI ─────────────────────────────────────────────────────────────────────
function RestoreIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
        </svg>
    );
}

function RestoreButton() {
    return (
        <HeaderBarButton
            icon={RestoreIcon}
            tooltip="Abrir FakeAccount"
            onClick={openAccountPicker}
        />
    );
}

function FakeAccountIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
        </svg>
    );
}

const ctxPatch: NavContextMenuPatchCallback = (children, { user }) => {
    if (!children || !Array.isArray(children)) return;
    try {
        if (!user) return;
        if (user.id === UserStore.getCurrentUser()?.id) { selfPatch(children, {}); return; }
        children.push(
            <Menu.MenuItem
                id="fake-account-add"
                label="Adicionar ao FakeAccount"
                icon={FakeAccountIcon}
                action={() => addToSwitcher(user.id)}
            />
        );
    } catch (e) {
        console.error("[FakeAccount] Context menu patch error:", e);
    }
};

function AccountPicker(props: RenderModalProps) {
    return <Modal {...props} title="FakeAccount" size="md"><CustomAccountPanel /></Modal>;
}
function openAccountPicker() {
    if (running) openModal(props => <AccountPicker {...props} />);
}
const selfPatch: NavContextMenuPatchCallback = children => {
    children.push(<Menu.MenuGroup key="byaflux-fake-account">
        <Menu.MenuItem id="byaflux-fake-account-open" label="FakeAccount" action={openAccountPicker} />
    </Menu.MenuGroup>);
};

// ── Plugin ─────────────────────────────────────────────────────────────────
export default definePlugin({
    name: "FakeAccount",
    enabledByDefault: false,
    description: "Adicione perfis visuais pelo botão direito ou crie um com nome e foto. Escolha a aparência no seletor de contas.",
    authors: [{ name: "Haru", id: 1227436212982251533n }],
    dependencies: ["HeaderBarAPI", "ContextMenuAPI"],
    settingsAboutComponent: CustomAccountPanel,
    toolboxActions: { "Abrir FakeAccount": openAccountPicker },
    contextMenus: { "vc-ap-server-profile": selfPatch, "byaflux-profilebadges-self": selfPatch },
    patches: [{
        find: "getUserAvatarURL:",
        replacement: {
            match: /(getUserAvatarURL:)(\i),/,
            replace: "$1$self.getAvatarHook($2),"
        }
    }],
    getAvatarHook(original: typeof IconUtils.getUserAvatarURL): typeof IconUtils.getUserAvatarURL {
        return (user, ...args) => {
            if (!running) return original(user, ...args);
            const custom = customAccounts.find(p => p.id === user.id || p.id === activeFakeId && user.id === UserStore.getCurrentUser()?.id);
            return custom?.avatarUrl ?? original(user, ...args);
        };
    },

    async start() {
        running = true;
        const currentRun = ++runId;
        originalGetUser = UserStore.getUser;
        const getUser = originalGetUser;
        UserStore.getUser = id => {
            const user = getUser.call(UserStore, id);
            if (user) return user;
            const custom = customAccounts.find(p => p.id === id);
            const real = UserStore.getCurrentUser();
            if (!custom || !real) return user;
            return new Proxy(real, { get(target, key, receiver) {
                if (key === "id") return custom.id;
                if (key === "username" || key === "globalName") return custom.username;
                if (key === "avatar") return null;
                if (key === "getAvatarURL") return () => custom.avatarUrl;
                return Reflect.get(target, key, receiver);
            } });
        };
        FluxDispatcher.subscribe("MULTI_ACCOUNT_SWITCH_FAILURE", onSwitchFailure);
        FluxDispatcher.subscribe("MULTI_ACCOUNT_SWITCH_ATTEMPT", onSwitchAttempt);
        FluxDispatcher.subscribe("MULTI_ACCOUNT_REMOVE_ACCOUNT", onRemoveAccount);

        addContextMenuPatch("user-context", ctxPatch);
        addContextMenuPatch("user-profile-actions", ctxPatch);
        addContextMenuPatch("user-profile", ctxPatch);
        addHeaderBarButton("fake-account-restore", () => <RestoreButton />, 5);

        waitFor("getHasLoggedInAccounts", (mod: any) => {
            if (!running || currentRun !== runId || !isMultiAccountStore(mod)) return;
            _store = mod;
            patchStore();
            mod.emitChange?.();
        });

        const savedCustom = await DataStore.get<unknown>(CUSTOM_KEY);
        if (!running || currentRun !== runId) return;
        const savedProfiles = Array.isArray(savedCustom) ? savedCustom.filter(isCustomAccount) : [];
        customAccounts = [...new Map([...savedProfiles, ...customAccounts].map(p => [p.id, p])).values()];
        for (const profile of customAccounts) {
            if (!fakeAccounts.some(p => p.id === profile.id)) fakeAccounts.push(asFakeAccount(profile));
        }
        refreshPanel();

        const savedIds: string[] = (await DataStore.get(DS_KEY)) ?? [];
        if (!running || currentRun !== runId) return;
        for (const id of savedIds) {
            if (fakeAccounts.find(f => f.id === id)) continue;
            const user = UserStore.getUser(id);
            if (!user) continue;
            const profile = UserProfileStore.getUserProfile?.(id) ?? {};
            fakeAccounts.push({
                id: user.id,
                username: user.username,
                globalName: (user as any).globalName ?? user.username,
                discriminator: user.discriminator ?? "0",
                avatar: user.avatar ?? null,
                _bio: profile.bio ?? "",
                _banner: profile.banner ?? null,
                _accentColor: profile.accentColor ?? null,
                _publicFlags: (user as any).publicFlags ?? 0,
                _flags: (user as any).flags ?? 0,
                _premiumType: (user as any).premiumType ?? 0,
            });
        }


        patchStore();
        refreshPanel();
        _store?.emitChange?.();
    },

    stop() {
        running = false;
        ++runId;
        FluxDispatcher.unsubscribe("MULTI_ACCOUNT_SWITCH_FAILURE", onSwitchFailure);
        FluxDispatcher.unsubscribe("MULTI_ACCOUNT_SWITCH_ATTEMPT", onSwitchAttempt);
        FluxDispatcher.unsubscribe("MULTI_ACCOUNT_REMOVE_ACCOUNT", onRemoveAccount);
        removeContextMenuPatch("user-context", ctxPatch);
        removeContextMenuPatch("user-profile-actions", ctxPatch);
        removeContextMenuPatch("user-profile", ctxPatch);
        removeHeaderBarButton("fake-account-restore");
        if (activeFakeId) restoreRealAccount();
        fakeAccounts = [];
        unpatchStore();
        _store = null;
        if (originalGetUser) UserStore.getUser = originalGetUser;
        originalGetUser = null;
        customAccounts = [];
        refreshPanel();
    },
});
