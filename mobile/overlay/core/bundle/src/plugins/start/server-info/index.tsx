import { registerInternalPlugin } from '@valenced/plugins/_'
import { useState } from 'react'
import { Share } from 'react-native'
import { Action, Field, Panel, store } from '~/byaflux/mobile'
import manifest from './manifest.json'

registerInternalPlugin(manifest, {
    SettingsComponent() {
        const selected =
            store<{ getGuildId(): string }>(
                'SelectedGuildStore',
            )?.getGuildId() ?? ''
        const [id, setId] = useState(selected)
        const guild = store<{ getGuild(id: string): Record<string, unknown> }>(
            'GuildStore',
        )?.getGuild(id)
        const created = id
            ? new Date(
                  Math.floor(Number(id) / 4194304) + 1420070400000,
              ).toLocaleString()
            : ''
        const data = guild
            ? [
                  ['Nome', guild.name],
                  ['ID', id],
                  ['Dono', guild.ownerId ?? guild.owner_id],
                  ['Criação', created],
                  [
                      'Membros',
                      guild.memberCount ??
                          guild.member_count ??
                          guild.approximate_member_count ??
                          'Não disponível no cache',
                  ],
                  [
                      'Nível de boost',
                      guild.premiumTier ?? guild.premium_tier ?? 0,
                  ],
                  [
                      'Boosts',
                      guild.premiumSubscriberCount ??
                          guild.premium_subscription_count ??
                          0,
                  ],
                  ['Cargos', Object.keys((guild.roles ?? {}) as object).length],
                  ['Descrição', guild.description ?? 'Sem descrição'],
              ]
            : []
        return (
            <Panel title="ServerInfo">
                <Field
                    label="ID do servidor"
                    value={id}
                    onChange={setId}
                    numeric
                />
                <Action
                    label="Usar servidor selecionado"
                    run={() =>
                        setId(
                            store<{ getGuildId(): string }>(
                                'SelectedGuildStore',
                            )?.getGuildId() ?? '',
                        )
                    }
                />
                {data.map(([label, value]) => (
                    <Action
                        key={String(label)}
                        label={String(label)}
                        detail={String(value ?? 'Não informado')}
                    />
                ))}
                {!guild && (
                    <Action label="Selecione um servidor ou informe o ID de um servidor carregado." />
                )}
                <Action
                    label="Compartilhar informações"
                    run={
                        guild
                            ? () =>
                                  Share.share({
                                      message: data
                                          .map(([k, v]) => `${k}: ${v}`)
                                          .join('\n'),
                                  })
                            : undefined
                    }
                />
            </Panel>
        )
    },
})
