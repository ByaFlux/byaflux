import { describe, expect, it, vi } from 'vitest'

const f = vi.hoisted(() => {
    const self = '1227436212982251533',
        guild = '2227436212982251533'
    const jsx = (type: unknown, props: unknown) => ({ type, props })
    const hooks = new Map<unknown, (args: any[], jsx: any) => any>()
    const cachedJsx = (type: unknown, props: unknown) =>
        hooks.get(type)?.([type, props], jsx) ?? jsx(type, props)
    const stores: Record<string, any> = {}
    const react = {
        createElement: jsx,
        createContext: () => ({ Provider: 'provider' }),
        useContext: () => null,
    }
    return {
        modules: {} as Record<string, unknown>,
        hooks,
        cachedJsx,
        stores,
        self,
        guild,
        jsx,
        react,
        runtime: { jsx, jsxs: jsx },
        options: null as any,
    }
})
vi.mock('@valenced/react/jsx-runtime', () => ({
    insteadJSX: (type: unknown, hook: any) => {
        f.hooks.set(type, hook)
        return () => f.hooks.delete(type)
    },
}))
vi.mock('@valenced/discord/design', () => ({
    Design: { TableCheckboxRow: 'checkbox' },
}))
vi.mock('@valenced/modules/finders', () => ({
    getModules: (key: string, callback: any) => {
        if (key in f.modules) callback(f.modules)
        return () => {}
    },
}))
vi.mock('@valenced/modules/finders/filters', () => ({
    withProps: (key: string) => key,
}))
vi.mock('react', () => ({
    useSyncExternalStore: () => 0,
    useState: () => [false, () => {}],
}))
vi.mock('react/jsx-runtime', () => ({ jsx: f.jsx, jsxs: f.jsx }))
vi.mock('react-native', () => ({
    Modal: 'modal',
    Pressable: 'pressable',
    ScrollView: 'scroll',
    Text: 'text',
    TextInput: 'input',
    View: 'view',
}))
vi.mock('@valenced/react', () => ({
    React: f.react,
    ReactJSXRuntime: f.runtime,
}))
vi.mock('@valenced/discord/flux', () => ({
    getStore: (name: string, cb: any) => {
        const source = f.stores[name] ?? {}
        source.addChangeListener ??= () => {}
        source.removeChangeListener ??= () => {}
        cb(source)
        return () => {}
    },
}))
vi.mock('~/byaflux/mobile', () => ({
    Action: 'action',
    Panel: 'panel',
    store: (name: string) =>
        f.stores[name] ??
        (name === 'UserStore'
            ? { getCurrentUser: () => ({ id: f.self }) }
            : name === 'SelectedGuildStore'
              ? { getGuildId: () => f.guild }
              : undefined),
}))
vi.mock('@valenced/plugins/_', () => ({
    registerInternalPlugin: (_: unknown, options: unknown) => {
        f.options = options
    },
}))
vi.mock('@valenced/patcher', () => ({
    instead: (object: any, key: string, hook: any) => {
        const original = object[key]
        object[key] = (...args: unknown[]) => hook(args, original.bind(object))
        return () => {
            object[key] = original
        }
    },
    before: (object: any, key: string, hook: any) => {
        const original = object[key]
        object[key] = (...args: unknown[]) => original(...(hook(args) ?? args))
        return () => {
            object[key] = original
        }
    },
}))

import { patchProfileArgs } from '../../src/plugins/start/fake-roles'

function UserProfileHeader() {
    return null
}
function UserProfileModal() {
    return null
}
describe('FakeRoles profile bridge', () => {
    it('preserves native rendering without recursively wrapping profiles', () => {
        const cleanups: (() => void)[] = []
        f.options.start({
            jsonStorage: {
                cache: { profiles: {} },
                set: () => Promise.resolve(),
            },
            plugin: { reportError: vi.fn() },
            cleanup: (...values: (() => void)[]) => cleanups.push(...values),
        })
        const props = { userId: f.self, guildId: f.guild }
        const args = patchProfileArgs([UserProfileHeader, props]) as any
        expect(args[0]).not.toBe(UserProfileHeader)
        const rendered = args[0](props)
        expect(rendered.props.children[0].type).toBe(UserProfileHeader)
        const root = patchProfileArgs([UserProfileModal, props]) as any
        expect(root[0](props).props.children[1]).toBe(null)
        const other = args[0]({ ...props, userId: '3227436212982251533' })
        expect(other.type).toBe(UserProfileHeader)
        for (const cleanup of cleanups.reverse()) cleanup()
        expect(args[0](props).type).toBe(UserProfileHeader)
    })
})

