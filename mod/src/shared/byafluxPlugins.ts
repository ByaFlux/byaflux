// Built-in ByaFlux plugins have their own source directory, like Equicord plugins.
export function isByaFluxPlugin(folderName?: string): boolean {
    return folderName?.startsWith("src/byafluxplugins/") ?? false;
}
