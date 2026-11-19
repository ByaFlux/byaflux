import { registerInternalPlugin } from '@valenced/plugins/_'
import { useSyncExternalStore } from 'react'
import { Alert, AppState } from 'react-native'
import { Action, notify, Panel } from '~/byaflux/mobile'
import { updates } from '~/byaflux/updates'
import manifest from './manifest.json'

registerInternalPlugin(manifest, {
    start({ cleanup }) {
        let active = true
        let announced = 0
        async function check() {
            await updates.check()
            const update = updates.current()
            if (
                active &&
                update &&
                AppState.currentState !== 'background' &&
                update.versionCode !== announced
            ) {
                announced = update.versionCode
                Alert.alert(
                    'Atualização do ByaFlux',
                    `A versão ${update.versionName} está disponível.`,
                    [
                        { text: 'Agora não', style: 'cancel' },
                        {
                            text: 'Atualizar',
                            onPress: () => {
                                void updates
                                    .open()
                                    .catch(error => notify(String(error), true))
                            },
                        },
                    ],
                )
            }
        }
        void check()
        const timer = setInterval(
            () => {
                void check()
            },
            5 * 60 * 1000,
        )
        let last = Date.now()
        const listener = AppState.addEventListener('change', state => {
            if (state === 'active' && Date.now() - last > 5 * 60 * 1000) {
                last = Date.now()
                void check()
            }
        })
        cleanup(() => {
            active = false
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
