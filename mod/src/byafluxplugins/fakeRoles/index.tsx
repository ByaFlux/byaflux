/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import type { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin from "@utils/types";
import { waitFor } from "@webpack";
import {
    Checkbox,
    ChannelMemberStore,
    PresenceStore,
    ChannelStore,
    GuildMemberStore,
    GuildRoleStore,
    GuildStore,
    Menu,
    Modal,
    openModal,
    React,
    SelectedGuildStore,
    UserStore,
    useStateFromStores
} from "@webpack/common";
import type { RenderModalProps } from "@vencord/discord-types";

import {
    bindMemberListStore,
    bindSectionListStore,
    projectMember,
    sortedVisibleRoles,
    orderedRoles,
    readSelection,
    roleColour,
    roleKey,
    RoleSelection,
    toggleRole,
    visibleRoles
} from "./model";

import {
    createProfileBridge,
    profileExports,
    roleSectionExports,
    type ProfileRoleContext
} from "./profileBridge";

const settings = definePluginSettings({}).withPrivateSettings<{
    profiles?: Record<string, RoleSelection>;
}>();
const listeners = new Set<() => void>();
let version = 0,
    active = false;
const disposers: (() => void)[] = [];
const displayStores = new Set<any>();
let bridge: ReturnType<typeof createProfileBridge> | undefined;
function notify(repaint = false) {
    version++;
    for (const fn of listeners) fn();
    if (repaint) for (const store of displayStores) store.emitChange?.();
}
function useChanges() {
    React.useSyncExternalStore(
        fn => {
            listeners.add(fn);
            return () => {
                listeners.delete(fn);
            };
        },
        () => version
    );
}
function roles(guildId: string) {
    const source = GuildRoleStore as any;
    const value =
        source.getSortedRoles?.(guildId) ??
        source.getRolesSnapshot?.(guildId) ??
        source.getRoles?.(guildId) ??
        (GuildStore.getGuild(guildId) as any)?.roles ??
        {};
    return orderedRoles(Array.isArray(value) ? value : (Object.values(value) as any[]), guildId);
}
function selection(guildId: string, userId: string) {
    return readSelection(settings.store.profiles?.[roleKey(userId, guildId)]);
}
function save(guildId: string, userId: string, value?: RoleSelection) {
    const next = { ...settings.store.profiles };
    if (value && (value.added.length || value.hidden.length)) next[roleKey(userId, guildId)] = value;
    else delete next[roleKey(userId, guildId)];
    settings.store.profiles = next;
    notify(true);
}
export function RoleEditor({ guildId, userId }: { guildId: string; userId: string }) {
    useChanges();
    const [query, setQuery] = React.useState("");
    const available = useStateFromStores([GuildRoleStore], () => roles(guildId));
    const real = useStateFromStores(
        [GuildMemberStore],
        () => GuildMemberStore.getMember(guildId, userId)?.roles ?? []
    );
    const current = selection(guildId, userId),
        selected = visibleRoles(
            real,
            current,
            available.map(r => r.id)
        );
    const shown = available.filter(role => role.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    return (
        <div className="bf-roles-editor">
            <p>Somente você vê estas alterações. Nenhuma permissão é concedida.</p>
            <input
                className="bf-roles-search"
                aria-label="Buscar cargos"
                placeholder="Buscar cargos"
                value={query}
                onChange={e => setQuery(e.target.value)}
            />
            <div className="bf-roles-list" role="group" aria-label="Cargos do servidor">
                <div className="bf-role-row">
                    <Checkbox value disabled onChange={() => {}} type="row" reverse>
                        @everyone
                    </Checkbox>
                </div>
                {shown.map(role => (
                    <div className="bf-role-row" key={role.id}>
                        <Checkbox
                            value={selected.includes(role.id)}
                            type="row"
                            reverse
                            onChange={(_, checked) =>
                                save(
                                    guildId,
                                    userId,
                                    toggleRole(real, selection(guildId, userId), role.id, checked)
                                )
                            }
                        >
                            <span className="bf-role-label">
                                <span className="bf-role-dot" style={{ background: roleColour(role) }} />
                                {role.name}
                            </span>
                        </Checkbox>
                    </div>
                ))}
                {!shown.length && <p>Nenhum cargo encontrado.</p>}
            </div>
            <Button onClick={() => save(guildId, userId)}>Restaurar cargos originais</Button>
        </div>
    );
}
function Panel({ guildId, userId, ...props }: RenderModalProps & { guildId: string; userId: string }) {
    return (
        <Modal
            {...props}
            title={`Cargos visuais · ${GuildStore.getGuild(guildId)?.name ?? "Servidor"}`}
            size="md"
        >
            <RoleEditor guildId={guildId} userId={userId} />
        </Modal>
    );
}
const SafePanel = ErrorBoundary.wrap(Panel, { noop: true });
function open(guildId = SelectedGuildStore.getGuildId()) {
    const userId = UserStore.getCurrentUser()?.id;
    if (guildId && userId && GuildStore.getGuild(guildId))
        openModal(props => <SafePanel {...props} guildId={guildId} userId={userId} />);
}
const contextMenu: NavContextMenuPatchCallback = (children, props) => {
    if (props.user?.id !== UserStore.getCurrentUser()?.id) return;
    const guildId =
        props.guildId ??
        props.guild?.id ??
        props.channel?.guild_id ??
        (props.channelId ? ChannelStore.getChannel(props.channelId)?.guild_id : undefined) ??
        SelectedGuildStore.getGuildId();
    if (!guildId) return;
    children.push(
        <Menu.MenuGroup key="bf-fake-roles">
            <Menu.MenuItem id="bf-fake-roles" label="Cargos visuais">
                <Menu.MenuItem
                    id="bf-role-editor"
                    label="Gerenciar cargos visuais"
                    action={() => open(guildId)}
                />
                {roles(guildId).map(role => {
                    const userId = props.user.id;
                    const real = GuildMemberStore.getMember(guildId, userId)?.roles ?? [];
                    const checked = visibleRoles(
                        real,
                        selection(guildId, userId),
                        roles(guildId).map(r => r.id)
                    ).includes(role.id);
                    return (
                        <Menu.MenuCheckboxItem
                            key={role.id}
                            id={`bf-role-${role.id}`}
                            label={role.name}
                            checked={checked}
                            action={() =>
                                save(
                                    guildId,
                                    userId,
                                    toggleRole(real, selection(guildId, userId), role.id, !checked)
                                )
                            }
                        />
                    );
                })}
            </Menu.MenuItem>
        </Menu.MenuGroup>
    );
};

function resolveContext(
    props: Record<string, any>,
    parent: ProfileRoleContext | null
): ProfileRoleContext | undefined {
    const userId =
        props.userId ??
        props.user?.id ??
        props.member?.userId ??
        props.member?.user?.id ??
        props.guildMember?.userId ??
        props.displayProfile?.userId ??
        props.userProfile?.userId ??
        props.profile?.userId ??
        parent?.userId;
    const guildId =
        props.guildId ??
        props.guild?.id ??
        props.member?.guildId ??
        props.displayProfile?.guildId ??
        parent?.guildId ??
        SelectedGuildStore.getGuildId();
    if (userId === UserStore.getCurrentUser()?.id && guildId && GuildStore.getGuild(guildId))
        return { userId, guildId };
}
function projectedProps(props: Record<string, any>, ctx: ProfileRoleContext) {
    const available = roles(ctx.guildId),
        selected = selection(ctx.guildId, ctx.userId);
    const next = { ...props };
    for (const key of ["member", "guildMember"])
        if (props[key]) next[key] = projectMember(props[key], selected, available, ctx.guildId);
    for (const key of ["roles", "roleIds"])
        if (Array.isArray(props[key])) {
            const real = GuildMemberStore.getMember(ctx.guildId, ctx.userId)?.roles ?? [];
            const selectedRoles = sortedVisibleRoles(real, selected, available, ctx.guildId);
            next[key] = props[key].some((r: any) => typeof r === "object")
                ? selectedRoles
                : selectedRoles.map(r => r.id);
        }
    return next;
}
function VisualRoleList({ userId, guildId }: ProfileRoleContext) {
    useChanges();
    const selected = sortedVisibleRoles(
        GuildMemberStore.getMember(guildId, userId)?.roles ?? [],
        selection(guildId, userId),
        roles(guildId),
        guildId
    );
    return (
        <section className="bf-profile-role-section">
            <h3>Cargos</h3>
            <div className="bf-profile-role-list">
                {selected.map(role => (
                    <span className="bf-profile-role" key={role.id}>
                        <span className="bf-role-dot" style={{ background: roleColour(role) }} />
                        {role.name}
                    </span>
                ))}
                <button
                    className="bf-profile-role-add"
                    aria-label="Gerenciar cargos visuais"
                    onClick={() => open(guildId)}
                >
                    +
                </button>
            </div>
        </section>
    );
}
function projectionContext(guildArg?: string, channelArg?: string) {
    if (
        (guildArg !== undefined && typeof guildArg !== "string") ||
        (channelArg !== undefined && typeof channelArg !== "string")
    )
        return;
    if (!active) return;
    const guildId =
        (guildArg && GuildStore.getGuild(guildArg)
            ? guildArg
            : ChannelStore.getChannel(channelArg ?? guildArg ?? "")?.guild_id) ??
        (!guildArg ? SelectedGuildStore.getGuildId() : undefined);
    const user = UserStore.getCurrentUser();
    if (!guildId || !user) return;
    return {
        guildId,
        userId: user.id,
        selection: settings.store.profiles?.[roleKey(user.id, guildId)],
        roles: roles(guildId),
        member: GuildMemberStore.getMember(guildId, user.id) ?? undefined,
        user,
        status: PresenceStore.getStatus(user.id),
        revision: version
    };
}
function bindRuntime() {
    bridge = createProfileBridge(React, {
        enabled: () => active,
        useChanges,
        resolve: resolveContext,
        hasSelection: ctx => !!settings.store.profiles?.[roleKey(ctx.userId, ctx.guildId)],
        project: projectedProps,
        renderRoles: ctx => <VisualRoleList {...ctx} />,
        renderAction: ctx => (
            <button className="bf-profile-role-add" onClick={() => open(ctx.guildId)}>
                Cargos visuais
            </button>
        )
    });
    function factory(source: any, key: string) {
        const original = source[key];
        if (typeof original !== "function") return;
        const wrapped = function (this: unknown, ...args: any[]) {
            return Reflect.apply(
                original,
                this,
                bridge ? bridge.patchArgs(args as [unknown, unknown?, ...unknown[]]) : args
            );
        };
        try {
            source[key] = wrapped;
        } catch {
            return;
        }
        disposers.push(() => {
            if (source[key] === wrapped) source[key] = original;
        });
    }
    factory(React, "createElement");
    waitFor(["jsx", "jsxs", "Fragment"], runtime => {
        if (active) {
            factory(runtime, "jsx");
            factory(runtime, "jsxs");
        }
    });
    for (const [names, mode] of [
        [profileExports, "profile"],
        [roleSectionExports, "roles"]
    ] as const)
        for (const name of names)
            waitFor([name], module => {
                if (active) bridge?.register(module[name], mode, name);
            });
    const list = ChannelMemberStore as any;
    displayStores.add(list);
    disposers.push(
        bindMemberListStore(list, projectionContext),
        bindSectionListStore(list, projectionContext)
    );
    for (const store of [
        GuildMemberStore,
        GuildRoleStore,
        PresenceStore,
        UserStore,
        ChannelMemberStore
    ] as any[]) {
        const changed = () => notify();
        store.addChangeListener?.(changed);
        disposers.push(() => store.removeChangeListener?.(changed));
    }
}

export default definePlugin({
    name: "FakeRoles",
    description:
        "Escolha cargos visuais para o seu perfil em cada servidor, visíveis somente no seu Discord.",
    authors: [{ name: "Haru", id: 1227436212982251533n }],
    enabledByDefault: false,
    settings,
    settingsAboutComponent: () => (
        <>
            <p>Abra seu perfil em um servidor com o botão direito e escolha Cargos visuais.</p>
            <Button onClick={() => open()}>Cargos do servidor selecionado</Button>
        </>
    ),
    contextMenus: { "user-context": contextMenu, "user-profile": contextMenu },
    patches: [
        {
            find: ".id,spacing:14,",
            replacement: {
                match: /(let\{member:\i[^}]*\}=)(\i)(?=[,;])/,
                replace: "$1$self.useVisualProfile($2)"
            }
        }
    ],
    start() {
        active = true;
        bindRuntime();
        notify(true);
    },
    stop() {
        active = false;
        for (const dispose of disposers.splice(0).reverse()) dispose();
        displayStores.clear();
        bridge = undefined;
        notify();
    },
    useVisualProfile<
        T extends {
            member?: { userId?: string; user?: { id: string }; roles?: string[]; guildId?: string };
            guildId?: string;
            guild?: { id: string };
        }
    >(props: T): T {
        useChanges();
        const userId = props.member?.userId ?? props.member?.user?.id;
        const guildId =
            props.guildId ?? props.guild?.id ?? props.member?.guildId ?? SelectedGuildStore.getGuildId();
        if (
            !active ||
            !guildId ||
            !userId ||
            userId !== UserStore.getCurrentUser()?.id ||
            !props.member?.roles
        )
            return props;
        const stored = settings.store.profiles?.[roleKey(userId, guildId)];
        if (!stored) return props;
        return {
            ...props,
            member: {
                ...props.member,
                roles: visibleRoles(
                    props.member.roles,
                    readSelection(stored),
                    roles(guildId).map(r => r.id)
                )
            }
        };
    }
});
