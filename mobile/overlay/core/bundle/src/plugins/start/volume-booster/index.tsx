import { registerInternalPlugin } from '@valenced/plugins/_'
import { useState } from 'react'
import { validUserId } from '~/byaflux/catalog'
import {
    Action,
    connectRuntime,
    Field,
    Panel,
    runtime,
    voiceChannel,
} from '~/byaflux/mobile'
import manifest from './manifest.json'

registerInternalPlugin(manifest, {
    start({ cleanup }) {
        connectRuntime(cleanup)
    },
    SettingsComponent() {
        const [id, setId] = useState('')
        const [volume, setVolume] = useState('200')
        const [status, setStatus] = useState(
            'Entre em um canal de voz antes de aplicar.',
        )
        function apply(percent = Number(volume)) {
            if (!validUserId(id))
                throw new Error('Informe o ID do usuário da chamada.')
            if (!voiceChannel())
                throw new Error('Você não está em um canal de voz.')
            if (!Number.isFinite(percent) || percent < 0 || percent > 1000)
                throw new Error('Use um volume de 0 a 1000%.')
            if (!runtime.engine?.setLocalVolume)
                throw new Error(
                    'A API de volume ainda não foi encontrada. Abra os controles de áudio da chamada e tente novamente.',
                )
            runtime.engine.setLocalVolume(id, percent)
            setVolume(String(percent))
            const read = runtime.engine.getLocalVolume?.(id)
            setStatus(
                read === undefined
                    ? `Volume solicitado: ${percent}%. O limite efetivo depende do motor de áudio do Android.`
                    : `Volume informado pelo motor: ${read}%.`,
            )
        }
        return (
            <Panel title="VolumeBooster">
                <Action label={status} />
                <Field
                    label="ID do usuário"
                    value={id}
                    onChange={setId}
                    numeric
                />
                <Field
                    label="Volume em porcentagem"
                    value={volume}
                    onChange={setVolume}
                    numeric
                />
                <Action label="Aplicar volume" run={() => apply()} />
                <Action label="Restaurar 100%" run={() => apply(100)} />
            </Panel>
        )
    },
})
