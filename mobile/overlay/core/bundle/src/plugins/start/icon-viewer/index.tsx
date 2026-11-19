import { getAssetIdByName, getAssets } from '@valenced/assets'
import { Design } from '@valenced/discord/design'
import { registerInternalPlugin } from '@valenced/plugins/_'
import { useMemo, useState } from 'react'
import { FlatList, Image, Share, TextInput, View } from 'react-native'
import manifest from './manifest.json'

registerInternalPlugin(manifest, {
    SettingsComponent() {
        const [query, setQuery] = useState('')
        const [revision, refresh] = useState(0)
        const assets = useMemo(
            () =>
                [...getAssets()].filter(a =>
                    a.name.toLowerCase().includes(query.toLowerCase()),
                ),
            [query, revision],
        )
        return (
            <View style={{ flex: 1 }}>
                <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Pesquisar ícones carregados"
                    placeholderTextColor="#999"
                    accessibilityLabel="Pesquisar ícones"
                    style={{ color: '#fff', padding: 16 }}
                />
                <Design.TableRow
                    label={`Atualizar lista (${assets.length} imagens)`}
                    onPress={() => refresh(v => v + 1)}
                />
                <FlatList
                    data={assets}
                    keyExtractor={(a, i) => `${a.name}-${a.type}-${i}`}
                    renderItem={({ item }) => (
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                padding: 8,
                            }}
                        >
                            <Image
                                source={getAssetIdByName(item.name, item.type)}
                                style={{ width: 32, height: 32 }}
                                resizeMode="contain"
                            />
                            <View style={{ flex: 1 }}>
                                <Design.TableRow
                                    label={item.name}
                                    subLabel={`${item.type} ${item.width} x ${item.height}`}
                                    onPress={() => {
                                        void Share.share({
                                            message: JSON.stringify(
                                                item,
                                                null,
                                                2,
                                            ),
                                        })
                                    }}
                                />
                            </View>
                        </View>
                    )}
                />
            </View>
        )
    },
})
