/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readdir, readFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";

import {
    generateTheme,
    parseTheme,
    SaveCtmRequest,
    SavedCtmTheme,
    validateChoices,
    validateName
} from "../../shared/themeMaker";

const revision = (css: string) => createHash("sha256").update(css).digest("hex");
const queues = new Map<string, Promise<unknown>>();
function safeFile(fileName: string) {
    if (typeof fileName !== "string" || !fileName.endsWith(".theme.css") || fileName.length > 150)
        throw new Error("Arquivo de tema inválido.");
    validateName(fileName.slice(0, -".theme.css".length));
    return fileName;
}
export async function listCtmThemes(directory: string): Promise<SavedCtmTheme[]> {
    await mkdir(directory, { recursive: true });
    const themes: SavedCtmTheme[] = [];
    for (const fileName of await readdir(directory)) {
        try {
            const path = join(directory, safeFile(fileName));
            const info = await lstat(path);
            if (!info.isFile() || info.isSymbolicLink() || info.size > 256000) continue;
            const css = await readFile(path, "utf8");
            const document = parseTheme(css);
            if (document) themes.push({ fileName, revision: revision(css), document });
        } catch {
            /* Unrelated themes remain outside the CTM editor. */
        }
    }
    return themes.sort((a, b) => a.document.name.localeCompare(b.document.name));
}
export function saveCtmTheme(directory: string, request: SaveCtmRequest): Promise<SavedCtmTheme> {
    const previous = queues.get(directory) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(() => writeTheme(directory, request));
    queues.set(directory, next);
    void next
        .finally(() => {
            if (queues.get(directory) === next) queues.delete(directory);
        })
        .catch(() => {});
    return next;
}
async function writeTheme(directory: string, request: SaveCtmRequest): Promise<SavedCtmTheme> {
    const name = validateName(request?.name);
    const choices = validateChoices(request.choices);
    await mkdir(directory, { recursive: true });
    if (request.editing) {
        const { fileName, id, revision: expected } = request.editing;
        const path = join(directory, safeFile(fileName));
        const info = await lstat(path);
        if (!info.isFile() || info.isSymbolicLink() || info.size > 256000)
            throw new Error("Este arquivo não pode ser editado pelo CTM.");
        const before = await readFile(path, "utf8");
        const old = parseTheme(before);
        if (!old || old.id !== id || revision(before) !== expected)
            throw new Error("O tema mudou desde que foi aberto. Reabra-o em Meus temas antes de salvar.");
        const document = { schema: 1 as const, id: old.id, name, choices };
        const css = generateTheme(document);
        const temporary = join(directory, `.byaflux-ctm-${randomUUID()}.tmp`);
        let handle: Awaited<ReturnType<typeof open>> | undefined;
        try {
            handle = await open(temporary, "wx", 0o600);
            await handle.writeFile(css, "utf8");
            await handle.sync();
            await handle.close();
            handle = undefined;
            if (revision(await readFile(path, "utf8")) !== expected)
                throw new Error("O arquivo foi alterado durante a gravação. Reabra o tema.");
            await rename(temporary, path);
        } finally {
            await handle?.close().catch(() => {});
            await unlink(temporary).catch(() => {});
        }
        return { fileName, revision: revision(css), document };
    }
    const existing = new Set((await readdir(directory)).map(name => name.toLowerCase()));
    for (let suffix = 1; suffix <= 10000; suffix++) {
        let prefix = name;
        while (prefix.length > 55) prefix = Array.from(prefix).slice(0, -1).join("");
        const displayName = suffix === 1 ? name : `${prefix} (${suffix})`;
        const fileName = `${displayName}.theme.css`;
        if (existing.has(fileName.toLowerCase())) continue;
        const path = join(directory, fileName);
        const document = { schema: 1 as const, id: randomUUID(), name: displayName, choices };
        const css = generateTheme(document);
        let handle: Awaited<ReturnType<typeof open>>;
        try {
            handle = await open(path, "wx", 0o600);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "EEXIST") continue;
            throw error;
        }
        try {
            await handle.writeFile(css, "utf8");
            await handle.sync();
            await handle.close();
        } catch (error) {
            await handle.close().catch(() => {});
            await unlink(path).catch(() => {});
            throw error;
        }
        return { fileName, revision: revision(css), document };
    }
    throw new Error("Não foi possível escolher um nome livre para o tema.");
}
