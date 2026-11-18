/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface CustomAccount {
    id: string;
    username: string;
    avatarUrl: string;
}

export function customAccount(username: string, photo: string, now = Date.now(), random = crypto.getRandomValues(new Uint32Array(1))[0]): CustomAccount {
    const name = username.trim();
    if (!name || name.length > 32) throw new Error("Digite um username de 1 a 32 caracteres.");
    let url: URL;
    try { url = new URL(photo.trim()); }
    catch { throw new Error("Digite uma URL válida para a foto."); }
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Use uma URL HTTPS para a foto.");
    const id = (((BigInt(now) - 1420070400000n) << 22n) | BigInt(random & 0x3fffff)).toString();
    return { id, username: name, avatarUrl: url.href };
}

export function isCustomAccount(value: unknown): value is CustomAccount {
    if (!value || typeof value !== "object") return false;
    const p = value as Record<string, unknown>;
    if (typeof p.id !== "string" || !/^\d{17,20}$/.test(p.id) || typeof p.username !== "string" || typeof p.avatarUrl !== "string") return false;
    try { customAccount(p.username, p.avatarUrl, 1700000000000, 0); return true; }
    catch { return false; }
}
