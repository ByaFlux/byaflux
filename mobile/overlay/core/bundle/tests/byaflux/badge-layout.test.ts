import { afterEach, describe, expect, it } from 'vitest'
import {
    applyBadgeLayout,
    badgeKey,
    moveLayoutItem,
    readBadgeLayout,
} from '../../src/byaflux/badge-layout'
import { badgeState } from '../../src/byaflux/state'

const user = '1227436212982251533'
afterEach(() => {
    badgeState.setRemoteProvider(undefined)
    badgeState.setLayoutProvider(undefined)
    badgeState.setFake(undefined)
})
describe('public badge layouts', () => {
    it('normalizes catalog and legacy badges across platforms', () => {
        expect(badgeKey({ badge_id: 1 })).toBe('discord:1')
        expect(badgeKey({ id: 'premium_tenure_12_month_v2' })).toBe('discord:1')
        expect(badgeKey({ id: 'guild_booster_lvl9' })).toBe('discord:12')
        expect(badgeKey({ id: 'byaflux_owner' })).toBe('byaflux:owner')
        expect(badgeKey({ id: `byaflux-${user}-official-owner` })).toBe(
            'byaflux:owner',
        )
        expect(
            badgeKey({
                id: 'vencord_donor_badge_1',
                infoLabel: 'Vencord Donor',
            }),
        ).toBeUndefined()
    })
    it('mixes custom badges between official ones without granting missing badges', () => {
        const original = [
            { id: 'byaflux_owner' },
            { id: 'byaflux_supporter' },
            { id: 'premium' },
            { id: 'guild_booster_lvl9' },
        ]
        const layout = readBadgeLayout({
            revision: 1,
            order: [
                'discord:1',
                'byaflux:owner',
                'discord:12',
                'byaflux:supporter',
                'discord:22',
            ],
            hidden: ['byaflux:supporter'],
        })
        expect(applyBadgeLayout(original, layout).map(b => b.id)).toEqual([
            'premium',
            'byaflux_owner',
            'guild_booster_lvl9',
        ])
        expect(original).toHaveLength(4)
    })
    it('keeps unrelated mod badges in their slots', () => {
        const addon = { id: 'vc-other', infoLabel: 'Other' }
        const result = applyBadgeLayout(
            [
                { id: 'byaflux_owner' },
                addon,
                { id: 'premium' },
                { id: 'quest_completed' },
            ],
            { revision: 1, order: ['discord:1', 'byaflux:owner'], hidden: [] },
        )
        expect(result.map(b => b.id)).toEqual([
            'premium',
            'vc-other',
            'byaflux_owner',
            'quest_completed',
        ])
        expect(result[1]).toBe(addon)
    })
    it('moves without mutation and rejects malformed envelopes', () => {
        const source = ['a', 'b', 'c']
        expect(moveLayoutItem(source, 'a', 'c')).toEqual(['b', 'c', 'a'])
        expect(source).toEqual(['a', 'b', 'c'])
        expect(
            readBadgeLayout({ revision: 0, order: [], hidden: [] }),
        ).toBeNull()
        expect(
            readBadgeLayout({ revision: 1, order: 'bad', hidden: [] }),
        ).toBeNull()
    })
    it('preserves public layouts without disabling local simulations', () => {
        badgeState.setRemoteProvider(() => [
            {
                id: `byaflux-${user}-official-owner`,
                layoutKey: 'byaflux:owner',
                description: 'Owner',
                icon: 'dummy',
                iconSrc: 'data:icon',
            },
        ])
        badgeState.setFake({
            target: user,
            users: { [user]: { badges: [], nitro: 'bronze', boost: '' } },
        })
        badgeState.setLayoutProvider(() => ({
            revision: 1,
            order: ['discord:1', 'byaflux:owner'],
            hidden: [],
        }))
        expect(badgeState.hasReplacement(user, 'nitro')).toBe(true)
        expect(
            badgeState.merge([{ id: 'premium' }], user).map(b => (b as any).id),
        ).toEqual([
            `byaflux-${user}-official-owner`,
            `byaflux-${user}-fake-nitro`,
        ])
        badgeState.setLayoutProvider(undefined)
        expect(badgeState.hasReplacement(user, 'nitro')).toBe(true)
    })
})
