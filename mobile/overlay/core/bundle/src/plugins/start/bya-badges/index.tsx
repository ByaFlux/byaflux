import Page from '@valenced/components/Page'
import { Design } from '@valenced/discord/design'
import { registerInternalPlugin } from '@valenced/plugins/_'
import { useSyncExternalStore } from 'react'
import { ScrollView } from 'react-native'
import { validateCatalog } from '~/byaflux/catalog'
import { connectProfiles, matchedBadgeHooks } from '~/byaflux/profile'
import { badgeState, CatalogUrl } from '~/byaflux/state'
import manifest from './manifest.json'
import type { BadgeCatalog } from '~/byaflux/catalog'

let refreshNow: (() => Promise<void>) | undefined
const { TableRow, TableRowGroup } = Design

registerInternalPlugin<{ jsonStorage: { catalog: BadgeCatalog | null } }>(
    manifest,
    {
        jsonStorage: { load: true, default: { catalog: null } },
        async start({ cleanup, jsonStorage, logger }) {
            let active = true
            let busy = false
            let request: AbortController | undefined
            const cached = jsonStorage.cache?.catalog
            if (cached)
                try {
                    badgeState.setOfficial(validateCatalog(cached))
                } catch {}
            connectProfiles(cleanup)
            async function refresh() {
                if (!active || busy) return
                busy = true
                request = new AbortController()
                const timeout = setTimeout(() => request?.abort(), 15000)
                try {
                    const response = await fetch(CatalogUrl, {
                        signal: request.signal,
                    })
                    if (!response.ok) throw new Error(`HTTP ${response.status}`)
                    const catalog = validateCatalog(await response.json())
                    if (!active) return
                    badgeState.setOfficial(catalog)
                    badgeState.status = 'Catálogo atualizado'
                    await jsonStorage.set({ catalog })
                } catch (error) {
                    if (active) {
                        badgeState.status =
                            'Sem conexão. Mantendo o último catálogo válido.'
                        logger.warn(error)
                    }
                } finally {
                    clearTimeout(timeout)
                    busy = false
                    if (active) badgeState.changed()
                }
            }
            refreshNow = refresh
            void refresh()
            const timer = setInterval(
                () => {
                    void refresh()
                },
                5 * 60 * 1000,
            )
            cleanup(() => {
                active = false
                request?.abort()
                clearInterval(timer)
                refreshNow = undefined
            })
        },
        SettingsComponent() {
            useSyncExternalStore(badgeState.subscribe, badgeState.snapshot)
            return (
                <ScrollView>
                    <Page>
                        <TableRowGroup title="ByaBadges">
                            <TableRow
                                label={badgeState.status}
                                subLabel="As badges oficiais aparecem antes das badges do Discord."
                            />
                            <TableRow
                                label="Atualizar badges"
                                onPress={() => {
                                    void refreshNow?.()
                                }}
                            />
                            <TableRow
                                label={`Integrações de perfil detectadas: ${matchedBadgeHooks}`}
                                subLabel="Se aparecer zero após abrir um perfil, esta versão do Discord precisa de ajuste de compatibilidade."
                            />
                        </TableRowGroup>
                    </Page>
                </ScrollView>
            )
        },
    },
)
