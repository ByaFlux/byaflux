import { getStore } from '@valenced/discord/flux'
import { getModules } from '@valenced/modules/finders'
import { withName, withProps } from '@valenced/modules/finders/filters'
import { before, instead } from '@valenced/patcher'
import { React, ReactJSXRuntime } from '@valenced/react'
import { useSyncExternalStore } from 'react'
import { Alert, Image, Pressable } from 'react-native'
import { badgeState, isRecord, Prefix } from './state'
import type { PluginCleanupApi } from '@valenced/plugins/types'

export let matchedBadgeHooks = 0
type UseBadges = (user: { userId: string } | null) => unknown[]

function LocalBadge({ id }: { id: string }) {
    const props = badgeState.props(id)
    if (!props) return null
    return React.createElement(
        Pressable,
        {
            accessibilityRole: 'button',
            accessibilityLabel: props.label,
            onPress: () =>
                Alert.alert(props.label, 'Badge exibida pelo ByaFlux.'),
        },
        React.createElement(Image, {
            source: props.source,
            style: { width: 24, height: 24 },
            resizeMode: 'contain',
        }),
    )
}

function catalogFor(original: unknown[], userId: string) {
    const own = badgeState.badges(userId).map(b => ({
        badge_id: b.id,
        name: b.description,
        info_label: b.description,
        description: b.description,
        owned: true,
        hidden: false,
        simple_icon_raster_url: b.iconSrc,
        complex_icon_static_url: b.iconSrc,
        tiers: [],
        current_tier: null,
        next_tier: null,
        requirements: [],
    }))
    const native = badgeState
        .merge(original, userId)
        .filter(b => !isRecord(b) || !String(b.id).startsWith(Prefix))
    return [...own, ...native]
}

function profileProps(props: Record<string, unknown>) {
    if (typeof props.userId !== 'string') return props
    return {
        ...props,
        badges: Array.isArray(props.badges)
            ? badgeState.merge(props.badges, props.userId)
            : props.badges,
        catalogBadges: Array.isArray(props.catalogBadges)
            ? catalogFor(props.catalogBadges, props.userId)
            : props.catalogBadges,
    }
}

