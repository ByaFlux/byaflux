import { Dispatcher } from '@valenced/discord/common/flux'
import { registerInternalPlugin } from '@valenced/plugins/_'
import { Action, localMessageIds, notify, Panel, store } from '~/byaflux/mobile'
import manifest from './manifest.json'

type Channel = { id: string }
type Entry = Channel | { channel: Channel }
function markAll() {
    const guilds = store<{ getGuilds(): Record<string, Channel> }>('GuildStore')
    const channels = store<{
        getChannels(id: string): { SELECTABLE?: Entry[]; VOCAL?: Entry[] }
    }>('GuildChannelStore')
    const read = store<{
        hasUnread(id: string): boolean
        lastMessageId(id: string): string
    }>('ReadStateStore')
    const threads = store<{
        getActiveJoinedThreadsForGuild(
            id: string,
        ): Record<string, Record<string, Entry>>
    }>('ActiveJoinedThreadsStore')
    const privateChannels = store<{
        getPrivateChannels(): Record<string, Channel>
    }>('ChannelStore')
    if (!guilds || !channels || !read)
        throw Error('A lista de canais ainda não está disponível.')
    const seen = new Set<string>()
    const targets: {
        channelId: string
        messageId: string
        readStateType: number
    }[] = []
    function consider(entry: Entry) {
        const { id } = 'channel' in entry ? entry.channel : entry
        if (!id || seen.has(id)) return
        seen.add(id)
        const messageId = read!.lastMessageId(id)
        if (read!.hasUnread(id) && messageId && !localMessageIds.has(messageId))
            targets.push({ channelId: id, messageId, readStateType: 0 })
    }
    for (const { id } of Object.values(guilds.getGuilds())) {
        const group = channels.getChannels(id) ?? {}
        for (const entry of [
            ...(group.SELECTABLE ?? []),
            ...(group.VOCAL ?? []),
        ])
            consider(entry)
        for (const parent of Object.values(
            threads?.getActiveJoinedThreadsForGuild(id) ?? {},
        ))
            for (const entry of Object.values(parent)) consider(entry)
    }
    for (const entry of Object.values(
        privateChannels?.getPrivateChannels() ?? {},
    ))
        consider(entry)
    if (targets.length)
        Dispatcher.dispatch({
            type: 'BULK_ACK',
            context: 'APP',
            channels: targets,
        })
    notify(
        targets.length
            ? `${targets.length} canais marcados como lidos.`
            : 'Nenhum canal com mensagens não lidas.',
    )
}
registerInternalPlugin(manifest, {
    SettingsComponent() {
        return (
            <Panel title="ReadAllNotificationsButton">
                <Action
                    label="Marcar tudo como lido"
                    detail="Inclui servidores, tópicos e conversas privadas carregadas."
                    run={markAll}
                />
            </Panel>
        )
    },
})
