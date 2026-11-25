export interface BadgeLayout {
    revision: number
    order: string[]
    hidden: string[]
    updatedAt?: number
}
export interface BadgeLike {
    id?: unknown
    badge_id?: unknown
    layoutKey?: unknown
    infoLabel?: unknown
}
const nativeIds: Record<string, number> = {
    premium: 1,
    premium_tenure: 1,
    partner: 2,
    certified_moderator: 3,
    hypesquad: 4,
    hypesquad_house_1: 5,
    hypesquad_house_2: 6,
    hypesquad_house_3: 7,
    bug_hunter_level_1: 8,
    bug_hunter_level_2: 9,
    verified_developer: 10,
    early_supporter: 11,
    guild_booster: 12,
    premium_guild_subscription: 12,
    legacy_username: 13,
    quest_completed: 14,
    april_fools_2026: 15,
    orb_profile: 16,
    orb_profile_badge: 16,
    gifting: 17,
    account_age: 18,
    streaming: 19,
    game_time: 20,
    game_variety: 21,
    staff: 22,
    staff_hidden: 22,
    staff_personal: 22,
    orb_void: 23,
}
export function badgeKey(badge: BadgeLike): string | undefined {
    if (
        typeof badge.layoutKey === 'string' &&
        /^byaflux:[A-Za-z0-9_-]{1,80}$/.test(badge.layoutKey)
    )
        return badge.layoutKey
    const raw = badge.badge_id ?? badge.id
    if (
        typeof raw === 'number' &&
        Number.isInteger(raw) &&
        raw > 0 &&
        raw < 10000
    )
        return `discord:${raw}`
    if (typeof raw !== 'string') return
    if (/^byaflux_[A-Za-z0-9_-]+$/.test(raw)) return `byaflux:${raw.slice(8)}`
    const mobile = /^byaflux-\d{17,20}-official-([A-Za-z0-9_-]+)$/.exec(raw)
    if (mobile) return `byaflux:${mobile[1]}`
    if (/^(?:vc-|byaflux-|equicord_|vencord_|user_plugin_)/.test(raw)) return
    if (/^\d{1,4}$/.test(raw)) return `discord:${Number(raw)}`
    const id = raw.toLowerCase()
    const family = /^(?:premium_tenure|premium_tier_)/.test(id)
        ? 1
        : /^(?:guild_booster|premium_guild_subscription)(?:_|$)/.test(id)
          ? 12
          : nativeIds[id]
    if (family) return `discord:${family}`
    if (badge.infoLabel && badge.infoLabel !== 'Discord') return
    if (/^[a-z][a-z0-9_]{0,100}$/.test(id)) return `discord:${id}`
}
export function readBadgeLayout(value: unknown): BadgeLayout | null {
    if (!value || typeof value !== 'object') return null
    const input = value as BadgeLayout
    if (
        !Number.isSafeInteger(input.revision) ||
        input.revision < 1 ||
        !Array.isArray(input.order) ||
        !Array.isArray(input.hidden)
    )
        return null
    const valid = (key: unknown): key is string =>
        typeof key === 'string' &&
        /^(?:byaflux:[A-Za-z0-9_-]{1,80}|discord:[a-z0-9_:-]{1,100})$/.test(key)
    return {
        revision: input.revision,
        order: [...new Set(input.order.filter(valid))].slice(0, 256),
        hidden: [...new Set(input.hidden.filter(valid))].slice(0, 128),
        updatedAt: input.updatedAt,
    }
}
export function applyBadgeLayout<T extends BadgeLike>(
    badges: T[],
    layout: BadgeLayout | null,
): T[] {
    if (!layout) return badges
    const hidden = new Set(layout.hidden)
    const visible = badges.filter(b => !hidden.has(badgeKey(b) ?? ''))
    const ranks = new Map(layout.order.map((key, i) => [key, i]))
    const known = visible
        .filter(b => badgeKey(b))
        .map((badge, i) => ({ badge, i }))
    known.sort(
        (a, b) =>
            (ranks.get(badgeKey(a.badge)!) ?? Infinity) -
                (ranks.get(badgeKey(b.badge)!) ?? Infinity) || a.i - b.i,
    )
    let index = 0
    return visible.map(b => (badgeKey(b) ? known[index++].badge : b))
}
export function moveLayoutItem(
    order: string[],
    key: string,
    target: string,
): string[] {
    const from = order.indexOf(key),
        to = order.indexOf(target)
    if (from < 0 || to < 0 || from === to) return order
    const result = [...order]
    result.splice(from, 1)
    result.splice(to, 0, key)
    return result
}
