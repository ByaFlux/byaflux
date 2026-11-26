import Page from '@valenced/components/Page'
import { Design } from '@valenced/discord/design'
import { getStore } from '@valenced/discord/flux'
import { registerInternalPlugin } from '@valenced/plugins/_'
import { useState, useSyncExternalStore } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { validUserId } from '~/byaflux/catalog'
import { staticBadges, tieredBadges } from '~/byaflux/definitions'
import { badgeState, emptySelection, readFakeSettings } from '~/byaflux/state'
import manifest from './manifest.json'
import type { PluginSettingsComponent } from '@valenced/plugins/types'
import type { FakeSettings, Selection } from '~/byaflux/state'

const {
    TableRow,
    TableRowGroup,
    TableSwitchRow,
    TableRadioGroup,
    TableRadioRow,
} = Design
let pendingWrites = 0
let writes = Promise.resolve()
const defaults: FakeSettings = { target: '', users: {} }

const Settings: PluginSettingsComponent<{ jsonStorage: FakeSettings }> = ({
    api: { jsonStorage, plugin },
}) => {
    const saved = jsonStorage.use() ?? defaults
    const [target, setTarget] = useState(saved.target)
    useSyncExternalStore(badgeState.subscribe, badgeState.snapshot)
    const current = badgeState.getFake() ?? saved
    const selection = current.users[target] ?? emptySelection()
    const valid = validUserId(target)
    function save(value: Selection) {
        if (!valid) return
        badgeState.setFake({
            ...current,
            target,
            users: { ...current.users, [target]: value },
        })
        pendingWrites++
        writes = writes
            .then(() => jsonStorage.set({ target, users: { [target]: value } }))
            .catch(error => {
                plugin.reportError(error)
            })
            .finally(() => {
                pendingWrites--
            })
    }
    function move(index: number, direction: number) {
        const order = [...selection.badges]
        const to = index + direction
        if (to < 0 || to >= order.length) return
        ;[order[index], order[to]] = [order[to]!, order[index]!]
        save({ ...selection, badges: order })
    }
    return (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            <Page>
                <TableRowGroup title="FakeBadges">
                    <TableRow
                        label="Alterações apenas neste aparelho"
                        subLabel="Não concede Nitro, boost ou badges reais e não modifica sua conta no Discord."
                    />
                    <TableRow
                        label="Usar minha conta"
                        onPress={() => {
                            getStore<{
                                getCurrentUser(): { id: string } | undefined
                            }>('UserStore', store => {
                                const id = store.getCurrentUser()?.id
                                if (id) setTarget(id)
                            })
                        }}
                    />
                </TableRowGroup>
                <TextInput
                    accessibilityLabel="ID do usuário"
                    placeholder="ID do usuário"
                    placeholderTextColor="#999"
                    value={target}
                    onChangeText={setTarget}
                    keyboardType="number-pad"
                    autoCorrect={false}
                    style={{
                        color: '#fff',
                        backgroundColor: '#232428',
                        padding: 14,
                        borderRadius: 8,
                    }}
                />
                {!valid ? (
                    <TableRow label="Informe um ID válido ou toque em Usar minha conta." />
                ) : (
                    <>
                        <TableRowGroup title="Badges">
                            {staticBadges.map(b => (
                                <TableSwitchRow
                                    key={b.key}
                                    label={b.title}
                                    value={selection.badges.includes(b.key)}
                                    onValueChange={enabled =>
                                        save({
                                            ...selection,
                                            badges: enabled
                                                ? [
                                                      ...selection.badges.filter(
                                                          k => k !== b.key,
                                                      ),
                                                      b.key,
                                                  ]
                                                : selection.badges.filter(
                                                      k => k !== b.key,
                                                  ),
                                        })
                                    }
                                />
                            ))}
                        </TableRowGroup>
                        {tieredBadges.map(group => (
                            <TableRadioGroup
                                key={`${group.key}-${target}-${selection[group.key] ?? ''}`}
                                title={`Badge de ${group.title}`}
                                defaultValue={selection[group.key] ?? ''}
                                onChange={(value: string) =>
                                    save({ ...selection, [group.key]: value })
                                }
                            >
                                <TableRadioRow
                                    value=""
                                    label="Manter a badge original"
                                />
                                {group.levels.map(level => (
                                    <TableRadioRow
                                        key={level.id}
                                        value={level.id}
                                        label={level.title
                                            .replace('months', 'meses')
                                            .replace('month', 'mês')}
                                    />
                                ))}
                            </TableRadioGroup>
                        ))}
                        <TableRowGroup title="Ordem das badges selecionadas">
                            {selection.badges.map((key, index) => (
                                <View
                                    key={key}
                                    style={{
                                        flexDirection: 'row',
                                        padding: 12,
                                        gap: 12,
                                    }}
                                >
                                    <Text style={{ color: '#fff', flex: 1 }}>
                                        {
                                            staticBadges.find(
                                                b => b.key === key,
                                            )?.title
                                        }
                                    </Text>
                                    <Pressable
                                        accessibilityLabel="Mover badge para cima"
                                        onPress={() => move(index, -1)}
                                    >
                                        <Text style={{ color: '#ff9c56' }}>
                                            Subir
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        accessibilityLabel="Mover badge para baixo"
                                        onPress={() => move(index, 1)}
                                    >
                                        <Text style={{ color: '#ff9c56' }}>
                                            Descer
                                        </Text>
                                    </Pressable>
                                </View>
                            ))}
                            <TableRow
                                label="Restaurar badges deste usuário"
                                onPress={() => save(emptySelection())}
                            />
                        </TableRowGroup>
                    </>
                )}
            </Page>
        </ScrollView>
    )
}

registerInternalPlugin<{ jsonStorage: FakeSettings }>(manifest, {
    jsonStorage: { load: true, default: defaults },
    start({ jsonStorage, cleanup }) {
        const sync = () => {
            if (!pendingWrites)
                badgeState.setFake(readFakeSettings(jsonStorage.cache))
        }
        sync()
        cleanup(jsonStorage.subscribe(sync), () =>
            badgeState.setFake(undefined),
        )
    },
    SettingsComponent: Settings,
})
