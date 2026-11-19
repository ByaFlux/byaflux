import { Design } from '@valenced/discord/design'
import { instead } from '@valenced/patcher'
import { registerInternalPlugin } from '@valenced/plugins/_'
import {
    Action,
    connectRuntime,
    notify,
    observeRuntime,
    Panel,
    runtime,
    store,
    voiceChannel,
} from '~/byaflux/mobile'
import manifest from './manifest.json'
import type { Engine } from '~/byaflux/mobile'

let changeMode:
    | ((mode: 'mute' | 'deafen', enabled: boolean) => Promise<void>)
    | undefined
registerInternalPlugin<{
    jsonStorage: { fakeMute: boolean; fakeDeafen: boolean }
}>(manifest, {
    jsonStorage: {
        load: true,
        default: { fakeMute: false, fakeDeafen: false },
    },
    start({ cleanup, jsonStorage }) {
        connectRuntime(cleanup)
        let mute = false
        let deaf = false
        let patched: Engine | undefined
        let remove: (() => unknown)[] = []
        const actual = (mode: 'mute' | 'deafen') => {
            const media = store<{
                isSelfMute(): boolean
                isSelfDeaf(): boolean
            }>('MediaEngineStore')
            return (
                (mode === 'mute' ? media?.isSelfMute() : media?.isSelfDeaf()) ??
                false
            )
        }
        function attach() {
            const engine = runtime.engine
            if (
                engine === patched ||
                !engine?.setSelfMute ||
                !engine.setSelfDeafen
            )
                return
            for (const undo of remove) undo()
            remove = []
            patched = engine
            const target = engine as Engine & {
                setSelfMute(value: boolean): unknown
                setSelfDeafen(value: boolean): unknown
            }
            remove.push(
                instead(target, 'setSelfMute', function (args, original) {
                    return original.call(this, mute ? false : args[0])
                }),
                instead(target, 'setSelfDeafen', function (args, original) {
                    return original.call(this, deaf ? false : args[0])
                }),
            )
        }
        void jsonStorage.set({ fakeMute: false, fakeDeafen: false })
        changeMode = async (mode, enabled) => {
            if (!voiceChannel())
                throw Error('Entre em uma chamada antes de ativar.')
            attach()
            if (!patched)
                throw Error(
                    'Os controles nativos de áudio não foram encontrados nesta versão. Abra as configurações da chamada.',
                )
            const before = actual(mode)
            const toggle =
                mode === 'mute'
                    ? runtime.voice?.toggleSelfMute
                    : (runtime.voice?.toggleSelfDeaf ??
                      runtime.voice?.toggleSelfDeafen)
            if (enabled && !before && !toggle)
                throw Error(
                    'A ação de mute/deafen do Discord ainda não foi encontrada.',
                )
            if (mode === 'mute') mute = enabled
            else deaf = enabled
            if (enabled && !before) toggle?.call(runtime.voice)
            if (mode === 'mute')
                patched.setSelfMute?.(enabled ? false : actual(mode))
            else patched.setSelfDeafen?.(enabled ? false : actual(mode))
            await jsonStorage.set(
                mode === 'mute'
                    ? { fakeMute: enabled }
                    : { fakeDeafen: enabled },
            )
        }
        attach()
        cleanup(observeRuntime(attach), () => {
            mute = false
            deaf = false
            for (const undo of remove) undo()
            patched?.setSelfMute?.(actual('mute'))
            patched?.setSelfDeafen?.(actual('deafen'))
            changeMode = undefined
            void jsonStorage.set({ fakeMute: false, fakeDeafen: false })
        })
    },
    SettingsComponent({ api: { jsonStorage } }) {
        const s = jsonStorage.use() ?? { fakeMute: false, fakeDeafen: false }
        function set(mode: 'mute' | 'deafen', value: boolean) {
            void changeMode?.(mode, value).catch(e => notify(String(e), true))
        }
        return (
            <Panel title="FakeDeafen">
                <Action
                    label="Modo fake"
                    detail="O áudio e o microfone continuam ativos mesmo quando o Discord mostra mute/deafen. Os modos são desligados ao reiniciar o aplicativo."
                />
                <Design.TableSwitchRow
                    label="Fake Mute"
                    value={s.fakeMute}
                    onValueChange={v => set('mute', v)}
                />
                <Design.TableSwitchRow
                    label="Fake Deafen"
                    value={s.fakeDeafen}
                    onValueChange={v => set('deafen', v)}
                />
            </Panel>
        )
    },
})
