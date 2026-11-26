/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ProfileBadge } from "@api/Badges";

import {
  currentBadge,
  imageUrl,
  staticBadges,
  tieredBadges,
  TieredBadgeKey,
  BadgeLevel,
} from "./badges";

export interface BadgeSelection {
  selectedBadges: string[];
  nitroLevel: string;
  boostLevel: string;
  gameTimeLevel?: string;
  gameVarietyLevel?: string;
  streamingLevel?: string;
  giftingLevel?: string;
  order?: string[];
}

export const emptySelection: BadgeSelection = {
  selectedBadges: [],
  nitroLevel: "basic",
  boostLevel: "1m",
  gameTimeLevel: "1",
  gameVarietyLevel: "1",
  streamingLevel: "1",
  giftingLevel: "1",
};

export const badgeKeys = [
  ...staticBadges.map((badge) => badge.key),
  ...tieredBadges.map((badge) => badge.key),
];

export function badgeOrder(order: readonly string[] = []): string[] {
  return [...new Set([...order.filter((key) => badgeKeys.includes(key)), ...badgeKeys])];
}

export function readSelection(value: unknown): BadgeSelection {
  const raw = value && typeof value === "object" ? (value as Partial<BadgeSelection>) : {};
  const result: BadgeSelection = {
    ...emptySelection,
    selectedBadges: Array.isArray(raw.selectedBadges)
      ? [...new Set(raw.selectedBadges.filter((key) => badgeKeys.includes(key)))]
      : [],
    order: badgeOrder(Array.isArray(raw.order) ? raw.order : []),
  };
  for (const group of tieredBadges)
    result[group.field] = currentBadge(group.levels, raw[group.field]).id;
  return result;
}

export function moveBadge(order: readonly string[], from: number, to: number): string[] {
  const next = [...order];
  const [key] = next.splice(from, 1);
  next.splice(to, 0, key);
  return next;
}

export interface BadgeRect {
  top: number;
  height: number;
}

export function dragTarget(rects: readonly BadgeRect[], center: number): number {
  return Math.max(
    0,
    rects.findLastIndex((rect) => center >= rect.top + rect.height / 2),
  );
}

export function dragOffset(
  rects: readonly BadgeRect[],
  from: number,
  to: number,
  index: number,
): number {
  if (index === from)
    return to > from
      ? rects[to].top + rects[to].height - rects[from].top - rects[from].height
      : rects[to].top - rects[from].top;
  if (index > from && index <= to) return -rects[from].height;
  if (index >= to && index < from) return rects[from].height;
  return 0;
}

export function isSubscriptionBadge(badge: ProfileBadge, kind: TieredBadgeKey): boolean {
  const data = badge as ProfileBadge & {
    badge_id?: string | number;
    legacyBadgeId?: string | number;
    icon?: string;
    icon_src?: string;
    simple_icon_url?: string;
  };
  const group = tieredBadges.find((group) => group.key === kind)!;
  const ids = [badge.id, badge.key, data.badge_id, data.legacyBadgeId];
  const patterns: Record<TieredBadgeKey, RegExp> = {
    nitro: /^(?:premium|premium_tier_[123]|premium_tenure(?:_[a-z0-9]+)*|nitro(?:_[a-z0-9]+)*)$/i,
    boost:
      /^(?:guild_booster|guild_boosting|server_booster|premium_guild_subscription|boost)(?:_[a-z0-9]+)*$/i,
    gameTime: /^game_time(?:_[a-z0-9]+)*$/i,
    gameVariety: /^game_(?:variety|diversity)(?:_[a-z0-9]+)*$/i,
    streaming: /^streaming(?:_[a-z0-9]+)*$/i,
    gifting: /^gifting(?:_[a-z0-9]+)*$/i,
  };
  if (
    ids.some(
      (id) =>
        id === group.nativeId ||
        id === String(group.nativeId) ||
        (typeof id === "string" && patterns[kind].test(id)),
    )
  )
    return true;
  const icons = [badge.iconSrc, data.icon, data.icon_src, data.simple_icon_url];
  return icons.some(
    (icon) =>
      typeof icon === "string" &&
      (group.levels as readonly BadgeLevel[]).some(
        (level) =>
          icon.includes(level.hash) ||
          (!!level.source &&
            icon.includes(level.source.slice(level.source.lastIndexOf("/") + 1).split(".")[0])),
      ),
  );
}

export function applyLocalBadges(
  userId: string | undefined,
  currentUserId: string | undefined,
  badges: ProfileBadge[],
  selection = emptySelection,
): ProfileBadge[] {
  if (!currentUserId || userId !== currentUserId) return badges;
  selection = readSelection(selection);
  const selected = new Set(selection.selectedBadges);
  const chosen = staticBadges.filter((badge) => selected.has(badge.key));
  const groups = tieredBadges.filter((group) => selected.has(group.key));
  for (const group of groups) {
    const badge = currentBadge(group.levels, selection[group.field]);
    chosen.push({ key: group.key, title: `${group.title} · ${badge.title}`, hash: badge.hash });
  }
  const order = badgeOrder(selection.order);
  chosen.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  const replacedHashes = new Set(chosen.map((badge) => badge.hash));
  return [
    ...badges.filter(
      (badge) =>
        (typeof badge.id !== "string" || !badge.id.startsWith("byaflux-local-")) &&
        !groups.some((group) => isSubscriptionBadge(badge, group.key)) &&
        ![...replacedHashes].some((hash) => badge.iconSrc?.includes(hash)),
    ),
    ...chosen.map((badge) => ({
      id: `byaflux-local-${badge.key}`,
      name: badge.title,
      description: badge.title,
      detail: "Visual local. Esta badge não foi adicionada à sua conta do Discord.",
      infoLabel: "ByaFlux · Visual local",
      iconSrc: imageUrl(badge.hash),
    })),
  ];
}

export const accountPatch = {
  find: 'action:"PRESS_SWITCH_ACCOUNTS"',
  replacement: {
    match:
      /onCloseAccountPopout:(\i)\}\)(?=\]\}\)\}\),\(0,\i.jsx\)\(\i\.\i.Overlay,\{className:\i\.\i,children:\(0,\i.jsxs\)\(\i,\{children:\[\(0,\i.jsx\)\((\i),\{action:"PRESS_SWITCH_ACCOUNTS")/,
    replace: "$&,$self.renderAccountAction($2,$1)",
  },
};

export const accountContextPatch = {
  find: "handleOpenSettingsContextMenu=",
  replacement: {
    match: /(?<=focusProps:\{ringTarget:\i\},className:\i\.\i,)(?="data-jump-section":\i\})/,
    replace: "onContextMenu:$self.openSelfContextMenu,",
  },
};