it('matches minified role exports and restores saved selections before rendering', () => {
    function a() {
        return null
    }
    f.modules.UserProfileRoles = a
    const cleanups: (() => void)[] = []
    f.options.start({
        jsonStorage: {
            cache: {
                profiles: {
                    [`${f.self}:${f.guild}`]: {
                        added: ['3227436212982251533'],
                        hidden: [],
                    },
                },
            },
            set: () => Promise.resolve(),
        },
        plugin: { reportError: vi.fn() },
        cleanup: (...values: (() => void)[]) => cleanups.push(...values),
    })
    const props = { userId: f.self, guildId: f.guild }
    const args = patchProfileArgs([a, props]) as any
    expect(args[0]).not.toBe(a)
    expect(patchProfileArgs([a, null])[0]).not.toBe(a)
    expect(args[0](props).type).toBe('view')
    expect(args[0]({ ...props, userId: '3227436212982251533' }).type).toBe(a)
    for (const cleanup of cleanups.reverse()) cleanup()
    expect(patchProfileArgs([a, props])[0]).toBe(a)
    f.modules = {}
})

it('patches cached native JSX factories and message author metadata without changing real members', () => {
    function a() {
        return null
    }
    const role = '3227436212982251533'
    const member = Object.freeze({
        userId: f.self,
        roles: Object.freeze([]),
        iconRoleId: undefined,
    })
    const nativeAuthor = Object.freeze({
        colorString: '#123456',
        colorStrings: null,
        iconRoleId: undefined,
    })
    const getMessageAuthor = () => nativeAuthor
    f.modules = { UserProfileRoles: a, getMessageAuthor }
    f.stores.GuildRoleStore = {
        getSortedRoles: () => [
            {
                id: role,
                name: 'Owner',
                position: 100,
                colors: { primary_color: 0xff6600 },
                unicodeEmoji: '👑',
                hoist: true,
            },
        ],
    }
    f.stores.GuildMemberStore = { getMember: () => member }
    f.stores.ChannelStore = {
        getChannel: (id: string) =>
            id === 'guild-channel' ? { guild_id: f.guild } : {},
    }
    const cleanups: (() => void)[] = []
    f.options.start({
        jsonStorage: {
            cache: {
                profiles: {
                    [`${f.self}:${f.guild}`]: { added: [role], hidden: [] },
                },
            },
            set: () => Promise.resolve(),
        },
        plugin: { reportError: vi.fn() },
        cleanup: (...values: (() => void)[]) => cleanups.push(...values),
    })
    const rendered = f.cachedJsx(a, { userId: f.self, guildId: f.guild })
    expect(rendered.type).not.toBe(a)
    const wrappedAuthor = f.modules.getMessageAuthor as any
    const message = { author: { id: f.self }, channel_id: 'guild-channel' }
    expect(wrappedAuthor(message)).toMatchObject({
        colorString: '#ff6600',
        iconRoleId: role,
        colorRoleId: role,
    })
    expect(wrappedAuthor({ ...message, channel_id: 'dm-channel' })).toBe(
        nativeAuthor,
    )
    expect(wrappedAuthor({ ...message, author: { id: role } })).toBe(
        nativeAuthor,
    )
    expect(member.roles).toEqual([])
    for (const cleanup of cleanups.reverse()) cleanup()
    expect(f.cachedJsx(a, { userId: f.self, guildId: f.guild }).type).toBe(a)
    expect(f.modules.getMessageAuthor).toBe(getMessageAuthor)
    f.modules = {}
    for (const key of Object.keys(f.stores)) f.stores[key] = undefined
})

it('updates native chat and sidebar member reads without depending on named components', () => {
    const role = '3227436212982251533'
    const member = Object.freeze({
        userId: f.self,
        roles: Object.freeze([]),
        permissions: 0n,
        colorString: '#123456',
        iconRoleId: undefined,
    })
    const getMember = () => member
    f.modules = {}
    f.stores.GuildMemberStore = { getMember, getMemberVersion: () => 1 }
    f.stores.GuildStore = {
        getGuild: (id: string) => (id === f.guild ? { id } : undefined),
    }
    f.stores.GuildRoleStore = {
        getSortedRoles: () => [
            {
                id: role,
                name: 'Owner',
                position: 100,
                color: 0xff6600,
                unicodeEmoji: '👑',
            },
        ],
    }
    const cleanups: (() => void)[] = []
    f.options.start({
        jsonStorage: {
            cache: {
                profiles: {
                    [`${f.self}:${f.guild}`]: { added: [role], hidden: [] },
                },
            },
            set: () => Promise.resolve(),
        },
        plugin: { reportError: vi.fn() },
        cleanup: (...values: (() => void)[]) => cleanups.push(...values),
    })
    const source = f.stores.GuildMemberStore
    const rendered = source.getMember(f.guild, f.self)
    expect(rendered.colorString).toBe('#ff6600')
    expect(rendered.iconRoleId).toBe(role)
    expect(rendered.roles).toBe(member.roles)
    expect(rendered.permissions).toBe(0n)
    expect(source.getMember(f.guild, role)).toBe(member)
    expect(source.getMember('dm', f.self)).toBe(member)
    for (const cleanup of cleanups.reverse()) cleanup()
    expect(source.getMember).toBe(getMember)
    expect(source.getMember(f.guild, f.self)).toBe(member)
    for (const key of Object.keys(f.stores)) f.stores[key] = undefined
})
