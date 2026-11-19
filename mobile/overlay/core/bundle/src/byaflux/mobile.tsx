import Page from '@valenced/components/Page'
import { ToastActionCreators } from '@valenced/discord/actions'
import { Dispatcher } from '@valenced/discord/common/flux'
import { Design } from '@valenced/discord/design'
import { Stores } from '@valenced/discord/flux'
import { getModules } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { ScrollView, TextInput } from 'react-native'
import type { PluginCleanupApi } from '@valenced/plugins/types'
import type { ReactNode } from 'react'

export type RecordData = Record<string, unknown>
export type Fn = (...args: unknown[]) => unknown
export interface HTTPClient {
    patch(options: { url: string; body: unknown }): Promise<unknown>
}
export interface Engine {
    setLocalVolume?(id: string, volume: number): unknown
    getLocalVolume?(id: string): number
    setSelfMute?(value: boolean): unknown
    setSelfDeafen?(value: boolean): unknown
}
export interface VoiceActions {
    toggleSelfMute(): unknown
    toggleSelfDeaf?(): unknown
    toggleSelfDeafen?(): unknown
}
export const runtime: {
    http?: HTTPClient
    engine?: Engine
    voice?: VoiceActions
    join?: (id: string) => unknown
} = {}
let connections = 0
let disposers: (() => unknown)[] = []
const listeners = new Set<() => void>()
const announce = () => {
    for (const listener of listeners) listener()
}
export function observeRuntime(listener: () => void) {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

export function connectRuntime(cleanup: PluginCleanupApi) {
    if (connections++ === 0) {
        disposers.push(
            getModules(withProps<{ HTTP: HTTPClient }>('HTTP'), m => {
                runtime.http = m.HTTP
                announce()
            }),
        )
        disposers.push(
            getModules(withProps<Engine>('setLocalVolume'), m => {
                if (!runtime.engine?.setSelfMute) runtime.engine = m
                announce()
            }),
        )
        disposers.push(
            getModules(withProps<Engine>('setSelfMute', 'setSelfDeafen'), m => {
                runtime.engine = m
                announce()
            }),
        )
        disposers.push(
            getModules(
                withProps<{ getMediaEngine(): Engine }>('getMediaEngine'),
                m => {
                    try {
                        const engine = m.getMediaEngine()
                        if (engine && connections) {
                            runtime.engine = engine
                            announce()
                        }
                    } catch {}
                },
            ),
        )
        disposers.push(
            getModules(withProps<VoiceActions>('toggleSelfMute'), m => {
                if (m.toggleSelfDeaf || m.toggleSelfDeafen) {
                    runtime.voice = m
                    announce()
                }
            }),
        )
        disposers.push(
            getModules(
                withProps<{ selectVoiceChannel(id: string): unknown }>(
                    'selectVoiceChannel',
                ),
                m => {
                    runtime.join = id => m.selectVoiceChannel(id)
                    announce()
                },
            ),
        )
    }
    cleanup(() => {
        if (--connections === 0) {
            for (const dispose of disposers) dispose()
            disposers = []
            runtime.http = undefined
            runtime.engine = undefined
            runtime.voice = undefined
            runtime.join = undefined
        }
    })
}
export function store<T>(name: string): T | undefined {
    return Stores[name] as T | undefined
}
export const userId = () =>
    store<{ getCurrentUser(): { id: string } | undefined }>(
        'UserStore',
    )?.getCurrentUser()?.id
export const selectedChannel = () =>
    store<{ getChannelId(): string }>('SelectedChannelStore')?.getChannelId()
export const voiceChannel = () =>
    store<{ getVoiceChannelId(): string }>(
        'SelectedChannelStore',
    )?.getVoiceChannelId()
export function channel(id: string) {
    return store<{
        getChannel(id: string): {
            id: string
            guild_id?: string
            name?: string
            type: number
            last_message_id?: string
        }
    }>('ChannelStore')?.getChannel(id)
}
export function userVoice(
    id: string,
): { channelId?: string; guildId?: string } | undefined {
    const states = store<{
        getVoiceStateForUser?(id: string): {
            channelId?: string
            guildId?: string
        }
        getAllVoiceStates?(): Record<
            string,
            Record<string, { channelId?: string }>
        >
    }>('VoiceStateStore')
    const direct = states?.getVoiceStateForUser?.(id)
    if (direct?.channelId) return direct
    for (const [guildId, users] of Object.entries(
        states?.getAllVoiceStates?.() ?? {},
    ))
        if (users[id]?.channelId) return { ...users[id], guildId }
}
export function notify(text: string, error = false) {
    ToastActionCreators.open('BYAFLUX_MOBILE_TOAST', {
        text,
        variant: error ? 'critical' : 'success',
    })
}
export function joinVoice(id: string) {
    if (runtime.join) return runtime.join(id)
    const target = channel(id)
    if (!target) throw new Error('Canal não encontrado nesta sessão.')
    Dispatcher.dispatch({
        type: 'VOICE_CHANNEL_SELECT',
        channelId: id,
        guildId: target.guild_id ?? null,
    })
}
export const localMessageIds = new Set<string>()
export function Panel({
    title,
    children,
}: {
    title: string
    children: ReactNode
}) {
    return (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            <Page>
                <Design.TableRowGroup title={title}>
                    {children}
                </Design.TableRowGroup>
            </Page>
        </ScrollView>
    )
}
export function Field({
    label,
    value,
    onChange,
    numeric = false,
    multiline = false,
}: {
    label: string
    value: string
    onChange: (value: string) => void
    numeric?: boolean
    multiline?: boolean
}) {
    return (
        <TextInput
            accessibilityLabel={label}
            placeholder={label}
            placeholderTextColor="#999"
            value={value}
            onChangeText={onChange}
            multiline={multiline}
            keyboardType={numeric ? 'number-pad' : 'default'}
            autoCorrect={false}
            style={{
                color: '#fff',
                backgroundColor: '#242429',
                padding: 14,
                borderRadius: 8,
                margin: 6,
            }}
        />
    )
}
export function Action({
    label,
    detail,
    run,
}: {
    label: string
    detail?: string
    run?: () => unknown
}) {
    return (
        <Design.TableRow
            label={label}
            subLabel={detail}
            onPress={
                run
                    ? () => {
                          void Promise.resolve()
                              .then(run)
                              .catch(e =>
                                  notify(
                                      e instanceof Error
                                          ? e.message
                                          : String(e),
                                      true,
                                  ),
                              )
                      }
                    : undefined
            }
        />
    )
}
