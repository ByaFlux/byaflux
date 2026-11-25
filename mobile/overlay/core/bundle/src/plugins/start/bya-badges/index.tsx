import Page from '@valenced/components/Page'
import { Design } from '@valenced/discord/design'
import { registerInternalPlugin } from '@valenced/plugins/_'
import { useSyncExternalStore } from 'react'
import { ScrollView } from 'react-native'
import { readBadgeLayout } from '~/byaflux/badge-layout'
import { connectProfiles, matchedBadgeHooks } from '~/byaflux/profile'
import { badgeState, Prefix } from '~/byaflux/state'
import { MobileVersionName } from '~/byaflux/version'
import manifest from './manifest.json'
import type { BadgeLayout } from '~/byaflux/badge-layout'
import type { DisplayBadge } from '~/byaflux/state'

const API = 'https://byaflux.discloud.dev'
const { TableRow, TableRowGroup } = Design
let refreshNow: (() => void) | undefined
registerInternalPlugin(manifest, {
    start({ cleanup }) {
        let active = true
        const cache = new Map<
            string,
            {
                until: number
                badges: DisplayBadge[]
                layout: BadgeLayout | null
            }
        >()
        const pending = new Set<string>()
        const controllers = new Set<AbortController>()
        async function request(path: string, body?: unknown) {
            const controller = new AbortController()
            controllers.add(controller)
            const timeout = setTimeout(() => controller.abort(), 8000)
            try {
                const response = await fetch(API + path, {
                    method: body ? 'POST' : 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    ...(body ? { body: JSON.stringify(body) } : {}),
                    signal: controller.signal,
                })
                if (!response.ok) throw new Error('API indisponível')
                return await response.json()
            } finally {
                clearTimeout(timeout)
                controllers.delete(controller)
            }
        }
        async function load(userId: string) {
            if (!active || pending.has(userId) || !/^\d{17,20}$/.test(userId))
                return
            pending.add(userId)
            try {
                const payload = await request(
                    `/api/client/profiles/${userId}/badges`,
                )
                if (!active) return
                if (
                    payload.profileId !== userId ||
                    !Array.isArray(payload.badges)
                )
                    throw new Error('Perfil inválido')
                const badges: DisplayBadge[] = payload.badges
                    .slice(0, 128)
                    .filter(
                        (b: any) =>
                            b &&
                            typeof b.id === 'string' &&
                            typeof b.name === 'string' &&
                            typeof b.icon === 'string' &&
                            /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(
                                b.icon,
                            ),
                    )
                    .map((b: any) => ({
                        id: `${Prefix}${userId}-official-${b.id}`,
                        description: b.name,
                        layoutKey: `byaflux:${b.id}`,
                        icon: 'dummy',
                        iconSrc: b.icon,
                    }))
                if (cache.size >= 200 && !cache.has(userId))
                    cache.delete(cache.keys().next().value!)
                cache.set(userId, {
                    until: Date.now() + 15000,
                    badges,
                    layout: readBadgeLayout(payload.badgeLayout),
                })
                badgeState.status = 'Badges consultadas por perfil'
                badgeState.changed()
            } catch {
                if (active)
                    cache.set(userId, {
                        until: Date.now() + 15000,
                        badges: cache.get(userId)?.badges ?? [],
                        layout: cache.get(userId)?.layout ?? null,
                    })
            } finally {
                pending.delete(userId)
            }
        }
        connectProfiles(cleanup)
        badgeState.setLayoutProvider(
            userId => cache.get(userId)?.layout ?? null,
        )
        badgeState.setRemoteProvider(userId => {
            const saved = cache.get(userId)
            if (!saved || saved.until <= Date.now()) void load(userId)
            return [...(saved?.badges ?? [])]
        })
        const report = () =>
            request('/api/client/open', {
                platform: 'android',
                version: MobileVersionName,
            }).catch(() => {})
        void report()
        let ticks = 0
        const timer = setInterval(() => {
            if (++ticks % 4 === 0) void report()
            badgeState.changed()
        }, 15000)
        refreshNow = () => {
            for (const saved of cache.values()) saved.until = 0
            badgeState.changed()
        }
        cleanup(() => {
            active = false
            clearInterval(timer)
            for (const c of controllers) c.abort()
            cache.clear()
            pending.clear()
            badgeState.setRemoteProvider(undefined)
            badgeState.setLayoutProvider(undefined)
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
                            subLabel="Consulta por perfil, sem login e sem bot."
                        />
                        <TableRow
                            label="Atualizar badges"
                            onPress={() => refreshNow?.()}
                        />
                        <TableRow
                            label="Termos de uso"
                            subLabel="byaflux.discloud.dev/terms"
                        />
                        <TableRow
                            label={`Integrações detectadas: ${matchedBadgeHooks}`}
                        />
                    </TableRowGroup>
                </Page>
            </ScrollView>
        )
    },
})
