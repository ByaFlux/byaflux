import { describe, expect, it, vi } from 'vitest'

const f = vi.hoisted(() => {
    const self = '1227436212982251533',
        guild = '2227436212982251533'
    const jsx = (type: unknown, props: unknown) => ({ type, props })
    const react = {
        createElement: jsx,
        createContext: () => ({ Provider: 'provider' }),
        useContext: () => null,
    }
    return {
        modules: {} as Record<string, unknown>,
        self,
        guild,
        jsx,
        react,
        runtime: { jsx, jsxs: jsx },
        options: null as any,
    }
})
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
    getStore: (_: string, cb: any) => {
        cb({ addChangeListener() {}, removeChangeListener() {} })
        return () => {}
    },
}))
vi.mock('~/byaflux/mobile', () => ({
    Action: 'action',
    Panel: 'panel',
    store: (name: string) =>
        name === 'UserStore'
            ? { getCurrentUser: () => ({ id: f.self }) }
            : name === 'SelectedGuildStore'
              ? { getGuildId: () => f.guild }
              : undefined,
}))
vi.mock('@valenced/plugins/_', () => ({
    registerInternalPlugin: (_: unknown, options: unknown) => {
        f.options = options
    },
}))
vi.mock('@valenced/patcher', () => ({
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
    expect(args[0](props).type).toBe('view')
    expect(args[0]({ ...props, userId: '3227436212982251533' }).type).toBe(a)
    for (const cleanup of cleanups.reverse()) cleanup()
    expect(patchProfileArgs([a, props])[0]).toBe(a)
    f.modules = {}
})
