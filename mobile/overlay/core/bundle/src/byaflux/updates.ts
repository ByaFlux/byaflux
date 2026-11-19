import { Linking } from 'react-native'

export const MobileVersionCode = 20001
export const MobileChannel =
    'https://raw.githubusercontent.com/ByaFlux/byaflux/mobile-updates/android.json'
export type MobileUpdate = {
    versionName: string
    versionCode: number
    apkUrl: string
    apkSize: number
    sha256: string
    packageId: string
}
let update: MobileUpdate | undefined
let status = 'Verificar atualizações'
let checking: Promise<void> | undefined
let generation = 0
const listeners = new Set<() => void>()
function emit() {
    generation++
    for (const listener of listeners) listener()
}
export const updates = {
    subscribe(listener: () => void) {
        listeners.add(listener)
        return () => {
            listeners.delete(listener)
        }
    },
    snapshot: () => generation,
    current: () => update,
    status: () => status,
    check() {
        if (checking) return checking
        checking = (async () => {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 15000)
            try {
                status = 'Verificando atualizações…'
                emit()
                const response = await fetch(MobileChannel, {
                    signal: controller.signal,
                    cache: 'no-store',
                })
                if (!response.ok) throw Error('Canal indisponível')
                const data: unknown = await response.json()
                if (!validUpdate(data)) throw Error('Manifesto inválido')
                update = data.versionCode > MobileVersionCode ? data : undefined
                status = update
                    ? `ByaFlux ${update.versionName} disponível`
                    : 'ByaFlux atualizado'
            } catch {
                status =
                    'Não foi possível consultar atualizações. Tente novamente.'
            } finally {
                clearTimeout(timeout)
                emit()
            }
        })().finally(() => {
            checking = undefined
        })
        return checking
    },
    async open() {
        try {
            await Linking.openURL('byafluxmobile://update')
        } catch {
            await Linking.openURL(
                'https://github.com/ByaFlux/byaflux/releases?q=mobile-v&expanded=true',
            )
        }
    },
}
export function validUpdate(value: unknown): value is MobileUpdate {
    if (!value || typeof value !== 'object') return false
    const data = value as Record<string, unknown>
    return (
        data.packageId === 'app.byaflux.manager' &&
        typeof data.versionCode === 'number' &&
        Number.isSafeInteger(data.versionCode) &&
        data.versionCode > 0 &&
        typeof data.versionName === 'string' &&
        data.versionName.length < 80 &&
        typeof data.apkSize === 'number' &&
        data.apkSize > 0 &&
        data.apkSize <= 500000000 &&
        typeof data.sha256 === 'string' &&
        /^[a-f0-9]{64}$/.test(data.sha256) &&
        typeof data.apkUrl === 'string' &&
        data.apkUrl.startsWith(
            'https://github.com/ByaFlux/byaflux/releases/download/mobile-v',
        ) &&
        data.apkUrl.endsWith('.apk') &&
        !data.apkUrl.includes('?') &&
        !data.apkUrl.includes('#')
    )
}
