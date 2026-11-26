import { Dispatcher } from '@valenced/discord/common/flux'
import { Stores } from '@valenced/discord/flux'
import { CacheModule, FileModule } from '@valenced/discord/native'
import { getModules } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import { Buffer } from 'buffer'
import {
    allFields,
    makeProfile,
    pendingProfile,
    profileKey,
    readProfiles,
    restoredStatus,
    selectedData,
} from './model'
import type { Field, SavedProfile } from './model'

type Data = Record<string, any>
let http:
    | { patch(options: { url: string; body: unknown }): Promise<unknown> }
    | undefined
getModules(withProps<{ HTTP: typeof http }>('HTTP'), module => {
    http = module.HTTP
})
const store = (name: string): Data | undefined =>
    Stores[name] as Data | undefined
export function accountId(): string | undefined {
    return store('UserStore')?.getCurrentUser?.()?.id
}
function own(id: string) {
    if (!id || accountId() !== id)
        throw Error('A conta mudou. Abra o editor novamente.')
}
function profileStore(): Data {
    const result = store('UserProfileSettingsStore')
    if (!result?.getPendingChanges)
        throw Error(
            'O editor nativo ainda não foi carregado. Abra Editar perfil e tente novamente.',
        )
    return result
}
async function image(url: string | null): Promise<string | null> {
    if (!url) return null
    if (url.startsWith('data:')) {
        if (
            !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(
                url,
            )
        )
            throw Error('A imagem do perfil não tem um formato compatível.')
        if (((url.length - url.indexOf(',') - 1) * 3) / 4 > 8 * 1024 * 1024)
            throw Error('A imagem ultrapassa 8 MB.')
        return url
    }
    const response = await fetch(url)
    if (!response.ok) throw Error('Não foi possível salvar a imagem do perfil.')
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength > 8 * 1024 * 1024)
        throw Error('A imagem ultrapassa 8 MB.')
    const type = response.headers.get('content-type')?.split(';')[0]
    if (!type?.startsWith('image/'))
        throw Error('O servidor não retornou uma imagem.')
    return `data:${type};base64,${Buffer.from(bytes).toString('base64')}`
}
const cdn = (kind: 'avatars' | 'banners', id: string, hash?: string) =>
    hash
        ? `https://cdn.discordapp.com/${kind}/${id}/${hash}.${hash.startsWith('a_') ? 'gif' : 'png'}?size=512`
        : null
