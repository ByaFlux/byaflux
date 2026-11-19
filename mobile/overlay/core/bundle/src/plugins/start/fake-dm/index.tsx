import { Dispatcher } from '@valenced/discord/common/flux'
import { Design } from '@valenced/discord/design'
import { onFluxEventDispatched } from '@valenced/discord/flux'
import { registerInternalPlugin } from '@valenced/plugins/_'
import { useState } from 'react'
import { validUserId } from '~/byaflux/catalog'
import {
    Action,
    channel,
    Field,
    localMessageIds,
    Panel,
    selectedChannel,
    store,
    userId,
} from '~/byaflux/mobile'
import manifest from './manifest.json'

interface Fake {
    id: string
    channelId: string
    authorId: string
    content: string
    timestamp: string
    kind: 'message' | 'call'
    duration: number
    missed: boolean
}
let sequence = 0
function snowflake(date: Date) {
    return (
        (BigInt(Math.max(0, date.getTime() - 1420070400000)) << 22n) |
        BigInt(sequence++ % 4194304)
    ).toString()
}
function inject(fake: Fake) {
    const target = channel(fake.channelId)
    if (!target || ![1, 3].includes(target.type))
        throw Error('Abra uma DM ou um grupo privado antes de usar o FakeDM.')
    const author = store<{
        getUser(id: string): {
            id: string
            username: string
            avatar?: string
            globalName?: string
        }
    }>('UserStore')?.getUser(fake.authorId)
    if (!author)
        throw Error(
            'O usuário precisa estar carregado no aplicativo. Abra o perfil dele primeiro.',
        )
    localMessageIds.add(fake.id)
    const started = new Date(fake.timestamp)
    Dispatcher.dispatch({
        type: 'MESSAGE_CREATE',
        channelId: fake.channelId,
        message: {
            id: fake.id,
            nonce: fake.id,
            channel_id: fake.channelId,
            author: {
                id: author.id,
                username: author.username,
                global_name: author.globalName,
                avatar: author.avatar ?? null,
                discriminator: '0',
            },
            content: fake.content,
            timestamp: fake.timestamp,
            edited_timestamp: null,
            type: fake.kind === 'call' ? 3 : 0,
            state: 'SENT',
            flags: 0,
            attachments: [],
            embeds: [],
            components: [],
            mentions: [],
            mention_roles: [],
            mention_everyone: false,
            pinned: false,
            ...(fake.kind === 'call'
                ? {
                      call: {
                          participants: fake.missed
                              ? [fake.authorId]
                              : [fake.authorId, userId()].filter(Boolean),
                          ended_timestamp: new Date(
                              started.getTime() + fake.duration * 1000,
                          ).toISOString(),
                      },
                  }
                : {}),
        },
        optimistic: true,
        isPushNotification: false,
    })
}

registerInternalPlugin<{ jsonStorage: { items: Fake[] } }>(manifest, {
    jsonStorage: { load: true, default: { items: [] } },
    start({ cleanup, jsonStorage }) {
        let active = true
        const restore = () => {
            if (!active) return
            for (const fake of (jsonStorage.cache?.items ?? []) as Fake[])
                if (fake.channelId === selectedChannel())
                    try {
                        inject(fake)
                    } catch {}
        }
        cleanup(
            onFluxEventDispatched('CHANNEL_SELECT', payload => {
                queueMicrotask(restore)
                return payload
            }),
            () => {
                active = false
                for (const fake of (jsonStorage.cache?.items ?? []) as Fake[]) {
                    Dispatcher.dispatch({
                        type: 'MESSAGE_DELETE',
                        channelId: fake.channelId,
                        id: fake.id,
                    })
                    localMessageIds.delete(fake.id)
                }
            },
        )
        queueMicrotask(restore)
    },
    SettingsComponent({ api: { jsonStorage } }) {
        const [channelId, setChannel] = useState(selectedChannel() ?? '')
        const [authorId, setAuthor] = useState('')
        const [content, setContent] = useState('')
        const [timestamp, setTimestamp] = useState(new Date().toISOString())
        const [duration, setDuration] = useState('60')
        const [missed, setMissed] = useState(false)
        async function create(kind: 'message' | 'call') {
            if (!validUserId(authorId) || !validUserId(channelId))
                throw Error('Informe IDs válidos de usuário e conversa.')
            const date = new Date(timestamp)
            if (!Number.isFinite(date.getTime()))
                throw Error(
                    'Use uma data válida, por exemplo 2026-11-19T20:00:00-03:00.',
                )
            const seconds = Number(duration)
            if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400)
                throw Error('A duração deve ser de 0 a 86400 segundos.')
            const fake: Fake = {
                id: snowflake(date),
                channelId,
                authorId,
                content: kind === 'message' ? content : '',
                timestamp: date.toISOString(),
                kind,
                duration: missed ? 0 : seconds,
                missed,
            }
            inject(fake)
            await jsonStorage.set({
                items: [...(jsonStorage.cache?.items ?? []), fake].slice(-500),
            })
        }
        return (
            <Panel title="FakeDM">
                <Action
                    label="Somente visual neste aparelho"
                    detail="Não envia mensagens nem realiza chamadas reais."
                />
                <Action
                    label="Usar conversa aberta"
                    run={() => setChannel(selectedChannel() ?? '')}
                />
                <Field
                    label="ID da DM ou grupo"
                    value={channelId}
                    onChange={setChannel}
                    numeric
                />
                <Field
                    label="ID do autor"
                    value={authorId}
                    onChange={setAuthor}
                    numeric
                />
                <Field
                    label="Mensagem"
                    value={content}
                    onChange={setContent}
                    multiline
                />
                <Field
                    label="Data e hora ISO"
                    value={timestamp}
                    onChange={setTimestamp}
                />
                <Action
                    label="Adicionar mensagem local"
                    run={() => create('message')}
                />
                <Field
                    label="Duração da chamada em segundos"
                    value={duration}
                    onChange={setDuration}
                    numeric
                />
                <Design.TableSwitchRow
                    label="Chamada perdida"
                    value={missed}
                    onValueChange={setMissed}
                />
                <Action
                    label="Adicionar registro de chamada local"
                    run={() => create('call')}
                />
                <Action
                    label="Limpar registros desta conversa"
                    run={async () => {
                        const items = (jsonStorage.cache?.items ?? []) as Fake[]
                        for (const item of items.filter(
                            f => f.channelId === channelId,
                        )) {
                            Dispatcher.dispatch({
                                type: 'MESSAGE_DELETE',
                                channelId,
                                id: item.id,
                            })
                            localMessageIds.delete(item.id)
                        }
                        await jsonStorage.set({
                            items: items.filter(f => f.channelId !== channelId),
                        })
                    }}
                />
            </Panel>
        )
    },
})
