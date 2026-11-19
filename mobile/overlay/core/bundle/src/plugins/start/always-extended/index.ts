import { registerInternalPlugin } from '@valenced/plugins/_'
import { badgeState } from '~/byaflux/state'
import manifest from './manifest.json'

registerInternalPlugin(manifest, {
    start({ cleanup }) {
        badgeState.setExtended(true)
        cleanup(() => badgeState.setExtended(false))
    },
})
