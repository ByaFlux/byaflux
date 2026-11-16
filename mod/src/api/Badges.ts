/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import ErrorBoundary from "@components/ErrorBoundary";
import globalBadges from "@equicordplugins/globalBadges";
import BadgeAPIPlugin from "@plugins/_api/badges";
import { ComponentType, HTMLProps } from "react";

import { isPluginEnabled } from "./PluginManager";

export const enum BadgePosition {
    START,
    END,
    /** Before every other custom badge group; native badges follow in the profile renderer. */
    FIRST
}

export enum BadgeRarity {
    COMMON = 1, // label hidden
    RARE = 2,
    EPIC = 3,
    MYTHIC = 5
}

export interface ProfileBadge {
    /**
     * Badge id, unused by vencord, required by discord
     */
    id: string,
    /** The tooltip to show on hover. Required for image badges */
    description?: string;
    /** Custom component for the badge (tooltip not included) */
    component?: ComponentType<ProfileBadge & BadgeUserArgs>;
    /** The custom image to use */
    iconSrc?: string;
    link?: string;
    /** Action to perform when you click the badge */
    onClick?(event: React.MouseEvent, props: ProfileBadge & BadgeUserArgs): void;
    /** Action to perform when you right click the badge */
    onContextMenu?(event: React.MouseEvent, props: ProfileBadge & BadgeUserArgs): void;
    /** Should the user display this badge? */
    shouldShow?(userInfo: BadgeUserArgs): boolean;
    /** Optional props (e.g. style) for the badge, ignored for component badges */
    props?: HTMLProps<HTMLImageElement>;
    /** Position within the profile badge row. FIRST also precedes donor and global groups. */
    position?: BadgePosition;
    /** The badge name to display, Discord uses this. Required for component badges */
    key?: string;
    /** Badge title in the directory modal */
    name?: string;
    /** Text in the directory modal's description card */
    detail?: string;
    /** Text next to "unlocked" in the directory modal header */
    infoLabel?: string;
    /** Higher resolution image for the directory modal */
    largeIconSrc?: string;
    /** ISO date shown as "Unlocked <date>" */
    obtainedAt?: string;
    /** Rarity label in the directory modal */
    rarity?: BadgeRarity;

    /**
     * Allows dynamically returning multiple badges.
     * Must not call hooks
     */
    getBadges?(userInfo: BadgeUserArgs): ProfileBadge[];
}

export interface DirectoryBadge {
    badge_id: string;
    name: string;
    description: string;
    info_label: string;
    rarity: BadgeRarity;
    simple_icon_url: string;
    complex_icon_static_url: string;
    obtained_at?: string;
    is_earnable: false;
    owned: true;
    hidden: false;
    tiers: [];
}

const Badges = new Set<ProfileBadge>();
const badgeListeners = new Set<() => void>();
let badgeRevision = 0;

export function subscribeToBadgeUpdates(listener: () => void) {
    badgeListeners.add(listener);
    return () => { badgeListeners.delete(listener); };
}

export function getBadgeRevision() {
    return badgeRevision;
}

export function notifyBadgeUpdates() {
    badgeRevision++;
    for (const listener of badgeListeners) listener();
}

/**
 * Register a new badge with the Badges API
 * @param badge The badge to register
 */
export function addProfileBadge(badge: ProfileBadge) {
    badge.component &&= ErrorBoundary.wrap(badge.component, { noop: true });
    Badges.add(badge);
    notifyBadgeUpdates();
}

/**
 * Unregister a badge from the Badges API
 * @param badge The badge to remove
 */
export function removeProfileBadge(badge: ProfileBadge) {
    const removed = Badges.delete(badge);
    if (removed) notifyBadgeUpdates();
    return removed;
}

/**
 * Inject badges into the profile badges array.
 * You probably don't need to use this.
 */
export function _getBadges(args: BadgeUserArgs) {
    const badges = [] as ProfileBadge[];
    const firstBadges = [] as ProfileBadge[];
    for (const badge of Badges) {
        if (badge.shouldShow && !badge.shouldShow(args)) {
            continue;
        }

        const b = badge.getBadges
            ? badge.getBadges(args).map(badge => ({
                ...args,
                ...badge,
                component: badge.component && ErrorBoundary.wrap(badge.component, { noop: true })
            }))
            : [{ ...args, ...badge }];

        if (badge.position === BadgePosition.FIRST) {
            firstBadges.push(...b);
        } else if (badge.position === BadgePosition.START) {
            badges.unshift(...b);
        } else {
            badges.push(...b);
        }
    }

    const donorBadges = BadgeAPIPlugin.getDonorBadges(args.userId);
    const equicordDonorBadges = BadgeAPIPlugin.getEquicordDonorBadges(args.userId);
    const GlobalBadges = isPluginEnabled(globalBadges.name) ? globalBadges.getGlobalBadges(args.userId) : false;

    // do globalbadges first so it shows before the contrib badges but after donor badges
    if (GlobalBadges) {
        badges.unshift(
            ...GlobalBadges.map(badge => ({
                ...args,
                ...badge,
            }))
        );
    }

    if (donorBadges) {
        badges.unshift(
            ...donorBadges.map(badge => ({
                ...args,
                ...badge,
            }))
        );
    }

    if (equicordDonorBadges) {
        badges.unshift(
            ...equicordDonorBadges.map(badge => ({
                ...args,
                ...badge,
            }))
        );
    }

    return [...firstBadges, ...badges];
}

export interface BadgeUserArgs {
    userId: string;
    guildId: string;
}
