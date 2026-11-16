/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
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

import "./checkNodeVersion.js";

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE_DIR = join(BASE_DIR, "dist", "Installer");
// This is only the developer injection tool: all patched code comes from dist/desktop.
// Distributed ByaFlux installers and standalone updates keep using the owner's release.
const BASE_URL = "https://github.com/Equicord/Equilotl/releases/latest/download/";

function getFilename() {
    const files = {
        win32: { x64: "EquilotlCli.exe", arm64: "EquilotlCli-arm64.exe" },
        linux: { x64: "EquilotlCli-linux", arm64: "EquilotlCli-linux-arm64" },
        darwin: { x64: "EquilotlCli-x64", arm64: "EquilotlCli-arm64" }
    };
    const filename = files[process.platform]?.[process.arch];
    if (!filename) throw new Error(`Plataforma não suportada: ${process.platform}/${process.arch}`);
    return filename;
}

async function ensureBinary() {
    if (process.env.BYAFLUX_INSTALLER_PATH) {
        const binary = resolve(process.env.BYAFLUX_INSTALLER_PATH);
        if (!existsSync(binary)) throw new Error(`Instalador CLI não encontrado: ${binary}`);
        return binary;
    }
    const filename = getFilename();
    mkdirSync(FILE_DIR, { recursive: true });
    const output = join(FILE_DIR, filename);
    const etagPath = output + ".etag";
    const checksumPath = output + ".sha256";
    const checksum = data => createHash("sha256").update(data).digest("hex");
    const validCache = existsSync(output) && existsSync(checksumPath)
        && checksum(readFileSync(output)) === readFileSync(checksumPath, "utf8");
    const etag = validCache && existsSync(etagPath) ? readFileSync(etagPath, "utf8") : null;
    const headers = { "User-Agent": "ByaFlux-Dev" };
    if (etag) headers["If-None-Match"] = etag;
    console.log("Preparando instalador CLI para a compilação local...");
    const response = await fetch(BASE_URL + filename, { headers });
    if (response.status === 304 && validCache) return output;
    if (!response.ok) throw new Error(`Falha ao baixar o instalador CLI: ${response.status} ${response.statusText}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) throw new Error("O instalador CLI baixado está vazio.");
    const temporary = output + ".tmp";
    writeFileSync(temporary, bytes, { mode: 0o755 });
    renameSync(temporary, output);
    chmodSync(output, 0o755);
    writeFileSync(checksumPath, checksum(bytes));
    const newEtag = response.headers.get("etag");
    if (newEtag) writeFileSync(etagPath, newEtag);
    else rmSync(etagPath, { force: true });
    return output;
}

const argStart = process.argv.indexOf("--");
const args = argStart === -1 ? [] : process.argv.slice(argStart + 1).filter(arg => arg !== "--");
const desktop = join(BASE_DIR, "dist", "desktop");
const helpOnly = args.includes("--help") || args.includes("--version");

try {
    if (!helpOnly && !args.includes("--uninstall") && !existsSync(join(desktop, "patcher.js"))) {
        throw new Error("Compile primeiro: pnpm build");
    }
    const binary = await ensureBinary();
    execFileSync(binary, args, {
        stdio: "inherit",
        env: {
            ...process.env,
            EQUICORD_USER_DATA_DIR: BASE_DIR,
            EQUICORD_DIRECTORY: desktop,
            EQUICORD_DEV_INSTALL: "1"
        }
    });
} catch (error) {
    console.error(error.message);
    process.exitCode = Number.isInteger(error.status) && error.status > 0 ? error.status : 1;
}
