import { getStore } from '@valenced/discord/flux'
import { before } from '@valenced/patcher'
import { registerInternalPlugin } from '@valenced/plugins/_'
import { React, ReactJSXRuntime } from '@valenced/react'
import { useState, useSyncExternalStore } from 'react'
import {
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native'
import { Action, Panel, store } from '~/byaflux/mobile'
import manifest from './manifest.json'
import {
    orderedRoles,
    readSelection,
    roleColour,
    roleKey,
    toggleRole,
    visibleRoles,
} from './model'
import type { ComponentType } from 'react'
import type { RoleSelection, VisualRole } from './model'

type Settings = { profiles: Record<string, RoleSelection> }
type Props = Record<string, unknown> & {
    userId?: string
    guildId?: string
    user?: { id: string }
    guild?: { id: string }
    member?: { userId?: string; guildId?: string }
    type?: ComponentType<Props>
}
const listeners = new Set<() => void>()
let revision = 0,
    active = false
let profiles: Settings['profiles'] = {}
let persist: ((value: Settings) => Promise<void>) | undefined
let matched = 0
const changed = () => {
    revision++
    for (const listener of listeners) listener()
}
const subscribe = (fn: () => void) => {
    listeners.add(fn)
    return () => {
        listeners.delete(fn)
    }
}
const snapshot = () => revision
function userId() {
    return store<{ getCurrentUser(): { id: string } | undefined }>(
        'UserStore',
    )?.getCurrentUser()?.id
}
function selectedGuild() {
    return store<{ getGuildId(): string | undefined }>(
        'SelectedGuildStore',
    )?.getGuildId()
}
function roles(guildId: string): VisualRole[] {
    const source = store<{
        getSortedRoles?(id: string): VisualRole[]
        getRolesSnapshot?(id: string): Record<string, VisualRole>
        getRoles?(id: string): Record<string, VisualRole>
    }>('GuildRoleStore')
    const guild = store<{
        getGuild(id: string): { roles?: Record<string, VisualRole> } | undefined
    }>('GuildStore')?.getGuild(guildId)
    const value =
        source?.getSortedRoles?.(guildId) ??
        source?.getRolesSnapshot?.(guildId) ??
        source?.getRoles?.(guildId) ??
        guild?.roles ??
        {}
    return orderedRoles(
        Array.isArray(value) ? value : Object.values(value),
        guildId,
    )
}
function realRoles(guildId: string, id: string): string[] {
    return (
        store<{
            getMember(
                guildId: string,
                userId: string,
            ): { roles: string[] } | undefined
        }>('GuildMemberStore')?.getMember(guildId, id)?.roles ?? []
    )
}
function currentRoles(guildId: string, id: string) {
    return visibleRoles(
        realRoles(guildId, id),
        profiles[roleKey(id, guildId)],
        roles(guildId).map(role => role.id),
    )
}
let writes = Promise.resolve()
function save(guildId: string, id: string, selection?: RoleSelection) {
    const next = { ...profiles },
        key = roleKey(id, guildId)
    if (selection && (selection.added.length || selection.hidden.length))
        next[key] = selection
    else delete next[key]
    profiles = next
    changed()
    const writer = persist
    if (writer)
        writes = writes.then(() => writer({ profiles: next })).catch(() => {})
}
function ChipList({ guildId, id }: { guildId: string; id: string }) {
    useSyncExternalStore(subscribe, snapshot)
    const ids = currentRoles(guildId, id)
    return (
        <View
            style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 6,
                paddingVertical: 10,
            }}
        >
            {roles(guildId)
                .filter(r => ids.includes(r.id))
                .map(role => (
                    <View
                        key={role.id}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            borderColor: '#50535b',
                            borderWidth: 1,
                            borderRadius: 6,
                            padding: 6,
                        }}
                    >
                        <View
                            style={{
                                width: 10,
                                height: 10,
                                borderRadius: 5,
                                backgroundColor: roleColour(role),
                            }}
                        />
                        <Text style={{ color: '#fff', fontSize: 12 }}>
                            {role.name}
                        </Text>
                    </View>
                ))}
        </View>
    )
}
export function RolePicker({
    guildId,
    id,
    close,
}: {
    guildId: string
    id: string
    close(): void
}) {
    useSyncExternalStore(subscribe, snapshot)
    const [query, setQuery] = useState('')
    const selected = currentRoles(guildId, id),
        real = realRoles(guildId, id)
    return (
        <View
            style={{
                flex: 1,
                backgroundColor: '#1e1f22',
                padding: 18,
                paddingTop: 32,
            }}
        >
            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                <Text
                    style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}
                >
                    Cargos visuais
                </Text>
                <Pressable accessibilityRole="button" onPress={close}>
                    <Text style={{ color: '#ff9c56', padding: 12 }}>
                        Concluir
                    </Text>
                </Pressable>
            </View>
            <Text style={{ color: '#b5bac1', marginVertical: 12 }}>
                Somente você vê estas alterações. Nenhuma permissão é concedida.
            </Text>
            <TextInput
                accessibilityLabel="Buscar cargos"
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar cargos"
                placeholderTextColor="#999"
                style={{
                    color: '#fff',
                    backgroundColor: '#303238',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 10,
                }}
            />
            <ScrollView>
                <View
                    style={{
                        padding: 12,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                    }}
                >
                    <Text style={{ color: '#b5bac1' }}>@everyone</Text>
                    <Text style={{ color: '#b5bac1' }}>✓</Text>
                </View>
                {roles(guildId)
                    .filter(role =>
                        role.name
                            .toLocaleLowerCase()
                            .includes(query.toLocaleLowerCase()),
                    )
                    .map(role => (
                        <Pressable
                            key={role.id}
                            accessibilityRole="checkbox"
                            accessibilityLabel={role.name}
                            accessibilityState={{
                                checked: selected.includes(role.id),
                            }}
                            onPress={() =>
                                save(
                                    guildId,
                                    id,
                                    toggleRole(
                                        real,
                                        readSelection(
                                            profiles[roleKey(id, guildId)],
                                        ),
                                        role.id,
                                        !selected.includes(role.id),
                                    ),
                                )
                            }
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                padding: 13,
                                gap: 10,
                                borderRadius: 6,
                                backgroundColor: selected.includes(role.id)
                                    ? '#36393f'
                                    : 'transparent',
                            }}
                        >
                            <View
                                style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: 6,
                                    backgroundColor: roleColour(role),
                                }}
                            />
                            <Text style={{ flex: 1, color: '#fff' }}>
                                {role.name}
                            </Text>
                            <Text
                                style={{
                                    color: selected.includes(role.id)
                                        ? '#ff9c56'
                                        : '#80848e',
                                    fontSize: 20,
                                }}
                            >
                                {selected.includes(role.id) ? '☑' : '☐'}
                            </Text>
                        </Pressable>
                    ))}
            </ScrollView>
            <Pressable
                accessibilityRole="button"
                onPress={() => save(guildId, id)}
                style={{ padding: 14, alignItems: 'center' }}
            >
                <Text style={{ color: '#ff9c56' }}>
                    Restaurar cargos originais
                </Text>
            </Pressable>
        </View>
    )
}
function ProfileAction({ guildId, id }: { guildId: string; id: string }) {
    useSyncExternalStore(subscribe, snapshot)
    const [open, setOpen] = useState(false)
    if (!active || id !== userId()) return null
    return (
        <View style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
            <Pressable
                accessibilityRole="button"
                onPress={() => setOpen(true)}
                style={{
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: '#303238',
                }}
            >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                    Cargos visuais
                </Text>
            </Pressable>
            {!!profiles[roleKey(id, guildId)] && (
                <ChipList guildId={guildId} id={id} />
            )}
            <Modal
                visible={open}
                animationType="slide"
                onRequestClose={() => setOpen(false)}
            >
                <RolePicker
                    guildId={guildId}
                    id={id}
                    close={() => setOpen(false)}
                />
            </Modal>
        </View>
    )
}
const ProfileContext = React.createContext<{
    id: string
    guildId: string
} | null>(null)
let renderingNative = false
function nativeProfile(Component: ComponentType<Props>, props: Props) {
    renderingNative = true
    try {
        return React.createElement(Component, props)
    } finally {
        renderingNative = false
    }
}
const wrappers = new WeakMap<ComponentType<Props>, ComponentType<Props>>()
function wrapProfile(Component: ComponentType<Props>) {
    let wrapper = wrappers.get(Component)
    if (!wrapper) {
        wrapper = function FakeRolesProfile(props: Props) {
            useSyncExternalStore(subscribe, snapshot)
            const parent = React.useContext(ProfileContext)
            const id =
                props.userId ??
                props.user?.id ??
                props.member?.userId ??
                parent?.id
            const guildId =
                props.guildId ??
                props.guild?.id ??
                props.member?.guildId ??
                parent?.guildId ??
                selectedGuild()
            if (!active || !guildId || !id || id !== userId())
                return nativeProfile(Component, props)
            if (/Roles(?:Section|List)?$/.test(Component.name))
                return (
                    <View style={{ paddingHorizontal: 16 }}>
                        <ChipList guildId={guildId} id={id} />
                        <ProfileAction guildId={guildId} id={id} />
                    </View>
                )
            return (
                <ProfileContext.Provider value={{ id, guildId }}>
                    {nativeProfile(Component, props)}
                    {!parent && <ProfileAction guildId={guildId} id={id} />}
                </ProfileContext.Provider>
            )
        }
        wrappers.set(Component, wrapper)
    }
    return wrapper
}
export function patchProfileArgs<
    Args extends [unknown, unknown?, ...unknown[]],
