import { beforeEach, describe, expect, it, vi } from 'vitest'

const f = vi.hoisted(() => ({
    id: '1227436212982251533',
    pending: {} as Record<string, unknown>,
    accept: true,
    saved: new Map<string, string>(),
    patch: vi.fn(async () => ({})),
    file: vi.fn(async () => '/documents/ByaFlux/avatar.gif'),
    profile: {
        bio: 'Bio',
        pronouns: 'ele',
        themeColors: [0xff6600, 0x222222],
        banner: null,
    },
}))
vi.mock('@valenced/discord/common/flux', () => ({
    Dispatcher: {
        dispatch(action: Record<string, unknown>) {
            if (f.accept) {
                const { type: _, ...changes } = action
                Object.assign(f.pending, changes)
            }
        },
    },
}))
vi.mock('@valenced/discord/flux', () => ({
    Stores: {
        UserStore: {
            getCurrentUser: () => ({
                id: f.id,
                globalName: 'Haru',
                avatar: 'a_test',
                collectibles: { nameplate: { skuId: 'plate' } },
            }),
        },
        UserProfileStore: { getUserProfile: () => f.profile },
        UserProfileSettingsStore: { getPendingChanges: () => f.pending },
        SelfPresenceStore: { getStatus: () => 'dnd' },
        CustomStatusStore: {
            getCustomStatus: () => ({
                text: 'Teste',
                emojiName: 'x',
                expiresAtMs: String(Date.now() + 60000),
            }),
        },
    },
}))
vi.mock('@valenced/discord/native', () => ({
    CacheModule: {
        getItem: async (key: string) => f.saved.get(key) ?? null,
        setItem: (key: string, value: string) => f.saved.set(key, value),
    },
    FileModule: { writeFile: (...args: unknown[]) => f.file(...(args as [])) },
}))
vi.mock('@valenced/modules/finders/filters', () => ({ withProps: () => null }))
vi.mock('@valenced/modules/finders', () => ({
    getModules: (_: unknown, callback: (m: unknown) => void) =>
        callback({ HTTP: { patch: f.patch } }),
}))

import {
    allFields,
    makeProfile,
    profileKey,
} from '../../src/byaflux/profile-editor/model'
import { handleEditorRequest } from '../../src/byaflux/profile-editor/runtime'

