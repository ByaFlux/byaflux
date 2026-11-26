import { applyBadgeLayout } from './badge-layout'
import { imageUrl, staticBadges, tieredBadges } from './definitions'
import type { BadgeLayout } from './badge-layout'
import type { BadgeLevel, TieredBadgeKey } from './definitions'

export const Prefix = 'byaflux-'
export type NativeBadge = Record<string, unknown>
export type Selection = {
    badges: string[]
    nitro: string
    boost: string
    gameTime?: string
    gameVariety?: string
    streaming?: string
    gifting?: string
}
export type FakeSettings = { target: string; users: Record<string, Selection> }
export type DisplayBadge = {
    id: string
    layoutKey?: string
    description: string
    icon: string
    iconSrc: string
}
export const emptySelection = (): Selection => ({
    badges: [],
    nitro: '',
    boost: '',
    gameTime: '',
    gameVariety: '',
    streaming: '',
    gifting: '',
})
export const isRecord = (x: unknown): x is Record<string, unknown> =>
    x !== null && typeof x === 'object' && !Array.isArray(x)

const listeners = new Set<() => void>()
let revision = 0
let remoteProvider: ((userId: string) => DisplayBadge[]) | undefined
let layoutProvider: ((userId: string) => BadgeLayout | null) | undefined
let fake: FakeSettings | undefined
const nativeHashes = tieredBadges.flatMap(group =>
    group.levels.map(x => x.hash),
)

export const badgeState = {
    status: 'Carregando catálogo',
    subscribe(fn: () => void) {
        listeners.add(fn)
        return () => {
            listeners.delete(fn)
        }
    },
    snapshot: () => revision,
    changed() {
        revision++
        for (const fn of listeners) fn()
    },
    setRemoteProvider(value: ((userId: string) => DisplayBadge[]) | undefined) {
        remoteProvider = value
        this.changed()
    },
    setLayoutProvider(value: typeof layoutProvider) {
        layoutProvider = value
        this.changed()
    },
    layout(userId: string) {
        return layoutProvider?.(userId) ?? null
    },
    arrange<T extends Record<string, unknown>>(
        badges: T[],
        userId: string,
    ): T[] {
        return applyBadgeLayout(
            applyNitroVisibility(badges, this.layout(userId)),
            this.layout(userId),
        )
    },
    getFake: () => fake,
    setFake(value: FakeSettings | undefined) {
        fake = value ? readFakeSettings(value) : undefined
        this.changed()
    },
    badges(userId: string): DisplayBadge[] {
        const result: DisplayBadge[] = [...(remoteProvider?.(userId) ?? [])]
        const selected = fake?.users[userId]
        if (selected) {
            for (const key of selected.badges) {
                const badge = staticBadges.find(b => b.key === key)
                if (badge)
                    result.push({
                        id: `${Prefix}${userId}-fake-${key}`,
                        description: badge.title,
                        icon: 'dummy',
                        iconSrc: imageUrl(badge.hash),
                    })
            }
            for (const group of tieredBadges) {
                const badge = group.levels.find(
                    b => b.id === selected[group.key],
                )
                if (badge)
                    result.push({
                        id: `${Prefix}${userId}-fake-${group.key}`,
                        description: `${group.title}: ${badge.title}`,
                        icon: 'dummy',
                        iconSrc: imageUrl(badge.hash),
                    })
            }
        }
        return applyNitroVisibility(result, this.layout(userId))
    },
    merge(original: unknown[], userId: string): unknown[] {
        const selection = fake?.users[userId]
        const native = original.filter(item => {
            if (!isRecord(item)) return true
            if (
                typeof (item.id ?? item.badge_id) === 'string' &&
                String(item.id ?? item.badge_id).startsWith(Prefix)
            )
                return false
            if (
                selection &&
                tieredBadges.some(
                    group =>
                        selection[group.key] &&
                        isTieredNativeBadge(item, group.key),
                )
            )
                return false
            return true
        })
        return this.arrange(
            [...this.badges(userId), ...native] as Record<string, unknown>[],
            userId,
        )
    },
    props(id: unknown) {
        if (typeof id !== 'string' || !id.startsWith(Prefix)) return undefined
        const userId = /^byaflux-(\d{17,20})-/.exec(id)?.[1]
        const badge = userId
            ? this.badges(userId).find(b => b.id === id)
            : undefined
        return badge
            ? { source: { uri: badge.iconSrc }, label: badge.description }
            : undefined
    },
    hasReplacement(userId: string, kind: TieredBadgeKey) {
        return !!fake?.users[userId]?.[kind]
    },
    nativeHashes,
}

