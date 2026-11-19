import { describe, expect, it, vi } from 'vitest'

vi.mock('react-native', () => ({ Linking: {} }))

import { validUpdate } from '../../src/byaflux/updates'

const valid = {
    versionName: '0.2.0-preview.2',
    versionCode: 20002,
    packageId: 'app.byaflux.manager',
    apkSize: 100,
    sha256: 'a'.repeat(64),
    apkUrl: 'https://github.com/ByaFlux/byaflux/releases/download/mobile-v0.2.0-preview.2/ByaFluxMobile.apk',
}
describe('Mobile update channel', () => {
    it('accepts a ByaFlux mobile release', () =>
        expect(validUpdate(valid)).toBe(true))
    it('rejects third party APKs, desktop assets and invalid integrity metadata', () => {
        for (const patch of [
            { apkUrl: 'https://example.com/app.apk' },
            {
                apkUrl: 'https://github.com/ByaFlux/byaflux/releases/download/v0.1.4/app.apk',
            },
            { apkUrl: `${valid.apkUrl}?redirect=other` },
            { packageId: 'com.discord' },
            { versionCode: 1.5 },
            { apkSize: 0 },
            { sha256: 'invalid' },
        ])
            expect(validUpdate({ ...valid, ...patch })).toBe(false)
    })
})