const owner = '1227436212982251533'
const gif =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
async function capture(fields: string[] = ['bio', 'globalName']) {
    await handleEditorRequest(owner, 'captureProfile', {
        name: 'Meu preset',
        fields,
    })
    return (await handleEditorRequest(owner, 'loadProfiles', {})) as {
        id: string
        fields: string[]
        data: Record<string, unknown>
    }[]
}
beforeEach(() => {
    f.id = owner
    f.pending = {}
    f.accept = true
    f.saved.clear()
    f.patch.mockClear()
    f.file.mockClear()
    vi.unstubAllGlobals()
})
describe('Native mobile profile editor', () => {
    it('keeps all fifteen fields available and creates IDs without Web Crypto', () => {
        vi.stubGlobal('crypto', undefined)
        expect(allFields()).toHaveLength(15)
        expect(makeProfile(owner, 'A', { bio: 'B' }, ['bio']).id).toBeTruthy()
    })
    it('persists only selected fields, including pending native edits', async () => {
        f.pending.pendingBio = 'Rascunho'
        const [preset] = await capture()
        expect(preset!.data.bio).toBe('Rascunho')
        expect(preset!.data).not.toHaveProperty('avatarDataUrl')
        expect(f.saved.has(profileKey(owner))).toBe(true)
    })
    it('serializes concurrent saves without losing either preset', async () => {
        await Promise.all([capture(), capture()])
        expect(
            await handleEditorRequest(owner, 'loadProfiles', {}),
        ).toHaveLength(2)
    })
    it('restores only selected visuals into the native draft', async () => {
        const [preset] = await capture()
        f.pending = {}
        await handleEditorRequest(owner, 'applyProfile', {
            preset,
            fields: ['bio'],
        })
        expect(f.pending).toEqual({ pendingBio: 'Bio' })
        expect(f.patch).not.toHaveBeenCalled()
    })
    it('never trusts profile data supplied by the embedded page', async () => {
        const [preset] = await capture()
        f.pending = {}
        await handleEditorRequest(owner, 'applyProfile', {
            preset: { ...preset, data: { bio: 'Forged' } },
            fields: ['bio'],
        })
        expect(f.pending.pendingBio).toBe('Bio')
    })
    it('protects pending edits and reports unsupported native draft actions', async () => {
        const [preset] = await capture()
        f.pending.pendingBio = 'Unsaved'
        await expect(
            handleEditorRequest(owner, 'applyProfile', {
                preset,
                fields: ['bio'],
            }),
        ).rejects.toThrow('descarte')
        f.pending = {}
        f.accept = false
        await expect(
            handleEditorRequest(owner, 'applyProfile', {
                preset,
                fields: ['bio'],
            }),
        ).rejects.toThrow('não aceitou')
    })
    it('restores selected status through the existing Discord HTTP client', async () => {
        const [preset] = await capture(['presence', 'customStatus'])
        await handleEditorRequest(owner, 'applyProfile', {
            preset,
            fields: ['presence'],
        })
        expect(f.patch).toHaveBeenCalledWith({
            url: '/users/@me/settings',
            body: { status: 'dnd' },
        })
        expect(f.pending).toEqual({})
    })
    it('keeps presets isolated and refuses requests after account switches', async () => {
        await capture()
        f.id = '111111111111111111'
        await expect(
            handleEditorRequest(owner, 'deleteProfile', { id: 'anything' }),
        ).rejects.toThrow('conta mudou')
        expect(await handleEditorRequest(f.id, 'loadProfiles', {})).toEqual([])
        expect(f.saved.size).toBe(1)
    })
    it('renames and deletes only this account presets', async () => {
        const [preset] = await capture()
        await handleEditorRequest(owner, 'renameProfile', {
            id: preset!.id,
            name: 'Novo',
        })
        expect(
            await handleEditorRequest(owner, 'loadProfiles', {}),
        ).toMatchObject([{ name: 'Novo' }])
        await handleEditorRequest(owner, 'deleteProfile', { id: preset!.id })
        expect(await handleEditorRequest(owner, 'loadProfiles', {})).toEqual([])
    })
    it('validates GIFs, stages native avatar data and saves a local copy', async () => {
        await expect(
            handleEditorRequest(owner, 'useGifAvatar', {
                dataUrl: 'data:image/png;base64,AA==',
            }),
        ).rejects.toThrow('GIF inválido')
        await handleEditorRequest(owner, 'useGifAvatar', { dataUrl: gif })
        expect(f.pending.pendingAvatar).toMatchObject({
            assetOrigin: 'NEW_ASSET',
            imageUri: gif,
        })
        f.pending = {}
        await handleEditorRequest(owner, 'downloadGif', { dataUrl: gif })
        expect(f.file).toHaveBeenCalled()
    })
    it('rejects unknown RPC actions and empty selections', async () => {
        await expect(handleEditorRequest(owner, 'request', {})).rejects.toThrow(
            'Ação inválida',
        )
        await expect(
            handleEditorRequest(owner, 'captureProfile', {
                name: 'A',
                fields: [],
            }),
        ).rejects.toThrow('Selecione')
    })
    it('requires complete effect metadata instead of saving a broken cosmetic', async () => {
        const profile = f.profile as Record<string, unknown>
        profile.profileEffect = { skuId: 'effect' }
        await expect(capture(['profileEffect'])).rejects.toThrow(
            'Abra os efeitos',
        )
        expect(f.saved.size).toBe(0)
        profile.collectibles = [
            { skuId: 'effect', effects: [], title: 'Efeito' },
        ]
        const [preset] = await capture(['profileEffect'])
        expect(preset!.data.profileEffect).toMatchObject({
            skuId: 'effect',
            type: 1,
            effects: [],
        })
        profile.profileEffect = undefined
        profile.collectibles = undefined
    })
    it('normalizes native nameplate, decoration and display-name style IDs', async () => {
        f.pending = {
            pendingNameplate: { sku_id: 'plate', asset: 'asset' },
            pendingAvatarDecoration: {
                sku_id: 'decoration',
                asset: 'decoration',
            },
            pendingDisplayNameStyles: {
                font_id: 1,
                effect_id: 2,
                colors: [123],
            },
        }
        const [preset] = await capture([
            'nameplate',
            'avatarDecoration',
            'displayNameStyles',
        ])
        expect(preset!.data.nameplate).toMatchObject({
            skuId: 'plate',
            type: 2,
        })
        expect(preset!.data.avatarDecoration).toMatchObject({
            skuId: 'decoration',
        })
        expect(preset!.data.displayNameStyles).toEqual({
            font_id: 1,
            effect_id: 2,
            fontId: 1,
            effectId: 2,
            colors: [123],
        })
    })
    it('captures media locally and refuses to persist it after an account switch', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                ok: true,
                headers: { get: () => 'image/gif' },
                arrayBuffer: async () => {
                    f.id = '111111111111111111'
                    return new Uint8Array([71, 73, 70, 56, 57, 97]).buffer
                },
            })),
        )
        await expect(capture(['avatarDataUrl'])).rejects.toThrow('conta mudou')
        expect(f.saved.size).toBe(0)
    })
})
