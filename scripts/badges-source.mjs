import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isHttpsUrl } from '../mod/src/byafluxplugins/byaBadges/catalog.ts';

const path = fileURLToPath(new URL('../brand.json', import.meta.url));
const [source, ...extra] = process.argv.slice(2);
if (!source || extra.length || !isHttpsUrl(source)) {
    console.error('Use: pnpm badges:source https://raw.githubusercontent.com/USUARIO/REPOSITORIO/main/badges.json');
    process.exitCode = 1;
} else {
    const brand = JSON.parse(readFileSync(path, 'utf8'));
    brand.badgesUrl = source;
    writeFileSync(path, JSON.stringify(brand, null, 2) + '\n');
    console.log('Fonte atualizada. Execute pnpm build para aplicar.');
}
