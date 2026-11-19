import { Dispatcher } from '@valenced/discord/common/flux'
import { onFluxEventDispatched } from '@valenced/discord/flux'
import { getModules } from '@valenced/modules/finders'
import { withName } from '@valenced/modules/finders/filters'
import { instead } from '@valenced/patcher'
import { localMessageIds, store, userId } from '~/byaflux/mobile'
import type { PluginApi } from '@valenced/plugins/types'

type RecordMessage = {
    id: string
    channel_id: string
    content: string
    state: string
    flags: number
    author: { id: string; username?: string; bot?: boolean }
}
export type Entry = {
    id: string
    channel: string
    author: string
    content: string
    history: string[]
    deleted: boolean
    at: number
}
export type Settings = {
    owner: string
    entries: Entry[]
    ignoreBots: boolean
    ignoreSelf: boolean
}
type Row = {
    type?: number
    changeType?: number
    message?: {
        id: string
        textColor?: number
        timestampColor?: number
        content?: unknown[]
    }
}
export const changed = new Set<string>()
export const live = new Map<string, Entry>()
export const defaults: Settings = {
    owner: '',
    entries: [],
    ignoreBots: false,
    ignoreSelf: false,
}

export function start({
    cleanup,
    jsonStorage,
    plugin,
}: PluginApi<{ jsonStorage: Settings }>) {
    let owner = userId() ?? ''
    let enabled = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let writes = Promise.resolve()
    function load() {
        live.clear()
        owner = userId() ?? ''
        if (owner && jsonStorage.cache?.owner === owner)
            for (const entry of jsonStorage.cache.entries as Entry[])
                live.set(entry.id, entry)
    }
    function save() {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
            const snapshot = {
                owner,
                entries: [...live.values()].slice(-500),
            }
            writes = writes
                .then(() => jsonStorage.set(snapshot))
                .catch(error => plugin.reportError(error))
        }, 250)
    }
    function eligible(record: RecordMessage) {
        const config = jsonStorage.cache ?? defaults
        return (
            record.state === 'SENT' &&
            !(record.flags & 64) &&
            !localMessageIds.has(record.id) &&
            (!config.ignoreBots || !record.author.bot) &&
            (!config.ignoreSelf || record.author.id !== owner)
        )
    }
    function get(channel: string, id: string) {
        return store<{
            getMessage(channel: string, id: string): RecordMessage | undefined
        }>('MessageStore')?.getMessage(channel, id)
    }
    function entry(record: RecordMessage) {
        let log = live.get(record.id)
        if (!log) {
            log = {
                id: record.id,
                channel: record.channel_id,
                author: record.author.username ?? record.author.id,
                content: record.content,
                history: [],
                deleted: false,
                at: Date.now(),
            }
            live.set(record.id, log)
            while (live.size > 500) live.delete(live.keys().next().value!)
        }
        return log
    }
    function current() {
        if (userId() !== owner) load()
        return enabled && !!owner
    }
    function keep(channel: string, id: string) {
        if (!current()) return false
        const record = get(channel, id)
        if (!record || !eligible(record)) return false
        const log = entry(record)
        log.deleted = true
        log.content = record.content
        log.at = Date.now()
        changed.add(id)
        save()
        return true
    }
    load()
    cleanup(
        onFluxEventDispatched<{
            id: string
            channelId: string
            guildId?: string
        }>('MESSAGE_DELETE', payload => {
            if (!keep(payload.channelId, payload.id)) return payload
            return {
                ...payload,
                type: 'MESSAGE_UPDATE',
                message: { id: payload.id, channel_id: payload.channelId },
            }
        }),
        onFluxEventDispatched<{
            ids: string[]
            channelId: string
            guildId?: string
        }>('MESSAGE_DELETE_BULK', payload => {
            const kept: string[] = []
            const ids = payload.ids.filter(id => {
                if (keep(payload.channelId, id)) {
                    kept.push(id)
                    return false
                }
                return true
            })
            queueMicrotask(() => {
                if (enabled)
                    for (const id of kept)
                        Dispatcher.dispatch({
                            type: 'MESSAGE_UPDATE',
                            guildId: payload.guildId,
                            message: { id, channel_id: payload.channelId },
                        })
            })
            return ids.length ? { ...payload, ids } : undefined
        }),
        onFluxEventDispatched<{
            message?: { id: string; channel_id: string; content?: string }
        }>('MESSAGE_UPDATE', payload => {
            const update = payload.message
            if (current() && update && typeof update.content === 'string') {
                const record = get(update.channel_id, update.id)
                if (
                    record &&
                    eligible(record) &&
                    record.content !== update.content
                ) {
                    const log = entry(record)
                    log.history = [...log.history, record.content].slice(-20)
                    log.content = update.content
                    log.at = Date.now()
                    changed.add(record.id)
                    save()
                }
            }
            return payload
        }),
        getModules(
            withName<{
                prototype: {
                    generate(args: { message?: RecordMessage }): Row
                }
            }>('RowManager'),
            ({ prototype }) => {
                cleanup(
                    instead(prototype, 'generate', function (args, original) {
                        const row = original.apply(this, args)
                        const message = args[0].message
                        if (
                            !current() ||
                            row?.type !== 1 ||
                            !row.message ||
                            !message
                        )
                            return row
                        const log = live.get(message.id)
                        if (!log) return row
                        if (changed.delete(log.id)) row.changeType = 2
                        const label = log.deleted
                            ? '[Mensagem apagada] '
                            : log.history.length
                              ? '[Mensagem editada] '
                              : ''
                        if (label)
                            row.message.content = [
                                { type: 'text', content: label },
                                ...(row.message.content ?? []),
                            ]
                        if (log.deleted) {
                            row.message.textColor = 0xffff6b6b | 0
                            row.message.timestampColor = 0xffff6b6b | 0
                        }
                        return row
                    }),
                )
            },
        ),
        onFluxEventDispatched('CONNECTION_OPEN', payload => {
            load()
            return payload
        }),
        () => {
            enabled = false
            if (timer) clearTimeout(timer)
            live.clear()
            changed.clear()
        },
    )
}
