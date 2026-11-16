/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { fetchBuffer, fetchJson } from "@main/utils/http";
import { VENCORD_USER_AGENT } from "@shared/vencordUserAgent";
import { createHash } from "crypto";
import { writeFileSync } from "original-fs";

import gitHash from "~git-hash";
import gitRemote from "~git-remote";

import { Updater } from ".";
import { ASAR_FILE } from "./common";
import { ByaFluxRelease, selectRelease } from "./byafluxRelease";

const API_BASE = `https://api.github.com/repos/${gitRemote}`;
let PendingUpdate: ReturnType<typeof selectRelease> = null;

async function githubGet<T = any>(endpoint: string) {
    return fetchJson<T>(API_BASE + endpoint, {
        headers: {
            Accept: "application/vnd.github+json",
            // "All API requests MUST include a valid User-Agent header.
            // Requests with no User-Agent header will be rejected."
            "User-Agent": VENCORD_USER_AGENT
        }
    });
}

async function listUpdates() {
    if (!await fetchUpdate() || !PendingUpdate) return [];
    return [{ hash: PendingUpdate.hash, author: "ByaFlux", message: "Nova versão do ByaFlux disponível" }];
}

async function fetchUpdate() {
    PendingUpdate = null;
    if (gitRemote.startsWith("unconfigured/")) throw new Error("Configure o repositório do ByaFlux antes de publicar.");
    const data = await githubGet<ByaFluxRelease>("/releases/latest");
    PendingUpdate = selectRelease(data, gitHash, gitRemote, ASAR_FILE);
    return PendingUpdate !== null;
}

async function applyUpdate() {
    if (!PendingUpdate) return false;
    const { asset } = PendingUpdate;
    const data = await fetchBuffer(asset.browser_download_url);
    if (data.length !== asset.size) throw new Error("O download da atualização está incompleto.");
    if (asset.digest?.startsWith("sha256:")) {
        const digest = "sha256:" + createHash("sha256").update(data).digest("hex");
        if (digest !== asset.digest) throw new Error("A verificação SHA-256 da atualização falhou.");
    }
    writeFileSync(__dirname, data, { flush: true });
    PendingUpdate = null;
    return true;
}

const HttpUpdater: Updater = {
    getRepo: async () => `https://github.com/${gitRemote}`,
    listUpdates,
    fetchUpdate,
    applyUpdate
};

export default HttpUpdater;
