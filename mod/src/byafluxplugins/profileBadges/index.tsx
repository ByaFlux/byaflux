/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { notifyBadgeUpdates, ProfileBadge } from "@api/Badges";
import type { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { FormSwitch } from "@components/FormSwitch";
import { StarFilled } from "@components/Icons";
import { Paragraph } from "@components/Paragraph";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { ContextMenuApi, Menu, Modal, openModal, React, Select, UserStore } from "@webpack/common";
import type { RenderModalProps } from "@vencord/discord-types";
import type { ComponentType } from "react";

import { boostLevels, currentBadge, imageUrl, nitroLevels, staticBadges } from "./badges";
import { accountContextPatch, accountPatch, applyLocalBadges, BadgeSelection, emptySelection, profilePatch } from "./local";

const settings = definePluginSettings({}).withPrivateSettings<{ profiles?: Record<string, BadgeSelection>; }>();
const PROFILE_KEYS: "profiles"[] = ["profiles"];
let active = false;

interface AccountActionProps {
    label: string;
    icon: ComponentType;
    onClick(): void;
}

function LevelPicker({ levels, value, onChange }: {
    levels: typeof nitroLevels;
    value: string;
    onChange(value: string): void;
}) {
    return <Select
        options={levels.map(level => ({ value: level.id, label: level.title }))}
        isSelected={id => id === value}
        select={onChange}
        serialize={id => id}
        renderOptionLabel={option => <span className="vc-profilebadges-option"><img src={imageUrl(currentBadge(levels, option.value).hash)} alt="" />{option.label}</span>}
        renderOptionValue={options => options.map(option => <span key={option.value} className="vc-profilebadges-option"><img src={imageUrl(currentBadge(levels, option.value).hash)} alt="" />{option.label}</span>)}
    />;
}

function BadgePanel({ userId, ...props }: RenderModalProps & { userId: string; }) {
    const { profiles } = settings.use(PROFILE_KEYS);
    const selection = profiles?.[userId] ?? emptySelection;
    function save(change: Partial<BadgeSelection>) {
        settings.store.profiles = { ...settings.store.profiles, [userId]: { ...(settings.store.profiles?.[userId] ?? emptySelection), ...change } };
        notifyBadgeUpdates();
    }
    function toggle(key: string, enabled: boolean) {
        const current = settings.store.profiles?.[userId] ?? emptySelection;
        save({ selectedBadges: enabled ? [...new Set([...current.selectedBadges, key])] : current.selectedBadges.filter(item => item !== key) });
    }
    return <Modal {...props} title="Set badges" size="md">
        <div className="vc-profilebadges-content">
            <Paragraph>Somente você vê estas alterações. Elas não concedem Nitro, benefícios ou badges reais.</Paragraph>
            {staticBadges.map(badge => <FormSwitch key={badge.key}
                title={<span className="vc-profilebadges-option"><img src={imageUrl(badge.hash)} alt="" />{badge.title}</span>}
                value={selection.selectedBadges.includes(badge.key)} onChange={enabled => toggle(badge.key, enabled)} />)}
            <FormSwitch title="Discord Nitro" value={selection.selectedBadges.includes("nitro")} onChange={enabled => toggle("nitro", enabled)} />
            {selection.selectedBadges.includes("nitro") && <LevelPicker levels={nitroLevels} value={selection.nitroLevel} onChange={nitroLevel => save({ nitroLevel })} />}
            <FormSwitch title="Server Boost" value={selection.selectedBadges.includes("boost")} onChange={enabled => toggle("boost", enabled)} />
            {selection.selectedBadges.includes("boost") && <LevelPicker levels={boostLevels} value={selection.boostLevel} onChange={boostLevel => save({ boostLevel })} />}
            <Button variant="secondary" onClick={() => save({ ...emptySelection, selectedBadges: [] })}>Restaurar badges reais</Button>
        </div>
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
