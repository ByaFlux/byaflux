import { applyBadgeLayout } from './badge-layout'
import { boostLevels, imageUrl, nitroLevels, staticBadges } from './definitions'
import type { BadgeLayout } from './badge-layout'

export const Prefix = 'byaflux-'
export type NativeBadge = Record<string, unknown>
export type Selection = { badges: string[]; nitro: string; boost: string }
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
})
export const isRecord = (x: unknown): x is Record<string, unknown> =>
    x !== null && typeof x === 'object' && !Array.isArray(x)

const listeners = new Set<() => void>()
let revision = 0
let remoteProvider: ((userId: string) => DisplayBadge[]) | undefined
let layoutProvider: ((userId: string) => BadgeLayout | null) | undefined
let fake: FakeSettings | undefined
const nativeHashes = [...nitroLevels, ...boostLevels].map(x => x.hash)

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
        return applyBadgeLayout(badges, this.layout(userId))
    },
    getFake: () => fake,
    setFake(value: FakeSettings | undefined) {
        fake = value
        this.changed()
    },
    badges(userId: string): DisplayBadge[] {
        const result: DisplayBadge[] = remoteProvider?.(userId) ?? []
        const selected = this.layout(userId) ? undefined : fake?.users[userId]
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
            for (const [kind, id, levels] of [
                ['nitro', selected.nitro, nitroLevels],
                ['boost', selected.boost, boostLevels],
            ] as const) {
                const badge = levels.find(b => b.id === id)
                if (badge)
                    result.push({
                        id: `${Prefix}${userId}-fake-${kind}`,
                        description: `${kind === 'nitro' ? 'Nitro' : 'Boost'}: ${badge.title}`,
                        icon: 'dummy',
                        iconSrc: imageUrl(badge.hash),
                    })
            }
        }
        return result
    },
    merge(original: unknown[], userId: string): unknown[] {
        const selection = this.layout(userId) ? undefined : fake?.users[userId]
        const native = original.filter(item => {
            if (!isRecord(item)) return true
            if (
                typeof (item.id ?? item.badge_id) === 'string' &&
                String(item.id ?? item.badge_id).startsWith(Prefix)
            )
                return false
            const id = String(item.id ?? item.badge_id ?? '').toLowerCase()
            const image = String(
                item.iconSrc ?? item.icon ?? item.simple_icon_raster_url ?? '',
            )
            if (
                selection?.nitro &&
                (id === 'premium' ||
                    /^(premium_tenure|nitro)(_|$)/.test(id) ||
                    nitroLevels.some(b => image.includes(b.hash)))
            )
                return false
            if (
                selection?.boost &&
                (/^(guild_booster|premium_guild_subscription|boost)(_|$)/.test(
                    id,
                ) ||
                    boostLevels.some(b => image.includes(b.hash)))
            )
                return false
            return true
        })
        return applyBadgeLayout(
            [...this.badges(userId), ...native] as Record<string, unknown>[],
            this.layout(userId),
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
    hasReplacement(userId: string, kind: 'nitro' | 'boost') {
        return !this.layout(userId) && !!fake?.users[userId]?.[kind]
    },
    nativeHashes,
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
            nitro:
                typeof selection.nitro === 'string' &&
                nitroLevels.some(b => b.id === selection.nitro)
                    ? selection.nitro
                    : '',
            boost:
                typeof selection.boost === 'string' &&
                boostLevels.some(b => b.id === selection.boost)
                    ? selection.boost
                    : '',
        }
    }
    return result
}
