export const DEFAULT_BANNER_FORMAT = "{byafluxIcon} ByaFlux {byafluxVersion}";
const LEGACY_BANNER_FORMAT = "{equicordIcon} Equicord {equicordVersion} ({equicordHash})";

export function normalizeBannerFormat(format?: string) {
    return !format || format === LEGACY_BANNER_FORMAT ? DEFAULT_BANNER_FORMAT : format;
}
