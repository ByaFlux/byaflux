import { getAssetIdByName } from '@valenced/assets'
import { styles } from '@valenced/components/_'
import { Design } from '@valenced/discord/design'
import { SettingListRenderer } from '@valenced/discord/modules/settings/renderer'
import { useSyncExternalStore } from 'react'
import { Image, Linking, ScrollView, StyleSheet, View } from 'react-native'
import { updates } from '~/byaflux/updates'
import ValencedDonate from '~assets/ValencedDonate'
import { Setting } from '../constants'

const { Button, Card, Stack, Text } = Design

export default function ValencedSettingScreen() {
    useSyncExternalStore(updates.subscribe, updates.snapshot)
    return (
        <ScrollView style={{ flex: 1 }}>
            <Stack spacing={0}>
                <View style={{ padding: 16, paddingBottom: 0 }}>
                    <DonateCard />
                </View>
                <View style={{ padding: 16 }}>
                    <Design.TableRowGroup title="Atualizações">
                        <Design.TableRow
                            label={updates.status()}
                            onPress={() => {
                                void updates.check()
                            }}
                        />
                        <Design.TableRow
                            label={
                                updates.current()
                                    ? 'Atualizar ByaFlux'
                                    : 'Abrir instalador'
                            }
                            onPress={() => {
                                void updates.open()
                            }}
                        />
                    </Design.TableRowGroup>
                </View>
                <View>
                    <SettingListRenderer.SettingsList
                        node={{
                            type: 'list',
                            sections: [
                                {
                                    label: 'ByaFlux',
                                    settings: [
                                        Setting.ValencedVersion,
                                        Setting.LoaderVersion,
                                        Setting.ValencedSourceRepository,
                                        Setting.ValencedLicense,
                                    ],
                                },
                                {
                                    label: 'Versions',
                                    settings: [
                                        Setting.ReactVersion,
                                        Setting.ReactNativeVersion,
                                        Setting.HermesVersion,
                                    ],
                                },
                                {
                                    label: 'Actions',
                                    settings: [
                                        Setting.Reload,
                                        Setting.ValencedEnterRecoveryMode,
                                    ],
                                },
                                {
                                    label: 'Developer',
                                    settings: [Setting.ValencedDeveloperMode],
                                },
                            ],
                        }}
                    />
                </View>
            </Stack>
        </ScrollView>
    )
}

const cardStyles = StyleSheet.create({
    background: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
    },
    illustration: {
        width: 96,
        height: 96,
    },
})

function DonateCard() {
    return (
        <Card
            style={{
                position: 'relative',
                padding: 0,
                overflow: 'hidden',
            }}
        >
            <View
                style={[
                    cardStyles.background,
                    {
                        opacity: 0.5,
                        experimental_backgroundImage:
                            'linear-gradient(166deg, rgba(29, 146, 255, 0.33), rgba(62, 47, 145, 0)), ' +
                            'linear-gradient(45deg, rgba(47, 125, 145, 0),rgba(65, 22, 255, 0.5)))',
                    },
                ]}
            />
            <View style={{ padding: 16 }}>
                <Stack style={styles.grow} direction="horizontal" spacing={16}>
                    <Stack spacing={16} style={styles.flex}>
                        <Stack spacing={6} style={styles.flex}>
                            <Text
                                variant="heading-lg/semibold"
                                color="text-strong"
                            >
                                ByaFlux Mobile
                            </Text>
                            <Text variant="text-md/medium">
                                Prévia Android do ByaFlux. Compartilhe seu
                                feedback no repositório.
                            </Text>
                        </Stack>
                        <Stack spacing={12} direction="horizontal">
                            {__BUILD_DONATE_URL__ && (
                                <Button
                                    size="sm"
                                    icon={getAssetIdByName('HeartIcon')}
                                    text="Donate"
                                    variant="expressive"
                                    onPress={() => {
                                        Linking.openURL(__BUILD_DONATE_URL__)
                                    }}
                                />
                            )}
                            <Button
                                size="sm"
                                icon={getAssetIdByName('HandRequestSpeakIcon')}
                                text="Projeto no GitHub"
                                variant="primary-overlay"
                                onPress={() => {
                                    Linking.openURL(
                                        __BUILD_SOURCE_REPOSITORY_URL__,
                                    )
                                }}
                            />
                        </Stack>
                    </Stack>
                    <Image
                        source={ValencedDonate}
                        style={cardStyles.illustration}
                    />
                </Stack>
            </View>
        </Card>
    )
}
