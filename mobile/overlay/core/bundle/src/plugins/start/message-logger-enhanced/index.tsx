import { Design } from '@valenced/discord/design'
import { registerInternalPlugin } from '@valenced/plugins/_'
import { useState } from 'react'
import { Share } from 'react-native'
import { Action, Field, Panel, userId } from '~/byaflux/mobile'
import { changed, defaults, live, start } from './engine'
import manifest from './manifest.json'
import type { Settings } from './engine'

registerInternalPlugin<{ jsonStorage: Settings }>(manifest, {
    jsonStorage: { load: true, default: defaults },
    start,
    SettingsComponent({ api: { jsonStorage } }) {
        const settings = jsonStorage.use() ?? defaults
        const [query, setQuery] = useState('')
        const own = settings.owner === userId()
        const entries = own ? settings.entries : []
        const visible = [...entries]
            .reverse()
            .filter(x =>
                `${x.content} ${x.author} ${x.channel}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
            )
            .slice(0, 60)
        return (
            <Panel title="MessageLoggerEnhanced">
                <Action
                    label="Histórico local"
                    detail="Até 500 mensagens e 20 versões por mensagem. Só registra mensagens carregadas enquanto o plugin está ativo."
                />
                <Design.TableSwitchRow
                    label="Ignorar bots"
                    value={settings.ignoreBots}
                    onValueChange={ignoreBots => {
                        void jsonStorage.set({ ignoreBots })
                    }}
                />
                <Design.TableSwitchRow
                    label="Ignorar minhas mensagens"
                    value={settings.ignoreSelf}
                    onValueChange={ignoreSelf => {
                        void jsonStorage.set({ ignoreSelf })
                    }}
                />
                <Field
                    label="Buscar no histórico"
                    value={query}
                    onChange={setQuery}
                />
                <Action
                    label="Exportar histórico"
                    run={() =>
                        Share.share({
                            message: JSON.stringify(entries, null, 2),
                        })
                    }
                />
                <Action
                    label="Apagar histórico local"
                    run={async () => {
                        live.clear()
                        changed.clear()
                        await jsonStorage.set({
                            owner: userId() ?? '',
                            entries: [],
                        })
                    }}
                />
                {visible.map(log => (
                    <Action
                        key={log.id}
                        label={`${log.deleted ? 'Apagada' : 'Editada'} · ${log.author}`}
                        detail={[
                            log.content,
                            ...log.history.map(
                                (text, index) => `Versão ${index + 1}: ${text}`,
                            ),
                            `Canal: ${log.channel}`,
                            new Date(log.at).toLocaleString(),
                        ].join('\n')}
                    />
                ))}
            </Panel>
        )
    },
})
