import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { syncBadgeFiles } from '../mod/scripts/syncBadges.mjs';
import { packageManagerCommand } from './package-manager.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const mod = join(root, 'mod');
const [command, ...args] = process.argv.slice(2);

function run(executable, argv, options = {}) {
    const result = spawnSync(executable, argv, { cwd: mod, stdio: 'inherit', ...options });
    if (result.error) {
        console.error(result.error.message);
        process.exit(1);
    }
    process.exit(result.status ?? 1);
}

// ZIP checkouts have no Git history. A content hash also identifies local changes.
export function sourceHash() {
    const hash = createHash('sha1');
    function add(directory) {
        for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const path = join(directory, entry.name);
            if (entry.isDirectory()) add(path);
            else if (entry.isFile()) hash.update(path.slice(root.length)).update(readFileSync(path));
        }
    }
    add(join(mod, 'src'));
    add(join(mod, 'scripts'));
    hash.update(readFileSync(join(root, 'brand.json')));
    return hash.digest('hex');
}

switch (command) {
    case 'install': {
        const manager = process.env.npm_execpath;
        if (!manager || !existsSync(manager)) throw new Error('Execute pnpm install na raiz do projeto.');
        const { executable, args } = packageManagerCommand(manager);
        run(executable, [...args, 'install', '--frozen-lockfile']);
        break;
    }
    case 'build': {
        syncBadgeFiles();
        const env = { ...process.env, EQUICORD_HASH: sourceHash() };
        // Local builds use local source. Published standalone builds retain their own updater.
        run(process.execPath, ['--require=./scripts/suppressExperimentalWarnings.js', 'scripts/build/build.mjs', '--disable-updater', ...args], { env });
        break;
    }
    case 'typecheck':
        run(process.execPath, [resolve(mod, 'node_modules/typescript/bin/tsc'), '--noEmit']);
        break;
    default:
        throw new Error(`Comando desconhecido: ${command}`);
}
