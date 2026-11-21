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
export function roleColour(role: VisualRole): string {
    return role.colorString && /^#[a-f\d]{6}$/i.test(role.colorString)
        ? role.colorString
        : role.color
          ? `#${(role.color & 0xffffff).toString(16).padStart(6, '0')}`
          : '#99aab5'
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
): T {
    if (!selection) return member
    const selected = sortedVisibleRoles(
        member.roles ?? [],
        selection,
        roles,
        guildId,
    )
    const colour = selected.find(r => r.color || r.colorString),
        hoist = selected.find(r => r.hoist)
    return {
        ...member,
        roles: selected.map(r => r.id),
        colorString: colour ? roleColour(colour) : undefined,
        color: colour?.color ?? 0,
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
    let group: string | undefined,
        originalId: string | undefined,
        originalRow: MemberRecord | undefined
    for (const row of source.rows) {
        const id = groupRowId(row)
        if (id) {
            group = id
            if (!sections.has(id))
                sections.set(id, { header: row as MemberRecord, rows: [] })
            continue
        }
        if (!group) return source
        const section = sections.get(group)!
        if (memberRowId(row) === userId) {
            originalId = group
            originalRow ??= row as MemberRecord
        } else section.rows.push(row)
    }
    if (!source.rows.length || !sections.size) return source
    const nativeHoist = ordered.find(
        r => r.hoist && (member.roles ?? []).includes(r.id),
    )
    originalId ??= offline ? 'offline' : (nativeHoist?.id ?? 'online')
    const visual = projectMember(member, selection, ordered, guildId)
    const template =
        originalRow ??
        (source.rows.find(row => !!memberRowId(row)) as
            | MemberRecord
            | undefined)
    if (!template) return source
    const row: MemberRecord = {
        ...template,
        id: userId,
        userId,
        user,
        nick: member.nick ?? null,
        roles: visual.roles,
        color: visual.color,
        colorString: visual.colorString,
        hoistRole: visual.hoistRole,
        hoistedRole: visual.hoistRole,
        status,
        activities: originalRow?.activities ?? [],
    }
    if (template.member) row.member = { ...member, ...visual, userId, user }
    if (!originalRow) {
        row.comparator = undefined
        row.sortKey = undefined
    }
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
    const priority = (id: string) =>
        id === 'offline'
            ? ordered.length + 2
            : id === 'online'
              ? ordered.length + 1
              : ordered.findIndex(r => r.id === id)
    groups.sort((a, b) => priority(a.id) - priority(b.id))
    if (!sections.has(targetId)) {
        const header = [...sections.values()].find(s => s.header)?.header
        if (!header) return source
        const meta = groups.find(g => g.id === targetId)!
        sections.set(targetId, {
            header: {
                ...header,
                id: targetId,
                count: meta.count,
                name: hoist?.name ?? targetId,
                ...(header.group
                    ? {
                          group: {
                              ...header.group,
                              id: targetId,
                              count: meta.count,
                          },
                      }
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
        g => g.count > 0 || (sections.get(g.id)?.rows.length ?? 0) > 0,
    )
    for (const meta of groups) {
        const section = sections.get(meta.id)
        if (!section) continue
        if (section.header)
            rows.push({
                ...section.header,
                count: meta.count,
                ...(section.header.group
                    ? { group: { ...section.header.group, count: meta.count } }
                    : {}),
            })
        rows.push(...section.rows)
    }
    return {
        ...source,
        rows,
        groups,
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
    let reading = false
    const cache = new WeakMap<object, { key: string; result: unknown }>()
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
        const key = `${ctx.guildId}:${ctx.userId}:${ctx.revision}:${source.version ?? ''}`
        const hit = cache.get(source.rows)
        if (hit?.key === key) return hit.result
        const result = projectMemberList(
            source,
            ctx.guildId,
            ctx.userId,
            ctx.selection,
            ctx.roles,
            ctx.member,
            ctx.user,
            ctx.status,
        )
        cache.set(source.rows, { key, result })
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
        const cache = new WeakMap<
            object,
            { revision: number; result: unknown }
        >()
        const wrapped = (...args: unknown[]) => {
            const sections = original.apply(store, args)
            const ctx = context(
                args[0] as string | undefined,
                args[1] as string | undefined,
            )
            if (!Array.isArray(sections) || !sections.length || !ctx?.selection)
                return sections
            const hit = cache.get(sections)
            if (hit?.revision === ctx.revision) return hit.result
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
            cache.set(sections, { revision: ctx.revision, result })
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