export function connectProfiles(cleanup: PluginCleanupApi) {
    matchedBadgeHooks = 0
    const custom = (id: unknown) =>
        typeof id === 'string' && id.startsWith(Prefix)
    let userStore: { getCurrentUser(): { id: string } | undefined } | undefined
    cleanup(
        getStore<{ getCurrentUser(): { id: string } | undefined }>(
            'UserStore',
            store => {
                userStore = store
            },
        ),
    )
    cleanup(
        getStore<{
            getBadges(userId?: string): unknown[]
            getBadgeById(id: string | number, userId?: string): unknown
            emitChange(): void
        }>('BadgeDirectoryStore', directory => {
            cleanup(
                instead(directory, 'getBadges', function (args, original) {
                    const result = Reflect.apply(original, this, args)
                    const userId = args[0] ?? userStore?.getCurrentUser()?.id
                    return userId && Array.isArray(result)
                        ? catalogFor(result, userId)
                        : result
                }),
            )
            cleanup(
                instead(directory, 'getBadgeById', function (args, original) {
                    if (!custom(args[0]))
                        return Reflect.apply(original, this, args)
                    const userId = args[1] ?? userStore?.getCurrentUser()?.id
                    return userId
                        ? catalogFor([], userId).find(
                              b => isRecord(b) && b.badge_id === args[0],
                          )
                        : undefined
                }),
            )
            cleanup(badgeState.subscribe(() => directory.emitChange()))
        }),
    )
    cleanup(
        getModules(
            withProps<{
                resolveProfileBadgeId(
                    id: string | number,
                ): string | number | null
                toProfileBadgeLegacyId(id: string | number): string
            }>('resolveProfileBadgeId', 'toProfileBadgeLegacyId'),
            module => {
                cleanup(
                    instead(
                        module,
                        'resolveProfileBadgeId',
                        function (args, original) {
                            return custom(args[0])
                                ? args[0]
                                : Reflect.apply(original, this, args)
                        },
                    ),
                )
                cleanup(
                    instead(
                        module,
                        'toProfileBadgeLegacyId',
                        function (args, original) {
                            return custom(args[0])
                                ? String(args[0])
                                : Reflect.apply(original, this, args)
                        },
                    ),
                )
            },
        ),
    )
    cleanup(
        getModules(
            withProps<{
                getBadgeName(id: string | number): string
                getBadgeAssetFromCDN(icon: string): string
            }>('getBadgeName', 'getBadgeAssetFromCDN'),
            module => {
                cleanup(
                    instead(module, 'getBadgeName', function (args, original) {
                        return custom(args[0])
                            ? (badgeState.props(args[0])?.label ??
                                  String(args[0]))
                            : Reflect.apply(original, this, args)
                    }),
                )
            },
        ),
    )
    cleanup(
        getModules(
            withProps<{
                fetchBadge(id: string, ...args: unknown[]): unknown
                fetchBadgeSummary(id: string, ...args: unknown[]): unknown
            }>('fetchBadge', 'fetchBadgeSummary'),
            module => {
                for (const key of ['fetchBadge', 'fetchBadgeSummary'] as const)
                    cleanup(
                        instead(module, key, function (args, original) {
                            return custom(args[0])
                                ? Promise.resolve()
                                : Reflect.apply(original, this, args)
                        }),
                    )
            },
        ),
    )
    cleanup(
        getModules(
            withProps<{
                setPendingBadgeDisplayOrder(ids: (string | number)[]): unknown
                setPendingBadgeVisibility(
                    options: Record<string, unknown>,
                ): unknown
            }>('setPendingBadgeDisplayOrder', 'setPendingBadgeVisibility'),
            module => {
                cleanup(
                    instead(
                        module,
                        'setPendingBadgeDisplayOrder',
                        function (args, original) {
                            return args[0].some(custom)
                                ? undefined
                                : Reflect.apply(original, this, args)
                        },
                    ),
                )
                cleanup(
                    instead(
                        module,
                        'setPendingBadgeVisibility',
                        function (args, original) {
                            if (custom(args[0].badgeId)) return
                            const filtered = { ...args[0] }
                            for (const key of [
                                'hiddenBadgeIds',
                                'reorderableBadgeIds',
                            ]) {
                                if (Array.isArray(filtered[key]))
                                    filtered[key] = filtered[key].filter(
                                        id => !custom(id),
                                    )
                            }
                            return Reflect.apply(original, this, [filtered])
                        },
                    ),
                )
            },
        ),
    )
    cleanup(
        getModules(
            withName<UseBadges>('useBadges'),
            module => {
                if (
                    !('default' in module) ||
                    typeof module.default !== 'function'
                )
                    return
                matchedBadgeHooks++
                cleanup(
                    instead(module, 'default', function (args, original) {
                        useSyncExternalStore(
                            badgeState.subscribe,
                            badgeState.snapshot,
                        )
                        const badges = Reflect.apply(original, this, args)
                        return args[0]?.userId && Array.isArray(badges)
                            ? badgeState.merge(badges, args[0].userId)
                            : badges
                    }),
                )
            },
            { returnNamespace: true, max: Infinity },
        ),
    )
    function patch<Args extends [unknown, unknown?, ...unknown[]]>(
        args: Args,
    ): Args {
        const component = args[0]
        const type = isRecord(component) ? component.type : component
        const name = typeof type === 'function' ? type.name : undefined
        if (name === 'ProfileBadgeRows' && isRecord(args[1]))
            args[1] = profileProps(args[1])
        if (
            name === 'ProfileBadge' &&
            isRecord(args[1]) &&
            badgeState.props(args[1].id)
        )
            args[0] = LocalBadge
        return args
    }
    cleanup(
        before(ReactJSXRuntime, 'jsx', patch),
        before(ReactJSXRuntime, 'jsxs', patch),
        before(React, 'createElement', patch),
    )
}
