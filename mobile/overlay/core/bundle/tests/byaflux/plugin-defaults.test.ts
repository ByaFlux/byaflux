import { describe, expect, it, vi } from 'vitest'
import { isEnabledByDefault } from '../../lib/plugins/src/_internal/manifest'
import { getInternalPluginManifests } from '../../scripts/manifest'

describe('ByaFlux plugin defaults', () => {
    it('enables required plugins', () =>
        expect(
            isEnabledByDefault({
                id: 'required',
                essential: true,
                enabledByDefault: false,
            }),
        ).toBe(true))
    it('does not enable optional plugins even when an upstream manifest asks for it', () => {
        for (const enabledByDefault of [undefined, false, true, 'dev'] as const)
            expect(
                isEnabledByDefault({ id: 'optional', enabledByDefault }),
            ).toBe(false)
    })
    it('ships the same required-only defaults to native Android', async () => {
        vi.stubEnv(
            'VALENCED_DEFAULT_PLUGIN_REPOSITORY_URL',
            'https://example.com/plugins',
        )
        const plugins = await getInternalPluginManifests()
        vi.unstubAllEnvs()
        expect(plugins.length).toBeGreaterThan(0)
        for (const plugin of plugins)
            expect(plugin.enabledByDefault === true).toBe(
                plugin.essential === true,
            )
    })
})
