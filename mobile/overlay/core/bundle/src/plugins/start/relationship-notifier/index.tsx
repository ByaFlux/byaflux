import { Design } from '@valenced/discord/design'
import { onFluxEventDispatched } from '@valenced/discord/flux'
import { registerInternalPlugin } from '@valenced/plugins/_'
import { Action, notify, Panel, store, userId } from '~/byaflux/mobile'
import manifest from './manifest.json'

type Settings = { friends: boolean; guilds: boolean; groups: boolean }
registerInternalPlugin<{ jsonStorage: Settings }>(manifest, {
    jsonStorage: {
        load: true,
        default: { friends: true, guilds: true, groups: true },
    },
    start({ cleanup, jsonStorage }) {
        cleanup(
            onFluxEventDispatched<{ id: string }>(
                'RELATIONSHIP_REMOVE',
                payload => {
                    const relation = store<{
                        getRelationshipType(id: string): number
                    }>('RelationshipStore')?.getRelationshipType(payload.id)
                    if (jsonStorage.cache?.friends && relation === 1) {
                        const name =
                            store<{
                                getUser(id: string): { username: string }
                            }>('UserStore')?.getUser(payload.id)?.username ??
                            payload.id
                        queueMicrotask(() =>
                            notify(`Amizade removida: ${name}`),
                        )
                    }
                    return payload
                },
            ),
            onFluxEventDispatched<{
                guild?: { id: string; name?: string; unavailable?: boolean }
                unavailable?: boolean
            }>('GUILD_DELETE', payload => {
                if (
                    jsonStorage.cache?.guilds &&
                    payload.guild &&
                    !payload.unavailable &&
                    !payload.guild.unavailable
                ) {
                    const name =
                        payload.guild.name ??
                        store<{ getGuild(id: string): { name: string } }>(
                            'GuildStore',
                        )?.getGuild(payload.guild.id)?.name ??
                        payload.guild.id
                    queueMicrotask(() =>
                        notify(`Você saiu ou foi removido de: ${name}`),
                    )
                }
                return payload
            }),
            onFluxEventDispatched<{
                channelId?: string
                channel_id?: string
                user?: { id: string }
            }>('CHANNEL_RECIPIENT_REMOVE', payload => {
                if (jsonStorage.cache?.groups && payload.user?.id === userId())
                    queueMicrotask(() =>
                        notify('Você foi removido de um grupo privado.'),
                    )
                return payload
            }),
        )
    },
    SettingsComponent({ api: { jsonStorage } }) {
        const settings = jsonStorage.use() ?? {
            friends: true,
            guilds: true,
            groups: true,
        }
        return (
            <Panel title="RelationshipNotifier">
                {(['friends', 'guilds', 'groups'] as const).map(
                    (key, index) => (
                        <Design.TableSwitchRow
                            key={key}
                            label={
                                [
                                    'Amizades removidas',
                                    'Saída de servidores',
                                    'Remoção de grupos',
                                ][index]!
                            }
                            value={settings[key]}
                            onValueChange={value => {
                                void jsonStorage.set({ [key]: value })
                            }}
                        />
                    ),
                )}
                <Action
                    label="Avisos durante esta sessão"
                    detail="O Discord não informa quem desfez uma amizade ou se a saída de um servidor foi voluntária."
                />
            </Panel>
        )
    },
})
