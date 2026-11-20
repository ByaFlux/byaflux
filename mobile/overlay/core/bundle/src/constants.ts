import { MobileVersionName } from './byaflux/version'

export const LicenseFallbackURL = 'https://www.gnu.org/licenses/gpl-3.0.txt'
export const BuildEnvironment = __DEV__ ? 'development' : 'production'
export const FullVersion = `${MobileVersionName} (${__BUILD_COMMIT__})`