async function load(id: string) {
    own(id)
    const value = await CacheModule.getItem(profileKey(id))
    own(id)
    return readProfiles(value ? JSON.parse(value) : [], id)
}
let writes = Promise.resolve()
async function update(
    id: string,
    fn: (profiles: SavedProfile[]) => SavedProfile[],
) {
    const task = writes
        .catch(() => {})
        .then(async () => {
            const current = await load(id)
            own(id)
            await CacheModule.setItem(
                profileKey(id),
                JSON.stringify(fn(current)),
            )
            own(id)
        })
    writes = task
    await task
}
async function capture(id: string, name: string, fields: Field[]) {
    own(id)
    const user = store('UserStore')!.getCurrentUser()
    const profile = store('UserProfileStore')?.getUserProfile?.(id)
    if (!profile)
        throw Error('Abra seu próprio perfil antes de salvar um preset.')
    const pending = { ...(profileStore().getPendingChanges() ?? {}) }
    const proto = store('UserSettingsProtoStore')?.settings?.status
    const custom =
        store('CustomStatusStore')?.getCustomStatus?.(id) ?? proto?.customStatus
    const data: Data = {
        globalName: user.globalName ?? user.global_name ?? null,
        bio: profile.bio ?? '',
        pronouns: profile.pronouns ?? '',
        themeColors: profile.themeColors ?? profile.theme_colors ?? null,
        accentColor: profile.accentColor ?? user.accentColor ?? null,
        avatarDecoration:
            user.avatarDecorationData ?? profile.avatarDecorationData ?? null,
        profileEffect: profile.profileEffect ?? profile.profile_effect ?? null,
        nameplate: user.collectibles?.nameplate ?? null,
        profileFrame: profile.profileFrame ?? null,
        displayNameStyles:
            user.displayNameStyles ?? user.display_name_styles ?? null,
        customStatus: custom
            ? {
                  text: custom.text ?? '',
                  emojiId: custom.emojiId ?? custom.emoji_id ?? '0',
                  emojiName: custom.emojiName ?? custom.emoji_name ?? '',
                  expiresAtMs: String(
                      custom.expiresAtMs ?? custom.expires_at_ms ?? 0,
                  ),
              }
            : null,
        presence:
            store('SelfPresenceStore')?.getStatus?.() ??
            proto?.status?.value ??
            'online',
        primaryGuildId:
            user.primaryGuild?.identityEnabled === false
                ? null
                : (user.primaryGuild?.identityGuildId ?? null),
    }
    for (const [field, key] of Object.entries({
        globalName: 'pendingGlobalName',
        bio: 'pendingBio',
        pronouns: 'pendingPronouns',
        themeColors: 'pendingThemeColors',
        accentColor: 'pendingAccentColor',
        avatarDecoration: 'pendingAvatarDecoration',
        profileEffect: 'pendingProfileEffect',
        nameplate: 'pendingNameplate',
        profileFrame: 'pendingProfileFrame',
        displayNameStyles: 'pendingDisplayNameStyles',
        primaryGuildId: 'pendingPrimaryGuildId',
    }))
        if (pending[key] !== undefined) data[field] = pending[key]
    if (fields.includes('profileEffect') && data.profileEffect) {
        const effect = data.profileEffect
        const skuId = effect.skuId ?? effect.sku_id
        const full = effect.effects
            ? effect
            : profile.collectibles?.find?.(
                  (item: Data) => (item.skuId ?? item.sku_id) === skuId,
              )
        if (!full?.effects || !skuId)
            throw Error(
                'Abra os efeitos no editor para carregar os dados, ou desmarque Efeito de perfil.',
            )
        data.profileEffect = { ...full, skuId, type: full.type ?? 1 }
    }
    if (fields.includes('nameplate') && data.nameplate) {
        const plate = data.nameplate,
            skuId = plate.skuId ?? plate.sku_id
        if (!skuId || typeof plate.asset !== 'string')
            throw Error(
                'Abra o nameplate no editor para carregar os dados, ou desmarque Nameplate.',
            )
        data.nameplate = { ...plate, skuId, type: plate.type ?? 2 }
    }
    if (fields.includes('avatarDecoration') && data.avatarDecoration) {
        const value = data.avatarDecoration,
            skuId = value.skuId ?? value.sku_id
        if (!skuId || typeof value.asset !== 'string')
            throw Error(
                'Abra a decoração no editor para carregar os dados, ou desmarque Decoração do avatar.',
            )
        data.avatarDecoration = { ...value, skuId }
    }
    if (fields.includes('displayNameStyles') && data.displayNameStyles) {
        const value = data.displayNameStyles,
            fontId = value.fontId ?? value.font_id,
            effectId = value.effectId ?? value.effect_id
        if (typeof fontId !== 'number' || typeof effectId !== 'number')
            throw Error(
                'O estilo do nome ainda não foi carregado. Abra o editor e tente novamente.',
            )
        data.displayNameStyles = {
            fontId,
            effectId,
            font_id: fontId,
            effect_id: effectId,
            colors: Array.isArray(value.colors) ? [...value.colors] : [],
        }
    }
    for (const [field, kind, hash, key] of [
        ['avatarDataUrl', 'avatars', user.avatar, 'pendingAvatar'],
        ['bannerDataUrl', 'banners', profile.banner, 'pendingBanner'],
    ] as const) {
        if (fields.includes(field))
            data[field] =
                pending[key] !== undefined
                    ? await image(pending[key]?.imageUri ?? pending[key])
                    : await image(cdn(kind, id, hash))
    }
    own(id)
    const preset = makeProfile(id, name, data, fields)
    await update(id, entries => [...entries, preset])
    return preset
}
async function apply(id: string, preset: SavedProfile, fields: Field[]) {
    own(id)
    const saved = (await load(id)).find(p => p.id === preset.id)
    if (!saved) throw Error('O preset não existe nesta conta.')
    const data = selectedData(saved, fields),
        pending = pendingProfile(data)
    const settings = profileStore()
    if (
        Object.values(settings.getPendingChanges() ?? {}).some(
            v => v !== undefined,
        )
    )
        throw Error(
            'Salve ou descarte as alterações atuais antes de carregar um preset.',
        )
    const status: Data = {}
    if ('presence' in data) status.status = data.presence
    if ('customStatus' in data) {
        const restored = restoredStatus(saved)
        status.custom_status =
            data.customStatus != null && restored
                ? {
                      text: restored.text,
                      emoji_id:
                          restored.emojiId === '0' ? null : restored.emojiId,
                      emoji_name: restored.emojiName || null,
                      expires_at: Number(restored.expiresAtMs)
                          ? new Date(Number(restored.expiresAtMs)).toISOString()
                          : null,
                  }
                : null
    }
    if (Object.keys(status).length && !http)
        throw Error('As configurações de status ainda não foram carregadas.')
    own(id)
    if (Object.keys(pending).length) {
        Dispatcher.dispatch({
            type: 'USER_PROFILE_SETTINGS_SET_PENDING_CHANGES',
            ...pending,
        })
        const actual = settings.getPendingChanges() ?? {}
        if (
            !Object.keys(pending).every(
                key =>
                    JSON.stringify(actual[key]) ===
                    JSON.stringify(pending[key]),
            )
        )
            throw Error(
                'O Discord não aceitou todos os campos. Descarte as mudanças pendentes e tente menos campos.',
            )
    }
    if (Object.keys(status).length) {
        own(id)
        await http!.patch({ url: '/users/@me/settings', body: status })
    }
    own(id)
}
function gif(value: unknown): string {
    if (
        typeof value !== 'string' ||
        value.length > 11200000 ||
        !/^data:image\/gif;base64,R0lGOD[dl][A-Za-z0-9+/=]+$/.test(value)
    )
        throw Error('GIF inválido ou maior que 8 MB.')
    return value
}
export async function handleEditorRequest(
    id: string,
    action: string,
    params: Data,
): Promise<unknown> {
    own(id)
    const fields = allFields().filter(
        f => Array.isArray(params.fields) && params.fields.includes(f),
    )
    switch (action) {
        case 'loadProfiles':
            return load(id)
        case 'captureProfile':
            return capture(id, String(params.name ?? ''), fields)
        case 'applyProfile':
            return apply(id, params.preset, fields)
        case 'deleteProfile':
            return update(id, entries =>
                entries.filter(p => p.id !== params.id),
            )
        case 'renameProfile': {
            const name = String(params.name ?? '').trim()
            if (!name || name.length > 64)
                throw Error('Use um nome de até 64 caracteres.')
            return update(id, entries =>
                entries.map(p => (p.id === params.id ? { ...p, name } : p)),
            )
        }
        case 'useGifAvatar': {
            const image = gif(params.dataUrl),
                settings = profileStore()
            if (
                Object.values(settings.getPendingChanges() ?? {}).some(
                    v => v !== undefined,
                )
            )
                throw Error(
                    'Salve ou descarte as alterações atuais antes de usar o GIF.',
                )
            const pending = pendingProfile({ avatarDataUrl: image })
            Dispatcher.dispatch({
                type: 'USER_PROFILE_SETTINGS_SET_PENDING_CHANGES',
                ...pending,
            })
            if (
                JSON.stringify(settings.getPendingChanges()?.pendingAvatar) !==
                JSON.stringify(pending.pendingAvatar)
            )
                throw Error(
                    'O Discord não aceitou o avatar. Abra Editar perfil e tente novamente.',
                )
            return null
        }
        case 'downloadGif':
            return FileModule.writeFile(
                'documents',
                `ByaFlux/avatar-${Date.now()}.gif`,
                gif(params.dataUrl).split(',')[1]!,
                'base64',
            )
        default:
            throw Error('Ação inválida.')
    }
}
