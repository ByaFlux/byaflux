import { Design } from '@valenced/discord/design'
import { onFluxEventDispatched } from '@valenced/discord/flux'
import { registerInternalPlugin } from '@valenced/plugins/_'
import { validUserId } from '~/byaflux/catalog'
import {
    Action,
    channel,
    connectRuntime,
    Field,
    joinVoice,
    notify,
    Panel,
    userId,
    userVoice,
    voiceChannel,
} from '~/byaflux/mobile'
import manifest from './manifest.json'

registerInternalPlugin<{ jsonStorage: { target: string; active: boolean } }>(
    manifest,
    {
        jsonStorage: { load: true, default: { target: '', active: false } },
        start({ jsonStorage, cleanup }) {
            connectRuntime(cleanup)
            let last = ''
            let lastAttempt = 0
            let running = true
            function check() {
                const settings = jsonStorage.cache
                if (
                    !running ||
                    !settings?.active ||
                    !validUserId(String(settings.target)) ||
                    settings.target === userId()
                )
                    return
                const target = userVoice(String(settings.target))?.channelId
                if (
                    !target ||
                    target === voiceChannel() ||
                    target === last ||
                    Date.now() - lastAttempt < 2000
                )
                    return
                if (!channel(target)) return
                last = target
                lastAttempt = Date.now()
                queueMicrotask(() => {
                    if (running)
                        Promise.resolve()
                            .then(() => joinVoice(target))
                            .catch(e => {
                                last = ''
                                notify(String(e), true)
                            })
                })
            }
            const pass = <T,>(payload: T) => {
                queueMicrotask(check)
                return payload
            }
            cleanup(
                onFluxEventDispatched('VOICE_STATE_UPDATES', pass),
                onFluxEventDispatched('VOICE_STATE_UPDATE', pass),
                jsonStorage.subscribe(() => {
                    last = ''
                    check()
                }),
                () => {
                    running = false
                },
            )
            check()
        },
        SettingsComponent({ api: { jsonStorage } }) {
            const settings = jsonStorage.use() ?? { target: '', active: false }
            return (
                <Panel title="FollowUser">
                    <Field
                        label="ID do usuário a acompanhar"
                        value={settings.target}
                        onChange={target => {
                            void jsonStorage.set({ target })
                        }}
                        numeric
                    />
                    <Design.TableSwitchRow
                        label="Acompanhar mudanças de canal"
                        subLabel="Só entra em canais aos quais sua conta tem acesso."
                        value={settings.active}
                        onValueChange={active => {
                            void jsonStorage.set({ active })
                        }}
                    />
                    <Action
                        label="Conectar ao canal atual do usuário"
                        run={() => {
                            const target = userVoice(settings.target)?.channelId
                            if (!target)
                                throw Error(
                                    'O usuário não está em um canal de voz carregado.',
                                )
                            return joinVoice(target)
                        }}
                    />
                </Panel>
            )
        },
    },
)
