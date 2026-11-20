/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface RoleSelection {
    added: string[];
    hidden: string[];
}
export interface VisualRole {
    id: string;
    name: string;
    position?: number;
    color?: number;
    colorString?: string;
    managed?: boolean;
}
export const emptyRoles = (): RoleSelection => ({ added: [], hidden: [] });
const ids = (value: unknown): string[] =>
    Array.isArray(value)
        ? [...new Set(value.filter((id): id is string => typeof id === "string" && /^\d{17,20}$/.test(id)))].slice(
              0,
              5000
          )
        : [];
export function readSelection(value: unknown): RoleSelection {
    const v = value && typeof value === "object" ? (value as Partial<RoleSelection>) : {};
    return { added: ids(v.added), hidden: ids(v.hidden) };
}
export function roleKey(userId: string, guildId: string): string {
    return `${userId}:${guildId}`;
}
export function orderedRoles<T extends VisualRole>(roles: readonly T[], guildId: string): T[] {
    return roles
        .filter(role => role.id !== guildId)
        .slice()
        .sort((a, b) => (b.position ?? 0) - (a.position ?? 0) || a.id.localeCompare(b.id));
}
export function visibleRoles(
    real: readonly string[],
    selection: RoleSelection | undefined,
    available: readonly string[]
): string[] {
    if (!selection) return [...real];
    const allowed = new Set(available),
        hidden = new Set(selection.hidden);
    return [...new Set([...real.filter(id => !hidden.has(id)), ...selection.added])].filter(id => allowed.has(id));
}
export function toggleRole(
    real: readonly string[],
    current: RoleSelection,
    roleId: string,
    checked: boolean
): RoleSelection {
    const added = new Set(current.added),
        hidden = new Set(current.hidden);
    added.delete(roleId);
    hidden.delete(roleId);
    if (checked && !real.includes(roleId)) added.add(roleId);
    if (!checked && real.includes(roleId)) hidden.add(roleId);
    return { added: [...added], hidden: [...hidden] };
}
export function roleColour(role: VisualRole): string {
    return role.colorString && /^#[a-f\d]{6}$/i.test(role.colorString)
        ? role.colorString
        : role.color
          ? `#${(role.color & 0xffffff).toString(16).padStart(6, "0")}`
          : "#99aab5";
}
