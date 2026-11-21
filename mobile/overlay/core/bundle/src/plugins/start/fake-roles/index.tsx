import { Design } from '@valenced/discord/design'
import { getStore } from '@valenced/discord/flux'
import { getModules } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
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
    bindMemberListStore,
    bindSectionListStore,
    orderedRoles,
    projectMember,
    readSelection,
    roleColour,
    roleKey,
    sortedVisibleRoles,
    toggleRole,
    visibleRoles,
} from './model'
import {
    createProfileBridge,
    profileExports,
    roleSectionExports,
} from './profileBridge'
import type { RoleSelection, VisualRole } from './model'
import type { ProfileRoleContext } from './profileBridge'

type Settings = { profiles: Record<string, RoleSelection> }
const listeners = new Set<() => void>()
let revision = 0,
    active = false
let profiles: Settings['profiles'] = {}
let persist: ((value: Settings) => Promise<void>) | undefined
let matched = 0
const displayStores = new Set<any>()
const changed = (repaint = false) => {
    revision++
    for (const listener of listeners) listener()
    if (repaint) for (const source of displayStores) source.emitChange?.()
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
    changed(true)
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
                        <Design.TableCheckboxRow
                            key={role.id}
                            value={role.id}
                            label={role.name}
                            checked={selected.includes(role.id)}
                            icon={
                                <View
                                    style={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: 6,
                                        backgroundColor: roleColour(role),
                                    }}
                                />
                            }
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
                        />
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
let bridge: ReturnType<typeof createProfileBridge> | undefined
function resolveContext(
    props: Record<string, any>,
    parent: ProfileRoleContext | null,
): ProfileRoleContext | undefined {
    const id =
        props.userId ??
        props.user?.id ??
        props.member?.userId ??
        props.member?.user?.id ??
        props.guildMember?.userId ??
        props.displayProfile?.userId ??
        props.userProfile?.userId ??
        props.profile?.userId ??
        parent?.userId
    const guildId =
        props.guildId ??
        props.guild?.id ??
        props.member?.guildId ??
        props.displayProfile?.guildId ??
        parent?.guildId ??
        selectedGuild()
    if (id === userId() && guildId) return { userId: id, guildId }
}
function projectedProps(props: Record<string, any>, ctx: ProfileRoleContext) {
    const available = roles(ctx.guildId),
        selection = profiles[roleKey(ctx.userId, ctx.guildId)]
    const next = { ...props }
    for (const key of ['member', 'guildMember'])
        if (props[key])
            next[key] = projectMember(
                props[key],
                selection,
                available,
                ctx.guildId,
            )
    for (const key of ['roles', 'roleIds'])
        if (Array.isArray(props[key])) {
            const selected = sortedVisibleRoles(
                realRoles(ctx.guildId, ctx.userId),
                selection,
                available,
                ctx.guildId,
            )
            next[key] = props[key].some((r: any) => typeof r === 'object')
                ? selected
                : selected.map(r => r.id)
        }
    return next
}
function projectionContext(guildArg?: string, channelArg?: string) {
    if (
        (guildArg !== undefined && typeof guildArg !== 'string') ||
        (channelArg !== undefined && typeof channelArg !== 'string')
    )
        return
    if (!active) return
    const guilds = store<any>('GuildStore'),
        channels = store<any>('ChannelStore')
    const guildId =
        (guildArg && guilds?.getGuild(guildArg)
            ? guildArg
            : channels?.getChannel(channelArg ?? guildArg)?.guild_id) ??
        (!guildArg ? selectedGuild() : undefined)
    const id = userId()
    if (!guildId || !id) return
    return {
        guildId,
        userId: id,
        selection: profiles[roleKey(id, guildId)],
        roles: roles(guildId),
        member: store<any>('GuildMemberStore')?.getMember(guildId, id),
        user:
            store<any>('UserStore')?.getUser?.(id) ??
            store<any>('UserStore')?.getCurrentUser(),
        status: store<any>('PresenceStore')?.getStatus(id) ?? 'offline',
        revision,
    }
}
export function patchProfileArgs<
    Args extends [unknown, unknown?, ...unknown[]],
>(args: Args): Args {
    const original = args[0]
    const patched = bridge?.patchArgs(args) ?? args
    if (patched[0] !== original) matched++
    return patched
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
        bridge = createProfileBridge(React, {
            enabled: () => active,
            useChanges: () => {
                useSyncExternalStore(subscribe, snapshot)
            },
            resolve: resolveContext,
            hasSelection: ctx => !!profiles[roleKey(ctx.userId, ctx.guildId)],
            project: projectedProps,
            renderRoles: ctx => (
                <View style={{ paddingHorizontal: 16 }}>
                    <Text style={{ color: '#b5bac1', fontWeight: 'bold' }}>
                        Cargos
                    </Text>
                    <ChipList guildId={ctx.guildId} id={ctx.userId} />
                </View>
            ),
            renderAction: ctx => (
                <ProfileAction guildId={ctx.guildId} id={ctx.userId} />
            ),
        })
        for (const [names, mode] of [
            [profileExports, 'profile'],
            [roleSectionExports, 'roles'],
        ] as const)
            for (const name of names)
                cleanup(
                    getModules(withProps(name), module => {
                        bridge?.register((module as any)[name], mode, name)
                    }),
                )
        for (const name of [
            'ChannelMemberStore',
            'GuildMemberListStore',
            'MemberListStore',
        ])
            cleanup(
                getStore(name, source => {
                    displayStores.add(source)
                    cleanup(
                        bindMemberListStore(source, projectionContext),
                        bindSectionListStore(source, projectionContext),
                    )
                }),
            )
        const sourceChanged = () => changed()
        for (const name of [
            'PresenceStore',
            'GuildRoleStore',
            'GuildMemberStore',
            'SelectedGuildStore',
            'UserStore',
        ])
            cleanup(
                getStore(name, source => {
                    source.addChangeListener(sourceChanged)
                    cleanup(() => source.removeChangeListener(sourceChanged))
                }),
            )
        cleanup(
            before(ReactJSXRuntime, 'jsx', patchProfileArgs),
            before(ReactJSXRuntime, 'jsxs', patchProfileArgs),
            before(React, 'createElement', patchProfileArgs),
            () => {
                active = false
                bridge = undefined
                displayStores.clear()
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
