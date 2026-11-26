import { afterEach, describe, expect, it } from 'vitest'
import { badgeKey } from '../../src/byaflux/badge-layout'
import { tieredBadges } from '../../src/byaflux/definitions'
import { badgeState, readFakeSettings } from '../../src/byaflux/state'

const user = '1227436212982251533'
const other = '111111111111111111'
afterEach(() => {
    badgeState.setFake(undefined)
    badgeState.setRemoteProvider(undefined)
    badgeState.setLayoutProvider(undefined)
})
describe('FakeBadges tiered families', () => {
    for (const group of tieredBadges) {
        for (const level of group.levels) {
            it(`${group.title} ${level.id} replaces its native badge and persists`, () => {
                const settings = readFakeSettings({
                    target: user,
                    users: {
                        [user]: {
                            badges: [],
                            nitro: '',
                            boost: '',
                            [group.key]: level.id,
                        },
                    },
                })
                badgeState.setFake(JSON.parse(JSON.stringify(settings)))
                const native = [{ id: group.nativeId }, { id: 'partner' }]
                const result = badgeState.merge(native, user) as {
                    id: string
                    iconSrc: string
                    description: string
                }[]
                expect(
                    result.filter(
                        b => b.id === `byaflux-${user}-fake-${group.key}`,
                    ),
                ).toHaveLength(1)
                expect(result.some(b => b.id === String(group.nativeId))).toBe(
                    false,
                )
                expect(result).not.toContainEqual({ id: group.nativeId })
                expect(
                    result.find(
                        b => b.id === `byaflux-${user}-fake-${group.key}`,
                    )?.description,
                ).toContain(level.title)
                expect(badgeState.merge(result, user)).toEqual(result)
                expect(native).toEqual([
                    { id: group.nativeId },
                    { id: 'partner' },
                ])
                expect(badgeKey(result[0]!)).toBeUndefined()
                expect(badgeState.merge(native, other)).toEqual(native)
            })
        }
    }
    it('keeps local simulation with a public layout and never changes the published preference', () => {
        const layout = Object.freeze({
            revision: 1,
            order: ['discord:20', 'byaflux:owner'],
            hidden: ['discord:20'],
        })
        badgeState.setLayoutProvider(() => layout)
        badgeState.setFake({
            target: user,
            users: {
                [user]: { badges: [], nitro: '', boost: '', gameTime: '10' },
            },
        })
        const result = badgeState.merge(
            [
                { id: 'game_time' },
                { id: 'byaflux_owner', layoutKey: 'byaflux:owner' },
            ],
            user,
        ) as { id: string }[]
        expect(result.some(b => b.id === `byaflux-${user}-fake-gameTime`)).toBe(
            true,
        )
        expect(layout.hidden).toEqual(['discord:20'])
        expect(layout.order).toEqual(['discord:20', 'byaflux:owner'])
    })
    it('never pushes simulated badges into the remote badge cache', () => {
        const remote = Object.freeze([
            {
                id: `byaflux-${user}-official-owner`,
                description: 'Owner',
                icon: 'dummy',
                iconSrc: 'real',
            },
        ])
        badgeState.setRemoteProvider(
            () => remote as unknown as (typeof remote)[number][],
        )
        badgeState.setFake({
            target: user,
            users: {
                [user]: {
                    badges: ['staff'],
                    nitro: 'gold',
                    boost: '3m',
                    gifting: '6',
                },
            },
        })
        for (let i = 0; i < 20; i++)
            expect(badgeState.badges(user)).toHaveLength(5)
        expect(remote).toHaveLength(1)
    })
    it('ignores invalid tiers instead of hiding the actual badge', () => {
        badgeState.setFake({
            target: user,
            users: {
                [user]: { badges: [], nitro: '', boost: '', gameTime: '999' },
            },
        })
        expect(badgeState.hasReplacement(user, 'gameTime')).toBe(false)
        expect(badgeState.merge([{ id: 'game_time' }], user)).toEqual([
            { id: 'game_time' },
        ])
    })
    it('restores real badges when a simulated tier is disabled', () => {
        badgeState.setFake({
            target: user,
            users: {
                [user]: { badges: [], nitro: '', boost: '', streaming: '10' },
            },
        })
        expect(badgeState.merge([{ id: 'streaming' }], user)).not.toEqual([
            { id: 'streaming' },
        ])
        badgeState.setFake(undefined)
        expect(badgeState.merge([{ id: 'streaming' }], user)).toEqual([
            { id: 'streaming' },
        ])
    })
})
