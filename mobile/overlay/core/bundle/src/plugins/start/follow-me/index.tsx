import { Design } from '@valenced/discord/design'
import { onFluxEventDispatched } from '@valenced/discord/flux'
import { registerInternalPlugin } from '@valenced/plugins/_'
import { validUserId } from '~/byaflux/catalog'
import {
    Action,
    channel,
    connectRuntime,
    Field,
    notify,
    Panel,
    runtime,
    userId,
    userVoice,
    voiceChannel,
} from '~/byaflux/mobile'
import manifest from './manifest.json'

registerInternalPlugin<{ jsonStorage: { target: string; active: boolean } }>(
    manifest,
    {
        jsonStorage: { load: true, default: { target: '', active: false } },
        start({ cleanup, jsonStorage }) {
            connectRuntime(cleanup)
            let pending = false
            let previous = ''
            let running = true
            async function move() {
                const s = jsonStorage.cache
                const myChannel = voiceChannel()
                if (
                    !running ||
                    pending ||
                    !s?.active ||
                    !myChannel ||
                    !validUserId(String(s.target)) ||
                    s.target === userId()
                )
                    return
                const target = userVoice(String(s.target))?.channelId
                const guild = channel(myChannel)?.guild_id
                if (
                    !target ||
                    target === myChannel ||
                    !guild ||
                    previous === myChannel ||
                    !runtime.http
                )
                    return
                if (channel(target)?.guild_id !== guild) return
                pending = true
                previous = myChannel
                try {
                    await runtime.http.patch({
                        url: `/guilds/${guild}/members/${s.target}`,
                        body: { channel_id: myChannel },
                    })
                } catch {
                    previous = ''
                    notify(
                        'Não foi possível mover o membro. Confira a permissão Mover membros.',
                        true,
                    )
                } finally {
                    pending = false
                }
            }
            const pass = <T,>(payload: T) => {
                queueMicrotask(() => {
                    void move()
                })
                return payload
            }
            cleanup(
                onFluxEventDispatched('VOICE_STATE_UPDATES', pass),
                onFluxEventDispatched('VOICE_STATE_UPDATE', pass),
                jsonStorage.subscribe(() => {
                    previous = ''
                    void move()
                }),
                () => {
                    running = false
                },
            )
            void move()
        },
        SettingsComponent({ api: { jsonStorage } }) {
            const s = jsonStorage.use() ?? { target: '', active: false }
            return (
                <Panel title="FollowMe">
                    <Action
                        label="É necessário ter a permissão Mover membros."
                        detail="O usuário precisa estar conectado no mesmo servidor."
                    />
                    <Field
                        label="ID do membro"
                        value={s.target}
                        onChange={target => {
                            void jsonStorage.set({ target })
                        }}
                        numeric
                    />
                    <Design.TableSwitchRow
                        label="Mover junto comigo"
                        value={s.active}
                        onValueChange={active => {
                            void jsonStorage.set({ active })
                        }}
                    />
                </Panel>
            )
        },
    },
)
