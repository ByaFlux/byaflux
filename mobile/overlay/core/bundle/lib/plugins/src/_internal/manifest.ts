import { formatPluginContributor } from '../utils'
import type { PluginManifest, PluginVersion } from '../types'
import type { InternalPluginManifest } from './types'

/** Manifest schema version internal plugins are written against. */
// TODO: This has to be shared from native somehow
export const ManifestFormat = 1

export const ApiDependencyId = 'valenced.api'
export const DiscordDependencyId = 'discord'

/** IDs any plugin may depend on without another plugin declaring them. */
export const ReservedDependencyIds: ReadonlySet<string> = new Set([
    ApiDependencyId,
    DiscordDependencyId,
])

export function isReservedDependency(id: string) {
    return ReservedDependencyIds.has(id)
}

export function parseBundleVersion(version: string): PluginVersion {
    const [segments, label] = version.split('-')
    const nums = segments!.split('.').map(Number)
    return label ? { nums, label } : { nums }
}

export function isEnabledByDefault(manifest: InternalPluginManifest): boolean {
    return manifest.essential === true
}

export function completeInternalManifest(
    manifest: InternalPluginManifest,
    version: PluginVersion,
): PluginManifest {
    manifest.version =
        typeof manifest.version === 'string'
            ? parseBundleVersion(manifest.version)
            : (manifest.version ?? version)
    manifest.format ??= ManifestFormat
    manifest.author = formatPluginContributor(manifest.author)
    manifest.contributors = manifest.contributors?.map(formatPluginContributor)

    if (!isReservedDependency(manifest.id)) {
        manifest.dependencies ??= {}
        manifest.dependencies[ApiDependencyId] ??= { version: '*' }
        manifest.dependencies[DiscordDependencyId] ??= { version: '*' }
    }

    // Drop the extra props
    const { essential, enabledByDefault, api, build, ...rest } = manifest
    return rest as PluginManifest
}
