import { LinuxReleasePrefix } from "@shared/linuxBrand";
// ByaFlux release selection. Keep updater and installer on the same release.
export interface ByaFluxRelease {
    name: string;
    tag_name?: string;
    draft: boolean;
    prerelease: boolean;
    assets: { name: string; tag_name?: string; browser_download_url: string; size: number; digest?: string | null }[];
}

export function selectRelease(
    release: ByaFluxRelease,
    installedHash: string,
    repository: string,
    assetName: string,
    allowPrerelease = false
) {
    if (release.draft || (release.prerelease && !allowPrerelease)) return null;
    const hash = / ([a-f0-9]{40})$/.exec(release.name)?.[1];
    if (!hash) throw new Error("Release ByaFlux inválida: o título deve terminar com o hash completo do commit.");
    if (hash === installedHash) return null;
    const asset = release.assets.find(a => a.name === assetName);
    if (!asset || asset.size <= 0) throw new Error(`Release incompleta: ${assetName} ausente ou vazio.`);
    const url = new URL(asset.browser_download_url);
    if (url.origin !== "https://github.com" || !url.pathname.startsWith(`/${repository}/releases/download/`)) {
        throw new Error("O arquivo de atualização não pertence ao repositório do ByaFlux.");
    }
    return { hash, asset };
}

export function selectLinuxRelease(releases: ByaFluxRelease[]): ByaFluxRelease | undefined {
    return releases.find(
        release =>
            !release.draft &&
            release.prerelease &&
            release.tag_name?.startsWith(LinuxReleasePrefix) &&
            release.assets.some(asset => asset.name === "desktop.asar" && asset.size > 0)
    );
}