export function applyNitroVisibility<T>(
    badges: T[],
    layout: BadgeLayout | null,
): T[] {
    if (!layout?.hidden.includes('discord:1')) return badges
    return badges.filter(badge => {
        if (!isRecord(badge)) return true
        if (
            typeof badge.id === 'string' &&
            /^byaflux-\d{17,20}-fake-nitro$/.test(badge.id)
        )
            return false
        if (
            typeof badge.layoutKey === 'string' &&
            badge.layoutKey.startsWith('byaflux:')
        )
            return true
        if (
            typeof badge.id === 'string' &&
            (badge.id.startsWith('byaflux_') ||
                /^byaflux-\d{17,20}-official-/.test(badge.id))
        )
            return true
        return !isTieredNativeBadge(badge, 'nitro')
    })
}

export function readFakeSettings(value: unknown): FakeSettings {
    const result: FakeSettings = { target: '', users: {} }
    if (!isRecord(value)) return result
    if (typeof value.target === 'string') result.target = value.target
    if (!isRecord(value.users)) return result
    for (const [id, selection] of Object.entries(value.users)) {
        if (!/^\d{17,20}$/.test(id) || !isRecord(selection)) continue
        result.users[id] = {
            badges: Array.isArray(selection.badges)
                ? [
                      ...new Set(
                          selection.badges.filter(
                              (key): key is string =>
                                  typeof key === 'string' &&
                                  staticBadges.some(b => b.key === key),
                          ),
                      ),
                  ]
                : [],
            nitro: '',
            boost: '',
        }
        for (const group of tieredBadges) {
            const value = selection[group.key]
            result.users[id]![group.key] =
                typeof value === 'string' &&
                group.levels.some(level => level.id === value)
                    ? value
                    : ''
        }
    }
    return result
}

export function isTieredNativeBadge(
    badge: NativeBadge,
    kind: TieredBadgeKey,
): boolean {
    const group = tieredBadges.find(group => group.key === kind)!
    const ids = [badge.id, badge.badge_id, badge.legacyBadgeId, badge.key]
    const patterns: Record<TieredBadgeKey, RegExp> = {
        nitro: /^(?:premium|premium_tier_[123]|premium_tenure(?:_[a-z0-9]+)*|nitro(?:_[a-z0-9]+)*)$/i,
        boost: /^(?:guild_booster|guild_boosting|server_booster|premium_guild_subscription|boost)(?:_[a-z0-9]+)*$/i,
        gameTime: /^game_time(?:_[a-z0-9]+)*$/i,
        gameVariety: /^game_(?:variety|diversity)(?:_[a-z0-9]+)*$/i,
        streaming: /^streaming(?:_[a-z0-9]+)*$/i,
        gifting: /^gifting(?:_[a-z0-9]+)*$/i,
    }
    if (
        ids.some(
            id =>
                id === group.nativeId ||
                id === String(group.nativeId) ||
                (typeof id === 'string' && patterns[kind].test(id)),
        )
    )
        return true
    const icons = [
        badge.iconSrc,
        badge.icon,
        badge.icon_src,
        badge.simple_icon_url,
        badge.simple_icon_raster_url,
    ]
    return icons.some(
        icon =>
            typeof icon === 'string' &&
            (group.levels as readonly BadgeLevel[]).some(
                level =>
                    icon.includes(level.hash) ||
                    (!!level.source &&
                        icon.includes(
                            level.source
                                .slice(level.source.lastIndexOf('/') + 1)
                                .split('.')[0],
                        )),
            ),
    )
}
