import Page from '@valenced/components/Page'
import { getStore } from '@valenced/discord/flux'
import { getModules } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { before, instead } from '@valenced/patcher'
import { registerInternalPlugin } from '@valenced/plugins/_'
import { React, ReactJSXRuntime } from '@valenced/react'
import { Image, ScrollView, Text, View } from 'react-native'
import {
    boostGems,
    getBoostGemImage,
    getUserBoostGem,
    replaceBoostGem,
    setBoostGemsEnabled,
} from '~/byaflux/boost-gems'
import { badgeState, isRecord } from '~/byaflux/state'
import manifest from './manifest.json'

registerInternalPlugin(manifest, {
    start({ cleanup }) {
        setBoostGemsEnabled(true)
        cleanup(() => {
            setBoostGemsEnabled(false)
            badgeState.changed()
        })
        for (const key of ['getBadgeAssetFromCDN', 'getProfileBadgeIconUrl']) {
            cleanup(
                getModules(
                    withProps<Record<string, (...args: unknown[]) => unknown>>(
                        key,
                    ),
                    module => {
                        if (typeof module[key] !== 'function') return
                        cleanup(
                            instead(module, key, function (args, original) {
                                const result = Reflect.apply(
                                    original,
                                    this,
                                    args,
                                )
                                if (typeof result === 'string')
                                    return getBoostGemImage(result) ?? result
                                if (
                                    isRecord(result) &&
                                    typeof result.uri === 'string'
                                ) {
                                    const image = getBoostGemImage(result.uri)
                                    if (image) return { ...result, uri: image }
                                }
                                return result
                            }),
                        )
                    },
                ),
            )
        }
        cleanup(
            getStore<{ getBadgeById(...args: unknown[]): unknown }>(
                'BadgeDirectoryStore',
                store => {
                    cleanup(
                        instead(
                            store,
                            'getBadgeById',
                            function (args, original) {
                                const result = Reflect.apply(
                                    original,
                                    this,
                                    args,
                                )
                                if (!isRecord(result)) return result
                                const userId = args[1]
                                const gem =
                                    (args[0] === 12 || args[0] === '12') &&
                                    typeof userId === 'string'
                                        ? getUserBoostGem(userId)
                                        : undefined
                                return replaceBoostGem(result, gem)
                            },
                        ),
                    )
                },
            ),
        )
        function imageSource<Args extends [unknown, unknown?, ...unknown[]]>(
            args: Args,
        ): Args {
            const props = args[1]
            if (!isRecord(props) || !isRecord(props.source)) return args
            const image = getBoostGemImage(props.source.uri)
            if (image && image !== props.source.uri)
                args[1] = { ...props, source: { ...props.source, uri: image } }
            return args
        }
        cleanup(
            before(ReactJSXRuntime, 'jsx', imageSource),
            before(ReactJSXRuntime, 'jsxs', imageSource),
            before(React, 'createElement', imageSource),
        )
        badgeState.changed()
    },
    SettingsComponent() {
        return (
            <ScrollView>
                <Page>
                    <Text style={{ color: '#fff', padding: 16 }}>
                        Gemas animadas para os nove níveis de Boost. A alteração
                        é visual, apenas no seu ByaFlux.
                    </Text>
                    {boostGems.map(gem => (
                        <View
                            key={gem.id}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 16,
                                padding: 12,
                            }}
                        >
                            <Image
                                source={{ uri: gem.image }}
                                style={{ width: 40, height: 40 }}
                                resizeMode="contain"
                            />
                            <Text style={{ color: '#fff' }}>
                                {gem.months}{' '}
                                {gem.months === 1 ? 'mês' : 'meses'}
                            </Text>
                        </View>
                    ))}
                </Page>
            </ScrollView>
        )
    },
})
