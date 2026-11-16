/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { getBadgeRevision, notifyBadgeUpdates, ProfileBadge, subscribeToBadgeUpdates } from "@api/Badges";
import type { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { StarFilled } from "@components/Icons";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { ContextMenuApi, Menu, Modal, openModal, React, UserStore } from "@webpack/common";
import type { RenderModalProps } from "@vencord/discord-types";
import type { ComponentType } from "react";

import { BadgeEditor } from "./editor";
import { accountContextPatch, accountPatch, applyLocalBadges, BadgeSelection, emptySelection, profilePatch } from "./local";

const settings = definePluginSettings({}).withPrivateSettings<{ profiles?: Record<string, BadgeSelection>; }>();
let active = false;

interface AccountActionProps {
    label: string;
    icon: ComponentType;
    onClick(): void;
}

function BadgePanel({ userId, ...props }: RenderModalProps & { userId: string; }) {
    React.useSyncExternalStore(subscribeToBadgeUpdates, getBadgeRevision, getBadgeRevision);
    const selection = settings.store.profiles?.[userId] ?? emptySelection;
    function save(change: Partial<BadgeSelection>) {
        settings.store.profiles = { ...settings.store.profiles, [userId]: { ...(settings.store.profiles?.[userId] ?? emptySelection), ...change } };
        notifyBadgeUpdates();
    }
    return <Modal {...props} title="Set badges" size="md">
        <BadgeEditor selection={selection} save={save} />
    </Modal>;
}

function openBadgeEditor() {
    const userId = UserStore.getCurrentUser()?.id;
    if (userId) openModal(props => <SafeBadgePanel {...props} userId={userId} />);
}

const SafeBadgePanel = ErrorBoundary.wrap(BadgePanel, { noop: true });
const AccountBadgeAction = ErrorBoundary.wrap(({ Row, close }: { Row: ComponentType<AccountActionProps>; close(): void; }) => active ? <Row
    label="Set badges" icon={() => <StarFilled width={16} height={16} />} onClick={() => { close(); openBadgeEditor(); }}
/> : null, { noop: true });

const SelfBadgeContextMenu = ErrorBoundary.wrap(() => <Menu.Menu
    navId="byaflux-profilebadges-self" aria-label="ProfileBadges" onClose={ContextMenuApi.closeContextMenu}
>
    <Menu.MenuItem id="byaflux-profilebadges-edit" label="Set badges" action={openBadgeEditor}
        leadingAccessory={{ type: "icon", icon: StarFilled }} />
</Menu.Menu>, { noop: true });

const userContextMenu: NavContextMenuPatchCallback = (children, { user }: { user?: { id: string; }; }) => {
    const currentUserId = UserStore.getCurrentUser()?.id;
    if (!currentUserId || user?.id !== currentUserId) return;
    children.push(<Menu.MenuGroup key="byaflux-profilebadges">
        <Menu.MenuItem id="byaflux-profilebadges-edit" label="Set badges" action={openBadgeEditor}
            leadingAccessory={{ type: "icon", icon: StarFilled }} />
    </Menu.MenuGroup>);
};

export default definePlugin({
    name: "ProfileBadges",
    description: "Escolha badges visuais para o seu perfil, visíveis somente no seu Discord.",
    authors: [Devs.Ven],
    enabledByDefault: true,
    dependencies: ["BadgeAPI"],
    settings,
    patches: [profilePatch, accountPatch, accountContextPatch],
    settingsAboutComponent: () => <Button onClick={openBadgeEditor}>Set badges</Button>,
    toolboxActions: { "Set badges": openBadgeEditor },
    contextMenus: {
        "user-context": userContextMenu,
        "user-profile": userContextMenu,
        "vc-ap-server-profile"(children) {
            userContextMenu(children, { user: UserStore.getCurrentUser() });
        }
    },
    start() { active = true; notifyBadgeUpdates(); },
    stop() { active = false; notifyBadgeUpdates(); },
    applyLocalBadges(userId: string | undefined, badges: ProfileBadge[]) {
        const currentUserId = UserStore.getCurrentUser()?.id;
        return active ? applyLocalBadges(userId, currentUserId, badges, currentUserId ? settings.store.profiles?.[currentUserId] : undefined) : badges;
    },
    openSelfContextMenu(event: React.MouseEvent) {
        if (!active || isPluginEnabled("AccountPanelServerProfile")) return;
        ContextMenuApi.openContextMenu(event, () => <SelfBadgeContextMenu />);
    },
    renderAccountAction(Row: ComponentType<AccountActionProps>, close: () => void) {
        return <AccountBadgeAction Row={Row} close={close} />;
    }
});
