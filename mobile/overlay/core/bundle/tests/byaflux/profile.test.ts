import { describe, expect, it, vi } from 'vitest'

const fixtures = vi.hoisted(() => {
    const native = [
        {
            badge_id: 'premium',
            simple_icon_raster_url: 'native',
            name: 'Nitro',
        },
    ]
    const stores = {
        UserStore: { getCurrentUser: () => ({ id: '1227436212982251533' }) },
        BadgeDirectoryStore: {
            getBadges: () => native,
            getBadgeById: () => undefined,
            emitChange: vi.fn(),
        },
    }
    const fetchers = { fetchBadge: vi.fn(), fetchBadgeSummary: vi.fn() }
    const pending = {
        setPendingBadgeDisplayOrder: vi.fn(),
        setPendingBadgeVisibility: vi.fn(),
    }
    const ids = {
        resolveProfileBadgeId: () => null,
        toProfileBadgeLegacyId: () => 'native',
    }
    const limit = {
        MAX_DISPLAYED_PROFILE_BADGES: 6,
        getProfileBadgeIconUrl: () => '',
    }
    const useBadges = { default: () => [{ id: 'premium', icon: 'native' }] }
    const react = {
        createElement: (type: unknown, props: unknown) => ({ type, props }),
    }
    const jsx = {
        jsx: (type: unknown, props: unknown) => ({ type, props }),
        jsxs: (type: unknown, props: unknown) => ({ type, props }),
    }
    const modules = [fetchers, pending, ids, limit]
    return {
        stores,
        fetchers,
        pending,
        ids,
        limit,
        useBadges,
        react,
        jsx,
        modules,
    }
})
vi.mock('@valenced/discord/flux', () => ({
    getStore: (
        name: keyof typeof fixtures.stores,
        cb: (s: unknown) => void,
    ) => {
        cb(fixtures.stores[name])
        return () => {}
    },
}))
vi.mock('@valenced/modules/finders/filters', () => ({
    withName: (name: string) => ({ name }),
    withProps: (...props: string[]) => ({ props }),
}))
vi.mock('@valenced/modules/finders', () => ({
    getModules: (
        filter: { name?: string; props?: string[] },
        cb: (s: unknown) => void,
    ) => {
        if (filter.name === 'useBadges') cb(fixtures.useBadges)
        else
            for (const m of fixtures.modules)
                if (filter.props?.every(p => p in m)) cb(m)
        return () => {}
    },
}))
vi.mock('@valenced/patcher', () => ({
    instead: (
        obj: Record<string, (...args: unknown[]) => unknown>,
        key: string,
        cb: (...args: unknown[]) => unknown,
    ) => {
        const original = obj[key]
        obj[key] = function (...args: unknown[]) {
            return cb.call(this, args, original)
        }
        return () => {
            obj[key] = original
        }
    },
    before: (
        obj: Record<string, (...args: unknown[]) => unknown>,
        key: string,
        cb: (...args: unknown[]) => unknown,
    ) => {
        const original = obj[key]
        obj[key] = function (...args: unknown[]) {
            return Reflect.apply(original, this, cb(args) ?? args)
        }
        return () => {
            obj[key] = original
        }
    },
}))
vi.mock('@valenced/react', () => ({
    React: fixtures.react,
    ReactJSXRuntime: fixtures.jsx,
}))
vi.mock('react', () => ({ useSyncExternalStore: vi.fn() }))
vi.mock('react-native', () => ({
    Alert: { alert: vi.fn() },
    Image: () => null,
    Pressable: () => null,
}))

import { boostGems, setBoostGemsEnabled } from '../../src/byaflux/boost-gems'
import { connectProfiles } from '../../src/byaflux/profile'
import { badgeState } from '../../src/byaflux/state'

function ProfileBadgeRows() {
    return null
}
function ProfileBadge() {
    return null
}

