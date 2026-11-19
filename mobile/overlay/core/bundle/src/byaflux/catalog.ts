export interface BadgeDefinition {
    name: string
    description: string
    icon: string
}
export interface BadgeCatalog {
    schemaVersion: 1
    badges: Record<string, BadgeDefinition>
    users: Record<string, string[]>
}
const own = (object: object, key: string) =>
    Object.getOwnPropertyDescriptor(object, key) !== undefined
const record = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value)
export const validUserId = (id: string) => /^\d{17,20}$/.test(id)
export const validBadgeId = (id: string) =>
    /^[a-z0-9][a-z0-9_-]{0,63}$/.test(id) &&
    !['constructor', 'prototype', '__proto__'].includes(id)

export function isHttpsUrl(value: string): boolean {
    try {
        const url = new URL(value)
        return url.protocol === 'https:' && !url.username && !url.password
    } catch {
        return false
    }
}

export function validBadgeIcon(value: string): boolean {
    return (
        isHttpsUrl(value) ||
        /^icons\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:png|webp|gif|jpe?g|svg)$/.test(
            value,
        )
    )
}

export function resolveBadgeIcon(icon: string, source: string): string {
    if (!validBadgeIcon(icon) || !isHttpsUrl(source))
        throw new Error('URL da imagem ou da fonte inválida.')
    return new URL(icon, source).href
}

export function validateCatalog(value: unknown): BadgeCatalog {
    if (
        !record(value) ||
        value.schemaVersion !== 1 ||
        !record(value.badges) ||
        !record(value.users)
    )
        throw new Error(
            'Catálogo inválido: schemaVersion, badges e users são obrigatórios.',
        )
    if (
        Object.keys(value.badges).length > 10000 ||
        Object.keys(value.users).length > 100000
    )
        throw new Error('O catálogo excede o limite de entradas.')
    const badges: Record<string, BadgeDefinition> = Object.create(null)
    const users: Record<string, string[]> = Object.create(null)
    for (const [key, entry] of Object.entries(value.badges)) {
        if (
            !validBadgeId(key) ||
            !record(entry) ||
            typeof entry.name !== 'string' ||
            !entry.name.trim() ||
            entry.name.length > 128 ||
            typeof entry.description !== 'string' ||
            entry.description.length > 500 ||
            typeof entry.icon !== 'string' ||
            entry.icon.length > 2048 ||
            !validBadgeIcon(entry.icon)
        )
            throw new Error(`Definição inválida para a badge: ${key}`)
        badges[key] = {
            name: entry.name.trim(),
            description: entry.description,
            icon: entry.icon,
        }
    }
    for (const [id, entries] of Object.entries(value.users)) {
        if (
            !validUserId(id) ||
            !Array.isArray(entries) ||
            entries.length > 100 ||
            entries.some(key => typeof key !== 'string' || !own(badges, key))
        )
            throw new Error(`Usuário ou atribuições inválidas: ${id}`)
        users[id] = [...new Set(entries)] as string[]
    }
    return { schemaVersion: 1, badges, users }
}

export function userBadges(catalog: BadgeCatalog, userId: string) {
    return (catalog.users[userId] ?? []).map(id => ({
        id,
        ...catalog.badges[id],
    }))
}
