import { beforeEach, describe, expect, it, vi } from 'vitest'

const f = vi.hoisted(() => ({
    definition: undefined as any,
    handlers: new Map<string, (p: any) => any>(),
    owner: 'self',
    records: new Map<string, any>(),
    local: new Set<string>(),
    stores: {} as Record<string, any>,
}))
vi.mock('@valenced/plugins/_', () => ({
    registerInternalPlugin: (_m: any, definition: any) => {
        f.definition = definition
    },
}))
vi.mock('@valenced/discord/common/flux', () => ({
    Dispatcher: { dispatch: vi.fn() },
}))
vi.mock('@valenced/discord/design', () => ({ Design: {} }))
vi.mock('@valenced/discord/flux', () => ({
    onFluxEventDispatched: (type: string, cb: (p: any) => any) => {
        f.handlers.set(type, cb)
        return () => f.handlers.delete(type)
    },
}))
vi.mock('@valenced/modules/finders', () => ({ getModules: () => () => {} }))
vi.mock('@valenced/modules/finders/filters', () => ({ withName: () => ({}) }))
vi.mock('@valenced/patcher', () => ({ instead: () => () => {} }))
vi.mock('react', () => ({ useState: () => [] }))
vi.mock('react-native', () => ({ Share: {} }))
vi.mock('~/byaflux/mobile', () => ({
    Action: () => null,
    Field: () => null,
    Panel: () => null,
    localMessageIds: f.local,
    userId: () => f.owner,
    store: (name: string) =>
        name === 'MessageStore'
            ? { getMessage: (_c: string, id: string) => f.records.get(id) }
            : undefined,
}))

import { start } from '../../src/plugins/start/message-logger-enhanced/engine'

describe('Mobile message history', () => {
    let cleanup: (() => void)[] = []
    let storage: any
    beforeEach(() => {
        for (const fn of cleanup.reverse()) fn()
        cleanup = []
        vi.useFakeTimers()
        f.handlers.clear()
        f.records.clear()
        f.local.clear()
        f.owner = 'self'
        storage = {
            cache: {
                owner: 'self',
                entries: [],
                ignoreBots: false,
                ignoreSelf: false,
            },
            set: vi.fn(async (value: any) => {
                Object.assign(storage.cache, value)
            }),
        }
        start({
            cleanup: (...fn: (() => void)[]) => cleanup.push(...fn),
            jsonStorage: storage,
            plugin: { reportError: vi.fn() },
        })
    })
    const message = (id = 'm') => ({
        id,
        channel_id: 'c',
        content: 'original',
        state: 'SENT',
        flags: 0,
        author: { id: 'other', username: 'Other' },
    })
    it('preserves a received deletion and saves its content', async () => {
        f.records.set('m', message())
        const result = f.handlers.get('MESSAGE_DELETE')!({
            type: 'MESSAGE_DELETE',
            id: 'm',
            channelId: 'c',
        })
        expect(result.type).toBe('MESSAGE_UPDATE')
        await vi.advanceTimersByTimeAsync(300)
        expect(storage.cache.entries[0]).toMatchObject({
            content: 'original',
            deleted: true,
        })
    })
    it('records the previous content before an edit', async () => {
        f.records.set('m', message())
        const payload = {
            type: 'MESSAGE_UPDATE',
            message: { id: 'm', channel_id: 'c', content: 'new' },
        }
        expect(f.handlers.get('MESSAGE_UPDATE')!(payload)).toBe(payload)
        await vi.advanceTimersByTimeAsync(300)
        expect(storage.cache.entries[0]).toMatchObject({
            content: 'new',
            history: ['original'],
        })
    })
    it('passes through local fake messages and ephemeral messages', () => {
        for (const record of [
            message('fake'),
            { ...message('ephemeral'), flags: 64 },
        ]) {
            f.records.set(record.id, record)
            if (record.id === 'fake') f.local.add(record.id)
            const payload = {
                type: 'MESSAGE_DELETE',
                id: record.id,
                channelId: 'c',
            }
            expect(f.handlers.get('MESSAGE_DELETE')!(payload)).toBe(payload)
        }
    })
    it('does not export another account history', async () => {
        f.owner = 'another'
        f.records.set('new', message('new'))
        f.handlers.get('MESSAGE_DELETE')!({
            type: 'MESSAGE_DELETE',
            id: 'new',
            channelId: 'c',
        })
        await vi.advanceTimersByTimeAsync(300)
        expect(storage.cache.owner).toBe('another')
        expect(storage.cache.entries).toHaveLength(1)
    })
})
