import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const brand = JSON.parse(readFileSync(resolve(root, 'brand.json'), 'utf8'));
const repoIndex = process.argv.indexOf('--repo');
const repository = repoIndex >= 0 ? process.argv[repoIndex + 1] : process.env.GITHUB_REPOSITORY || brand.repository;
if (!repository || !/^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9_.-]+$/.test(repository) || repository.startsWith('unconfigured/')) {
    throw new Error('Informe seu repositório: node scripts/configure.mjs --repo USUARIO/ByaFlux');
}
if (['equicord/equicord', 'equicord/equilotl', 'vendicated/vencord'].includes(repository.toLowerCase())) {
    throw new Error('Use seu próprio repositório, não o upstream.');
}
brand.repository = repository;
writeFileSync(resolve(root, 'brand.json'), JSON.stringify(brand, null, 2) + '\n');
writeFileSync(resolve(root, 'installer/byaflux_config.go'), `package main\n\nconst ByaFluxRepository = ${JSON.stringify(repository)}\n`);
console.log(`ByaFlux configurado: https://github.com/${repository}`);
