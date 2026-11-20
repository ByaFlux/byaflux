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
import {
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
    orderedRoles,
    readSelection,
    roleColour,
    roleKey,
    RoleSelection,
    toggleRole,
    visibleRoles
} from "./model";

const settings = definePluginSettings({}).withPrivateSettings<{ profiles?: Record<string, RoleSelection> }>();
const listeners = new Set<() => void>();
let version = 0,
    active = false;
function notify() {
    version++;
    for (const fn of listeners) fn();
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
    return orderedRoles(GuildRoleStore.getSortedRoles(guildId), guildId);
}
function selection(guildId: string, userId: string) {
    return readSelection(settings.store.profiles?.[roleKey(userId, guildId)]);
}
function save(guildId: string, userId: string, value?: RoleSelection) {
    const next = { ...settings.store.profiles };
    if (value && (value.added.length || value.hidden.length)) next[roleKey(userId, guildId)] = value;
    else delete next[roleKey(userId, guildId)];
    settings.store.profiles = next;
    notify();
}
export function RoleEditor({ guildId, userId }: { guildId: string; userId: string }) {
    useChanges();
    const [query, setQuery] = React.useState("");
    const available = useStateFromStores([GuildRoleStore], () => roles(guildId));
    const real = useStateFromStores([GuildMemberStore], () => GuildMemberStore.getMember(guildId, userId)?.roles ?? []);
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
                <label className="bf-role-row">
                    <span className="bf-role-dot" />
                    <span>@everyone</span>
                    <input type="checkbox" checked disabled aria-label="@everyone (cargo padrão)" />
                </label>
                {shown.map(role => (
                    <label className="bf-role-row" key={role.id}>
                        <span className="bf-role-dot" style={{ background: roleColour(role) }} />
                        <span>
                            {role.name}
                            {role.managed && <small>Integração</small>}
                        </span>
                        <input
                            type="checkbox"
                            aria-label={role.name}
                            checked={selected.includes(role.id)}
                            onChange={e =>
                                save(
                                    guildId,
                                    userId,
                                    toggleRole(real, selection(guildId, userId), role.id, e.target.checked)
                                )
                            }
                        />
                    </label>
                ))}
                {!shown.length && <p>Nenhum cargo encontrado.</p>}
            </div>
            <Button onClick={() => save(guildId, userId)}>Restaurar cargos originais</Button>
        </div>
    );
}
function Panel({ guildId, userId, ...props }: RenderModalProps & { guildId: string; userId: string }) {
    return (
        <Modal {...props} title={`Cargos visuais · ${GuildStore.getGuild(guildId)?.name ?? "Servidor"}`} size="md">
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
        (props.channelId ? ChannelStore.getChannel(props.channelId)?.guild_id : undefined);
    if (!guildId) return;
    children.push(
        <Menu.MenuGroup key="bf-fake-roles">
            <Menu.MenuItem id="bf-fake-roles" label="Cargos visuais" action={() => open(guildId)} />
        </Menu.MenuGroup>
    );
};
export default definePlugin({
    name: "FakeRoles",
    description: "Escolha cargos visuais para o seu perfil em cada servidor, visíveis somente no seu Discord.",
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
            replacement: { match: /(let\{member:\i[^}]*\}=)(\i)(?=[,;])/, replace: "$1$self.useVisualProfile($2)" }
        }
    ],
    start() {
        active = true;
        notify();
    },
    stop() {
        active = false;
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
        const guildId = props.guildId ?? props.guild?.id ?? props.member?.guildId ?? SelectedGuildStore.getGuildId();
        if (!active || !guildId || !userId || userId !== UserStore.getCurrentUser()?.id || !props.member?.roles)
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
