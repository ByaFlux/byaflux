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
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={props.label}
            onPress={() =>
                Alert.alert(props.label, 'Badge exibida pelo ByaFlux.')
            }
        >
            <Image
                source={props.source}
                style={{ width: 24, height: 24 }}
                resizeMode="contain"
            />
        </Pressable>
    )
}

function profileProps(props: Record<string, unknown>) {
    if (typeof props.userId !== 'string') return props
    const catalog = badgeState.badges(props.userId).map(b => ({
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
    return {
        ...props,
        badges: Array.isArray(props.badges)
            ? badgeState.merge(props.badges, props.userId)
            : props.badges,
        catalogBadges: Array.isArray(props.catalogBadges)
            ? [
                  ...catalog,
                  ...badgeState
                      .merge(props.catalogBadges, props.userId)
                      .filter(
                          b => !isRecord(b) || !String(b.id).startsWith(Prefix),
                      ),
              ]
            : props.catalogBadges,
        style: badgeState.isExtended()
            ? [props.style, { flexWrap: 'wrap', rowGap: 4, flexShrink: 1 }]
            : props.style,
    }
}

export function connectProfiles(cleanup: PluginCleanupApi) {
    matchedBadgeHooks = 0
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
    cleanup(
        getModules(
            withProps<Record<string, unknown>>(
                'MAX_DISPLAYED_PROFILE_BADGES',
                'getProfileBadgeIconUrl',
            ),
            module => {
                const descriptor = Object.getOwnPropertyDescriptor(
                    module,
                    'MAX_DISPLAYED_PROFILE_BADGES',
                )
                if (!descriptor?.configurable) return
                const original = module.MAX_DISPLAYED_PROFILE_BADGES
                Object.defineProperty(module, 'MAX_DISPLAYED_PROFILE_BADGES', {
                    configurable: true,
                    enumerable: descriptor.enumerable,
                    get: () =>
                        badgeState.isExtended()
                            ? Number.MAX_SAFE_INTEGER
                            : original,
                })
                cleanup(() => {
                    Object.defineProperty(
                        module,
                        'MAX_DISPLAYED_PROFILE_BADGES',
                        descriptor,
                    )
                })
            },
        ),
    )
}