describe('ByaFlux mobile profile integration', () => {
    it('keeps the native Boost component, touch handlers and dimensions for simulated gems', () => {
        const cleanup: (() => unknown)[] = []
        const id = '1227436212982251533'
        connectProfiles((...fns) => cleanup.push(...fns))
        try {
            setBoostGemsEnabled(true)
            badgeState.setFake({
                target: id,
                users: { [id]: { badges: [], nitro: '', boost: '24m' } },
            })
            const style = { width: 18, height: 18 },
                onPress = vi.fn()
            const props = { id: `byaflux-${id}-fake-boost`, style, onPress }
            const rendered = fixtures.jsx.jsx(ProfileBadge, props) as {
                type: unknown
                props: Record<string, unknown>
            }
            expect(rendered.type).toBe(ProfileBadge)
            expect(rendered.props.id).toBe('guild_booster_lvl9')
            expect(rendered.props.iconSrc).toBe(boostGems[8]!.image)
            expect(rendered.props.style).toBe(style)
            expect(rendered.props.onPress).toBe(onPress)
            expect(props.id).toBe(`byaflux-${id}-fake-boost`)
            setBoostGemsEnabled(false)
            const fallback = fixtures.jsx.jsx(ProfileBadge, props) as {
                type: unknown
            }
            expect(fallback.type).not.toBe(ProfileBadge)
        } finally {
            setBoostGemsEnabled(false)
            badgeState.setFake(undefined)
            for (const fn of cleanup.reverse()) fn()
        }
    })
    it('integrates badges locally and restores native methods on cleanup', async () => {
        const cleanup: (() => unknown)[] = []
        const originalFetch = fixtures.fetchers.fetchBadge
        const originalOrder = fixtures.pending.setPendingBadgeDisplayOrder
        connectProfiles((...fns) => {
            cleanup.push(...fns)
        })
        const id = '1227436212982251533'
        badgeState.setRemoteProvider(userId =>
            userId === id
                ? [
                      {
                          id: `byaflux-${id}-official-developer`,
                          description: 'Dev',
                          icon: 'dummy',
                          iconSrc: 'data:image/webp;base64,AAAA',
                      },
                  ]
                : [],
        )
        badgeState.setFake({
            target: id,
            users: { [id]: { badges: ['staff'], nitro: 'gold', boost: '' } },
        })
        const catalog = fixtures.stores.BadgeDirectoryStore.getBadges()
        expect(catalog.some(b => b.badge_id.startsWith('byaflux-'))).toBe(true)
        const custom = `byaflux-${id}-fake-nitro`
        const ids = fixtures.ids as unknown as {
            resolveProfileBadgeId(id: string): unknown
        }
        expect(ids.resolveProfileBadgeId(custom)).toBe(custom)
        const fetchers = fixtures.fetchers as unknown as {
            fetchBadge(id: string): Promise<void>
        }
        await fetchers.fetchBadge(custom)
        expect(originalFetch).not.toHaveBeenCalled()
        const pending = fixtures.pending as unknown as {
            setPendingBadgeDisplayOrder(ids: string[]): void
        }
        pending.setPendingBadgeDisplayOrder([custom])
        expect(originalOrder).not.toHaveBeenCalled()
        expect(fixtures.limit.MAX_DISPLAYED_PROFILE_BADGES).toBe(6)

        const rendered = fixtures.jsx.jsx(ProfileBadgeRows, {
            userId: id,
            badges: [],
        }) as { props: { badges: unknown[]; style: unknown[] } }
        expect(rendered.props.badges.length).toBeGreaterThan(0)
        expect(rendered.props.style).toBeUndefined()
        for (const fn of cleanup.reverse()) fn()
        expect(ids.resolveProfileBadgeId(custom)).toBe(null)
        expect(fixtures.limit.MAX_DISPLAYED_PROFILE_BADGES).toBe(6)
        expect(
            fixtures.stores.BadgeDirectoryStore.getBadges().some(b =>
                b.badge_id.startsWith('byaflux-'),
            ),
        ).toBe(false)
    })
})
