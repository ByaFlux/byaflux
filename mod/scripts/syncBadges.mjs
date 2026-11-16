import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { isHttpsUrl } from '../src/byafluxplugins/byaBadges/catalog.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
export function syncBadgeFiles() {
    const brand = JSON.parse(readFileSync(join(root, 'brand.json'), 'utf8'));
    const source = brand.badgesUrl ?? null;
    if (source && !isHttpsUrl(source)) throw new Error('badgesUrl precisa ser uma URL HTTPS pública.');
    const contents = '// Generated from brand.json. Do not edit.\n'
        + 'export const BADGES_URL: string | null = ' + JSON.stringify(source || null) + ';\n';
    const path = join(root, 'mod/src/byafluxplugins/byaBadges/generated.ts');
    if (!existsSync(path) || readFileSync(path, 'utf8') !== contents) writeFileSync(path, contents);
    return { source };
}
