import { registerInternalPlugin } from '@valenced/plugins/_'
import { useSyncExternalStore } from 'react'
import { Alert, AppState } from 'react-native'
import { Action, notify, Panel } from '~/byaflux/mobile'
import { connectUpdateNotice } from '~/byaflux/update-notice'
import { updates } from '~/byaflux/updates'
import manifest from './manifest.json'

registerInternalPlugin(manifest, {
    start({ cleanup }) {
        const notice = connectUpdateNotice({
            current: updates.current,
            subscribe: updates.subscribe,
            isActive: () => AppState.currentState === 'active',
            open: updates.open,
            onError: error => notify(String(error), true),
            show: (version, update) =>
                Alert.alert(
                    'Atualização do ByaFlux',
                    `A versão ${version} está disponível.`,
                    [
                        { text: 'Agora não', style: 'cancel' },
                        { text: 'Atualizar', onPress: update },
                    ],
                ),
        })
        let last = Date.now()
        async function check() {
            last = Date.now()
            await updates.check()
        }
        void check()
        const timer = setInterval(
            () => {
                void check()
            },
            5 * 60 * 1000,
        )
        const listener = AppState.addEventListener('change', state => {
            if (state === 'active') {
                notice.present()
                if (Date.now() - last > 5 * 60 * 1000) void check()
            }
        })
        cleanup(() => {
            notice.dispose()
            clearInterval(timer)
            listener.remove()
        })
    },
    SettingsComponent() {
        useSyncExternalStore(updates.subscribe, updates.snapshot)
        return (
            <Panel title="Atualizações do ByaFlux">
                <Action label={updates.status()} run={updates.check} />
                <Action
                    label={
                        updates.current()
                            ? 'Atualizar ByaFlux'
                            : 'Abrir instalador'
                    }
                    detail="O Android pede confirmação para instalar. Depois, reinstale o ByaFlux pelo instalador."
                    run={updates.open}
                />
            </Panel>
        )
    },
})
