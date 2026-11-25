/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface RoleSelection {
    added: string[]
    hidden: string[]
}
export interface VisualRole {
    id: string
    name: string
    position?: number
    color?: number
    colorString?: string
    managed?: boolean
    hoist?: boolean
    icon?: string | null
    unicodeEmoji?: string | null
    colorStrings?: {
        primaryColor?: string
        secondaryColor?: string
        tertiaryColor?: string
    } | null
    colors?: {
        primary_color?: number
        secondary_color?: number
        tertiary_color?: number
    }
}
export const emptyRoles = (): RoleSelection => ({ added: [], hidden: [] })
const ids = (value: unknown): string[] =>
    Array.isArray(value)
        ? [
              ...new Set(
                  value.filter(
                      (id): id is string =>
                          typeof id === 'string' && /^\d{17,20}$/.test(id),
                  ),
              ),
          ].slice(0, 5000)
        : []
export function readSelection(value: unknown): RoleSelection {
    const v =
        value && typeof value === 'object'
            ? (value as Partial<RoleSelection>)
            : {}
    return { added: ids(v.added), hidden: ids(v.hidden) }
}
export function roleKey(userId: string, guildId: string): string {
    return `${userId}:${guildId}`
}
export function orderedRoles<T extends VisualRole>(
    roles: readonly T[],
    guildId: string,
): T[] {
    return roles
        .filter(role => role.id !== guildId)
        .slice()
        .sort(
            (a, b) =>
                (b.position ?? 0) - (a.position ?? 0) ||
                compareSnowflakes(a.id, b.id),
        )
}
export function visibleRoles(
    real: readonly string[],
    selection: RoleSelection | undefined,
    available: readonly string[],
): string[] {
    if (!selection) return [...real]
    const allowed = new Set(available),
        hidden = new Set(selection.hidden)
    return [
        ...new Set([...real.filter(id => !hidden.has(id)), ...selection.added]),
    ].filter(id => allowed.has(id))
}
export function toggleRole(
    real: readonly string[],
    current: RoleSelection,
    roleId: string,
    checked: boolean,
): RoleSelection {
    const added = new Set(current.added),
        hidden = new Set(current.hidden)
    added.delete(roleId)
    hidden.delete(roleId)
    if (checked && !real.includes(roleId)) added.add(roleId)
    if (!checked && real.includes(roleId)) hidden.add(roleId)
    return { added: [...added], hidden: [...hidden] }
}
function hex(value: unknown): string | undefined {
    if (typeof value === 'string' && /^#[a-f\d]{6}$/i.test(value)) return value
    if (
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value > 0 &&
        value <= 0xffffff
    )
        return `#${value.toString(16).padStart(6, '0')}`
}
export function roleColors(role: VisualRole) {
    return {
        primaryColor:
            hex(role.colorStrings?.primaryColor) ??
            hex(role.colorString) ??
            hex(role.colors?.primary_color) ??
            hex(role.color),
        secondaryColor:
            hex(role.colorStrings?.secondaryColor) ??
            hex(role.colors?.secondary_color),
        tertiaryColor:
            hex(role.colorStrings?.tertiaryColor) ??
            hex(role.colors?.tertiary_color),
    }
}
export function roleColour(role: VisualRole): string {
    return roleColors(role).primaryColor ?? '#99aab5'
}

export function compareSnowflakes(a: string, b: string) {
    return a.length - b.length || a.localeCompare(b)
}
export interface MemberGroup {
    id: string
    count: number
    [key: string]: unknown
}
export interface MemberListSnapshot {
    rows: readonly unknown[]
    groups: readonly MemberGroup[]
    [key: string]: unknown
}
export type MemberRecord = Record<string, any>
export function memberRowId(row: unknown): string | undefined {
    if (!row || typeof row !== 'object') return
    const r = row as MemberRecord
    if (r.type === 'GROUP' || r.type === 'group' || r.group) return
    return (
        r.user?.id ??
        r.member?.user?.id ??
        r.member?.userId ??
        r.userId ??
        (typeof r.id === 'string' ? r.id : undefined)
    )
}
function groupRowId(row: unknown): string | undefined {
    if (!row || typeof row !== 'object') return
    const r = row as MemberRecord
    return (
        r.group?.id ??
        (r.type === 'GROUP' || r.type === 'group' ? r.id : undefined)
    )
}
export function sortedVisibleRoles(
    real: readonly string[],
    selection: RoleSelection | undefined,
    roles: readonly VisualRole[],
    guildId: string,
): VisualRole[] {
    const selected = new Set(
        visibleRoles(
            real,
            selection,
            roles.map(r => r.id),
        ),
    )
    return orderedRoles(roles, guildId).filter(r => selected.has(r.id))
}
export function projectMember<T extends MemberRecord>(
    member: T,
    selection: RoleSelection | undefined,
    roles: readonly VisualRole[],
    guildId: string,
): T & MemberRecord {
    if (!selection) return member
    const selected = sortedVisibleRoles(
        member.roles ?? [],
        selection,
        roles,
        guildId,
    )
    const colour = selected.find(r => roleColors(r).primaryColor),
        hoist = selected.find(r => r.hoist)
    return {
        ...member,
        roles: selected.map(r => r.id),
        colorString: colour ? roleColour(colour) : undefined,
        colorStrings: colour ? roleColors(colour) : null,
        color: colour ? parseInt(roleColour(colour).slice(1), 16) : 0,
        colorRoleId: colour?.id,
        colorRoleName: colour?.name,
        highestRoleId: selected[0]?.id,
        hoistRoleId: hoist?.id,
        iconRoleId: selected.find(r => r.icon || r.unicodeEmoji)?.id,
        hoistRole: hoist?.id ?? null,
        hoistedRole: hoist?.id ?? null,
    }
}
function rowName(row: MemberRecord): string {
    return (
        row.comparator ??
        row.sortKey ??
        row.nick ??
        row.member?.nick ??
        row.user?.globalName ??
        row.user?.global_name ??
        row.user?.username ??
        row.username ??
        ''
    )
}
export function compareMemberRows(a: MemberRecord, b: MemberRecord): number {
    const an = String(rowName(a)).normalize('NFKC').toLocaleLowerCase(),
        bn = String(rowName(b)).normalize('NFKC').toLocaleLowerCase()
    return (
        an.localeCompare(bn) ||
        compareSnowflakes(memberRowId(a) ?? '0', memberRowId(b) ?? '0')
    )
}
export function projectMemberList<T extends MemberListSnapshot>(
    source: T,
    guildId: string,
    userId: string,
    selection: RoleSelection | undefined,
    roles: readonly VisualRole[],
    member: MemberRecord | undefined,
    user: MemberRecord | undefined,
    status: string,
): T {
    if (
        !selection ||
        !member ||
        !user ||
        !Array.isArray(source.rows) ||
        !Array.isArray(source.groups)
    )
        return source
    const ordered = orderedRoles(roles, guildId),
        selected = sortedVisibleRoles(
            member.roles ?? [],
            selection,
            ordered,
            guildId,
        )
    const offline = status === 'offline' || status === 'invisible',
        hoist = selected.find(r => r.hoist)
    const targetId = offline ? 'offline' : (hoist?.id ?? 'online')
    const sections = new Map<
        string,
        { header?: MemberRecord; rows: unknown[] }
    >()
    let offset = 0,
        originalId: string | undefined,
        originalRow: MemberRecord | undefined
    // Native group counts include unloaded rows. Preserve their slots during projection.
    for (const meta of source.groups) {
        if (!Number.isSafeInteger(meta.count) || meta.count < 0) return source
        const header = source.rows[offset] as MemberRecord | undefined
        if (header && groupRowId(header) !== meta.id) return source
        const rows = source.rows.slice(offset + 1, offset + 1 + meta.count)
        if (rows.length !== meta.count) return source
        const index = rows.findIndex(row => memberRowId(row) === userId)
        if (index >= 0) {
            originalId = meta.id
            originalRow = rows[index] as MemberRecord
            rows.splice(index, 1)
        }
        sections.set(meta.id, {
            header: header ?? (meta.type === 'GROUP' ? meta : undefined),
            rows,
        })
        offset += meta.count + 1
    }
    if (offset !== source.rows.length || !originalRow) return source
    const visual = projectMember(member, selection, ordered, guildId)
    const template = originalRow
    const row: MemberRecord = {
        ...template,
        userId,
        user: originalRow.user ?? user,
        nick: member.nick ?? originalRow.nick ?? null,
        roles: visual.roles,
        color: visual.color,
        colorString: visual.colorString,
        colorStrings: visual.colorStrings,
        colorRoleId: visual.colorRoleId,
        colorRoleName: visual.colorRoleName,
        highestRoleId: visual.highestRoleId,
        hoistRoleId: visual.hoistRoleId,
        iconRoleId: visual.iconRoleId,
        ...(Object.hasOwn(template, 'groupId') ? { groupId: targetId } : {}),
        hoistRole: visual.hoistRole,
        hoistedRole: visual.hoistRole,
        status,
        ...(Object.hasOwn(originalRow, 'activities')
            ? { activities: originalRow.activities }
            : {}),
    }
    if (template.member)
        row.member = {
            ...template.member,
            ...visual,
            userId,
            ...(template.member.user ? { user: template.member.user } : {}),
        }
    if (template.guildMember)
        row.guildMember = { ...template.guildMember, ...visual, userId }
    let groups = source.groups.map(g => ({ ...g }))
    if (originalId !== targetId) {
        groups = groups.map(g => ({
            ...g,
            count: Math.max(
                0,
                g.count +
                    (g.id === targetId ? 1 : g.id === originalId ? -1 : 0),
            ),
        }))
        if (!groups.some(g => g.id === targetId))
            groups.push({ id: targetId, count: 1 })
    }
    if (!groups.some(g => g.id === targetId)) return source
    if (!source.groups.some(g => g.id === targetId)) {
        const index = groups.findIndex(g => g.id === targetId)
        const [targetGroup] = groups.splice(index, 1)
        const rank = ordered.findIndex(r => r.id === targetId)
        const before = groups.findIndex(g =>
            targetId === 'offline'
                ? false
                : targetId === 'online'
                  ? g.id === 'offline'
                  : g.id === 'online' ||
                    g.id === 'offline' ||
                    ordered.findIndex(r => r.id === g.id) > rank,
        )
        groups.splice(before < 0 ? groups.length : before, 0, targetGroup)
    }
    if (!sections.has(targetId)) {
        const header = [...sections.values()].find(s => s.header)?.header
        if (!header) return source
        sections.set(targetId, {
            header: {
                ...header,
                id: targetId,
                ...(Object.hasOwn(header, 'key') ? { key: targetId } : {}),
                ...(Object.hasOwn(header, 'title')
                    ? {
                          title:
                              targetId === hoist?.id
                                  ? hoist.name
                                  : targetId === 'online'
                                    ? 'Online'
                                    : 'Offline',
                      }
                    : {}),
                name: targetId === hoist?.id ? hoist.name : targetId,
                ...(Object.hasOwn(header, 'groupId')
                    ? { groupId: targetId }
                    : {}),
                ...(Object.hasOwn(header, 'role') ? { role: hoist } : {}),
                ...(header.group
                    ? { group: { ...header.group, id: targetId } }
                    : {}),
            },
            rows: [],
        })
    }
    const target = sections.get(targetId)!.rows
    const insert = target.findIndex(
        peer =>
            peer &&
            memberRowId(peer) &&
            compareMemberRows(row, peer as MemberRecord) < 0,
    )
    target.splice(insert < 0 ? target.length : insert, 0, row)
    const rows: unknown[] = []
    groups = groups.filter(
        g =>
            g.id !== originalId ||
            originalId === targetId ||
            g.count > 0 ||
            (sections.get(g.id)?.rows.length ?? 0) > 0,
    )
    const indexed = source.groups.some(g => typeof g.index === 'number')
    groups = groups.map(meta => {
        const section = sections.get(meta.id)!
        const index = rows.length
        const header = section.header
            ? {
                  ...section.header,
                  count: meta.count,
                  ...(indexed ? { index } : {}),
                  ...(section.header.group
                      ? {
                            group: {
                                ...section.header.group,
                                count: meta.count,
                            },
                        }
                      : {}),
              }
            : undefined
        rows.length += 1 + section.rows.length
        if (header) rows[index] = header
        section.rows.forEach((row, i) => {
            rows[index + 1 + i] = row
        })
        return {
            ...meta,
            ...(header && source.groups.some(g => g.type === 'GROUP')
                ? header
                : {}),
            ...(indexed ? { index } : {}),
        }
    })
    return {
        ...source,
        rows,
        groups,
        ...(typeof source.rowCount === 'number'
            ? { rowCount: source.rowCount + rows.length - source.rows.length }
            : {}),
        version:
            typeof source.version === 'number'
                ? source.version + 1
                : source.version,
    }
}
export interface MemberProjectionContext {
    guildId: string
    userId: string
    selection?: RoleSelection
    roles: readonly VisualRole[]
    member?: MemberRecord
    user?: MemberRecord
    status: string
    revision: number
}
export function bindMemberListStore(
    store: MemberRecord,
    context: (
        guildId?: string,
        channelId?: string,
    ) => MemberProjectionContext | undefined,
): () => void {
    if (typeof store.getProps !== 'function') return () => {}
    const originalProps = store.getProps,
        originalRows = store.getRows
    let reading = false,
        presentationVersion = 0
    const cache = new WeakMap<
        object,
        { key: string; groups: readonly MemberGroup[]; result: unknown }
    >()
    const versioned = new Map<
        string,
        { key: string; source: MemberListSnapshot; result: MemberListSnapshot }
    >()
    const props = function (this: unknown, ...args: unknown[]) {
        if (reading) return originalProps.apply(store, args)
        let source: MemberListSnapshot
        reading = true
        try {
            source = originalProps.apply(store, args)
        } finally {
            reading = false
        }
        if (
            !source ||
            !Array.isArray(source.rows) ||
            !Array.isArray(source.groups)
        )
            return source
        const ctx = context(
            args[0] as string | undefined,
            args[1] as string | undefined,
        )
        if (!ctx?.selection) return source
        const key = `${ctx.guildId}:${ctx.userId}:${ctx.revision}:${ctx.status}:${source.version ?? ''}`
        const listKey = `${ctx.guildId}:${ctx.userId}:${source.listId ?? args[1] ?? ''}`
        const known = versioned.get(listKey)
        if (
            typeof source.version === 'number' &&
            known?.key === key &&
            known.source.groups === source.groups &&
            known.source.rows.length === source.rows.length &&
            source.rows.every((row, i) => row === known.source.rows[i])
        )
            return known.result
        const hit = cache.get(source.rows)
        if (hit?.key === key && hit.groups === source.groups) return hit.result
        let result = projectMemberList(
            source,
            ctx.guildId,
            ctx.userId,
            ctx.selection,
            ctx.roles,
            ctx.member,
            ctx.user,
            ctx.status,
        )
        if (result !== source) {
            presentationVersion = Math.max(
                presentationVersion + 1,
                typeof source.version === 'number' ? source.version + 1 : 1,
            )
            result = { ...result, version: presentationVersion }
        }
        cache.set(source.rows, { key, groups: source.groups, result })
        if (typeof source.version === 'number') {
            versioned.set(listKey, { key, source, result })
            if (versioned.size > 32)
                versioned.delete(versioned.keys().next().value!)
        }
        return result
    }
    const rows = (...args: unknown[]) =>
        reading
            ? originalRows.apply(store, args)
            : (props(...args) as MemberListSnapshot)?.rows
    store.getProps = props
    if (typeof originalRows === 'function') store.getRows = rows
    return () => {
        if (store.getProps === props) store.getProps = originalProps
        if (store.getRows === rows) store.getRows = originalRows
        store.emitChange?.()
    }
}

export function bindSectionListStore(
    store: MemberRecord,
    context: (
        guildId?: string,
        channelId?: string,
    ) => MemberProjectionContext | undefined,
): () => void {
    const restores: (() => void)[] = []
    for (const key of ['getSections', 'getMemberListSections']) {
        const original = store[key]
        if (typeof original !== 'function') continue
        const cache = new WeakMap<object, { key: string; result: unknown }>()
        const wrapped = (...args: unknown[]) => {
            const sections = original.apply(store, args)
            const ctx = context(
                args[0] as string | undefined,
                args[1] as string | undefined,
            )
            if (!Array.isArray(sections) || !sections.length || !ctx?.selection)
                return sections
            const cacheKey = `${ctx.guildId}:${ctx.userId}:${ctx.revision}`
            const hit = cache.get(sections)
            if (hit?.key === cacheKey) return hit.result
            const field = Array.isArray(sections[0]?.data)
                ? 'data'
                : Array.isArray(sections[0]?.members)
                  ? 'members'
                  : undefined
            const id = (section: MemberRecord) =>
                section.id ?? section.sectionId ?? section.key
            if (
                !field ||
                sections.some(
                    s => typeof id(s) !== 'string' || !Array.isArray(s[field]),
                )
            )
                return sections
            const rows: unknown[] = [],
                groups: MemberGroup[] = []
            for (const section of sections) {
                const sid = id(section)
                rows.push(
                    {
                        type: 'GROUP',
                        id: sid,
                        count: section.count ?? section[field].length,
                    },
                    ...section[field],
                )
                groups.push({
                    id: sid,
                    count: section.count ?? section[field].length,
                })
            }
            const projected = projectMemberList(
                { rows, groups },
                ctx.guildId,
                ctx.userId,
                ctx.selection,
                ctx.roles,
                ctx.member,
                ctx.user,
                ctx.status,
            )
            if (projected.rows === rows) return sections
            const result: MemberRecord[] = []
            let current: MemberRecord | undefined
            for (const row of projected.rows as MemberRecord[]) {
                if (row.type === 'GROUP') {
                    const template =
                        sections.find(s => id(s) === row.id) ?? sections[0]
                    const role = ctx.roles.find(r => r.id === row.id)
                    current = {
                        ...template,
                        id: row.id,
                        ...(template.sectionId ? { sectionId: row.id } : {}),
                        ...(template.key ? { key: row.id } : {}),
                        count: row.count,
                        [field]: [],
                    }
                    if (current && role && typeof template.title === 'string')
                        current.title = role.name
                    result.push(current!)
                } else current?.[field].push(row)
            }
            cache.set(sections, { key: cacheKey, result })
            return result
        }
        store[key] = wrapped
        restores.push(() => {
            if (store[key] === wrapped) store[key] = original
        })
    }
    return () => {
        for (const restore of restores) restore()
        store.emitChange?.()
    }
}

export interface MemberAppearanceContext {
    guildId: string
    userId: string
    selection?: RoleSelection
    roles: readonly VisualRole[]
    revision: number
}
export function bindMemberAppearanceStore(
    store: MemberRecord,
    context: (
        guildId: string,
        userId?: string,
    ) => MemberAppearanceContext | undefined,
    revision: () => number,
): () => void {
    const restores: (() => void)[] = []
    const cache = new WeakMap<object, { key: string; result: MemberRecord }>()
    for (const name of ['getMember', 'getSelfMember', 'getCachedSelfMember']) {
        const original = store[name]
        if (typeof original !== 'function') continue
        const wrapped = function (this: unknown, ...args: unknown[]) {
            const member = original.apply(this, args)
            if (
                !member ||
                typeof member !== 'object' ||
                typeof args[0] !== 'string'
            )
                return member
            if (name === 'getMember' && typeof args[1] !== 'string')
                return member
            const ctx = context(
                args[0],
                name === 'getMember' ? (args[1] as string) : undefined,
            )
            if (!ctx?.selection) return member
            const key = `${ctx.guildId}:${ctx.userId}:${ctx.revision}`
            const hit = cache.get(member)
            if (hit?.key === key) return hit.result
            const visual = projectMember(
                member,
                ctx.selection,
                ctx.roles,
                ctx.guildId,
            )
            // Keep role membership and hierarchy authoritative. Only appearance is projected here.
            const result = {
                ...member,
                color: visual.color,
                colorString: visual.colorString,
                colorStrings: visual.colorStrings,
                colorRoleId: visual.colorRoleId,
                colorRoleName: visual.colorRoleName,
                iconRoleId: visual.iconRoleId,
            }
            cache.set(member, { key, result })
            return result
        }
        store[name] = wrapped
        restores.push(() => {
            if (store[name] === wrapped) store[name] = original
        })
    }
    const originalVersion = store.getMemberVersion
    if (typeof originalVersion === 'function') {
        let lastNative: unknown,
            lastRevision: number | undefined,
            stamp = 0
        const wrappedVersion = function (this: unknown, ...args: unknown[]) {
            const native = originalVersion.apply(this, args)
            if (typeof native !== 'number') return native
            const current = revision()
            if (native !== lastNative || current !== lastRevision) {
                stamp = Math.max(stamp + 1, native)
                lastNative = native
                lastRevision = current
            }
            return stamp
        }
        store.getMemberVersion = wrappedVersion
        restores.push(() => {
            if (store.getMemberVersion === wrappedVersion)
                store.getMemberVersion = originalVersion
        })
    }
    return () => {
        for (const restore of restores.reverse()) restore()
    }
}