>(args: Args): Args {
    if (renderingNative) return args
    const component = args[0] as ComponentType<Props>
    const type =
        typeof component === 'object' && component !== null
            ? (component as Props).type
            : component
    const name = typeof type === 'function' ? type.name : ''
    const props = args[1] as Props | undefined
    if (
        !props ||
        !name ||
        !/^(?:UserProfile|GuildMemberProfile|GuildMemberRoles|ProfileRoles|ProfileHeader|ProfileBody)/.test(
            name,
        ) ||
        /Badge|Avatar|Banner|Button|FakeRoles/.test(name)
    )
        return args
    args[0] = wrapProfile(component)
    matched++
    return args
}
registerInternalPlugin<{ jsonStorage: Settings }>(manifest, {
    jsonStorage: { load: true, default: { profiles: {} } },
    start({ jsonStorage, cleanup, plugin }) {
        active = true
        profiles = jsonStorage.cache?.profiles ?? {}
        persist = value =>
            jsonStorage
                .set(value, true)
                .then(() => {})
                .catch(error => {
                    plugin.reportError(error)
                    throw error
                })
        for (const name of [
            'GuildRoleStore',
            'GuildMemberStore',
            'SelectedGuildStore',
            'UserStore',
        ])
            cleanup(
                getStore(name, source => {
                    source.addChangeListener(changed)
                    cleanup(() => source.removeChangeListener(changed))
                }),
            )
        cleanup(
            before(ReactJSXRuntime, 'jsx', patchProfileArgs),
            before(ReactJSXRuntime, 'jsxs', patchProfileArgs),
            before(React, 'createElement', patchProfileArgs),
            () => {
                active = false
                persist = undefined
                profiles = {}
                changed()
            },
        )
        changed()
    },
    SettingsComponent() {
        useSyncExternalStore(subscribe, snapshot)
        const guildId = selectedGuild(),
            id = userId()
        const [open, setOpen] = useState(false)
        return (
            <Panel title="FakeRoles">
                <Action
                    label="Cargos visuais"
                    detail="No seu perfil do servidor, toque em Cargos visuais. As alterações ficam neste aparelho."
                    run={guildId && id ? () => setOpen(true) : undefined}
                />
                {!guildId && (
                    <Action label="Abra um servidor para escolher os cargos." />
                )}
                <Action
                    label="Integração com o perfil"
                    detail={
                        matched
                            ? 'Perfil reconhecido nesta sessão.'
                            : 'Abra seu próprio perfil dentro de um servidor.'
                    }
                />
                {guildId && id && (
                    <Modal
                        visible={open}
                        animationType="slide"
                        onRequestClose={() => setOpen(false)}
                    >
                        <RolePicker
                            guildId={guildId}
                            id={id}
                            close={() => setOpen(false)}
                        />
                    </Modal>
                )}
            </Panel>
        )
    },
})
