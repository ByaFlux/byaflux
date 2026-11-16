/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ProfileBadge } from "@api/Badges";

import { boostLevels, currentBadge, imageUrl, nitroLevels, staticBadges } from "./badges";

export interface BadgeSelection {
    selectedBadges: string[];
    nitroLevel: string;
    boostLevel: string;
    order?: string[];
}

export const emptySelection: BadgeSelection = { selectedBadges: [], nitroLevel: "basic", boostLevel: "1m" };

export const badgeKeys = [...staticBadges.map(badge => badge.key), "nitro", "boost"];

export function badgeOrder(order: readonly string[] = []): string[] {
    return [...new Set([...order.filter(key => badgeKeys.includes(key)), ...badgeKeys])];
}

export function moveBadge(order: readonly string[], from: number, to: number): string[] {
    const next = [...order];
    const [key] = next.splice(from, 1);
    next.splice(to, 0, key);
    return next;
}

export interface BadgeRect { top: number; height: number; }

export function dragTarget(rects: readonly BadgeRect[], center: number): number {
    return Math.max(0, rects.findLastIndex(rect => center >= rect.top + rect.height / 2));
}

export function dragOffset(rects: readonly BadgeRect[], from: number, to: number, index: number): number {
    if (index === from) return to > from
        ? rects[to].top + rects[to].height - rects[from].top - rects[from].height
        : rects[to].top - rects[from].top;
    if (index > from && index <= to) return -rects[from].height;
    if (index >= to && index < from) return rects[from].height;
    return 0;
}

export function applyLocalBadges(userId: string | undefined, currentUserId: string | undefined, badges: ProfileBadge[], selection = emptySelection): ProfileBadge[] {
    if (!currentUserId || userId !== currentUserId) return badges;
    const selected = new Set(selection.selectedBadges);
    const chosen = staticBadges.filter(badge => selected.has(badge.key));
    if (selected.has("nitro")) {
        const badge = currentBadge(nitroLevels, selection.nitroLevel);
        chosen.push({ key: "nitro", title: `Discord Nitro · ${badge.title}`, hash: badge.hash });
    }
    if (selected.has("boost")) {
        const badge = currentBadge(boostLevels, selection.boostLevel);
        chosen.push({ key: "boost", title: `Server Boost · ${badge.title}`, hash: badge.hash });
    }
    const order = badgeOrder(selection.order);
    chosen.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
    const replacedHashes = new Set(chosen.map(badge => badge.hash));
    if (selected.has("nitro")) nitroLevels.forEach(badge => replacedHashes.add(badge.hash));
    if (selected.has("boost")) boostLevels.forEach(badge => replacedHashes.add(badge.hash));
    return [
        ...badges.filter(badge => !badge.id.startsWith("byaflux-local-") && ![...replacedHashes].some(hash => badge.iconSrc?.includes(hash))),
        ...chosen.map(badge => ({
            id: `byaflux-local-${badge.key}`,
            name: badge.title,
            description: badge.title,
            detail: "Visual local. Esta badge não foi adicionada à sua conta do Discord.",
            infoLabel: "ByaFlux · Visual local",
            iconSrc: imageUrl(badge.hash)
        }))
    ];
}

export const profilePatch = {
    find: "UserProfileBadgeListRows",
    replacement: {
        match: /let (\i)=(\i)(?=;if\(null!=\i\)\{let \i=new Set\(\2.map)/,
        replace: "let $1=$self.applyLocalBadges(arguments[0].displayProfile?.userId,$2)"
    }
};

export const accountPatch = {
    find: 'action:"PRESS_SWITCH_ACCOUNTS"',
    replacement: {
        match: /onCloseAccountPopout:(\i)\}\)(?=\]\}\)\}\),\(0,\i.jsx\)\(\i\.\i.Overlay,\{className:\i\.\i,children:\(0,\i.jsxs\)\(\i,\{children:\[\(0,\i.jsx\)\((\i),\{action:"PRESS_SWITCH_ACCOUNTS")/,
        replace: "$&,$self.renderAccountAction($2,$1)"
    }
};

export const accountContextPatch = {
    find: "handleOpenSettingsContextMenu=",
    replacement: {
        match: /(?<=focusProps:\{ringTarget:\i\},className:\i\.\i,)(?="data-jump-section":\i\})/,
        replace: "onContextMenu:$self.openSelfContextMenu,"
    }
};
