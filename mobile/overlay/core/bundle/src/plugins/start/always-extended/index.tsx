import { getModules } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { before } from '@valenced/patcher'
import { registerInternalPlugin } from '@valenced/plugins/_'
import { React, ReactJSXRuntime } from '@valenced/react'
import { Action, Panel } from '~/byaflux/mobile'
import { isRecord } from '~/byaflux/state'
import { expandBadgeLimit, expandedBadgeProps } from './limits'
import manifest from './manifest.json'

let matched = 0
registerInternalPlugin(manifest, {
    start({ cleanup, plugin }) {
        matched = 0
        const patched = new WeakSet<object>()
        cleanup(
            getModules(
                withProps<Record<string, unknown>>(
                    'MAX_DISPLAYED_PROFILE_BADGES',
                    'getProfileBadgeIconUrl',
                ),
                module => {
                    if (patched.has(module)) return
                    try {
                        const restore = expandBadgeLimit(module)
                        if (!restore) {
                            plugin.reportError(
                                new Error(
                                    'O limite de badges desta versão do Discord não pode ser alterado.',
                                ),
                            )
                            return
                        }
                        patched.add(module)
                        matched++
                        cleanup(restore)
                    } catch (error) {
                        plugin.reportError(error)
                    }
                },
            ),
        )
        function patch<Args extends [unknown, unknown?, ...unknown[]]>(
            args: Args,
        ): Args {
            const component = args[0]
            const type = isRecord(component) ? component.type : component
            const name = typeof type === 'function' ? type.name : undefined
            if (name === 'ProfileBadgeRows' && isRecord(args[1]))
                args[1] = expandedBadgeProps(args[1])
            return args
        }
        cleanup(
            before(ReactJSXRuntime, 'jsx', patch),
            before(ReactJSXRuntime, 'jsxs', patch),
            before(React, 'createElement', patch),
        )
    },
    stop({ plugin }) {
        plugin.requireReload()
    },
    SettingsComponent() {
        return (
            <Panel title="AlwaysExtended">
                <Action
                    label="Todas as badges, com quebra de linha"
                    detail={
                        matched
                            ? `Integrações de perfil encontradas: ${matched}. Reabra o perfil para aplicar.`
                            : 'Abra um perfil. Se nenhuma integração for encontrada, esta versão do Discord precisa de uma adaptação.'
                    }
                />
            </Panel>
        )
    },
})
