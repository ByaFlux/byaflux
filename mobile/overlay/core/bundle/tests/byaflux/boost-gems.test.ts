import { afterEach, describe, expect, it } from 'vitest'
import {
    boostGems,
    getBoostGemImage,
    replaceBoostGem,
    setBoostGemsEnabled,
} from '../../src/byaflux/boost-gems'
import { boostLevels, imageUrl } from '../../src/byaflux/definitions'
import { badgeState } from '../../src/byaflux/state'

const user = '1227436212982251533'
afterEach(() => {
    setBoostGemsEnabled(false)
    badgeState.setFake(undefined)
    badgeState.setLayoutProvider(undefined)
})
describe('BetterNitroGem', () => {
    for (const [index, gem] of boostGems.entries()) {
        it(`keeps the ${gem.months}-month tier for real and simulated Boost badges`, () => {
            setBoostGemsEnabled(true)
            expect(gem.image.startsWith('data:image/gif;base64,R0lGOD')).toBe(
                true,
            )
            expect(getBoostGemImage(gem.hash)).toBe(gem.image)
            const native = {
                id: `guild_booster_lvl${index + 1}`,
                name: 'Boost',
                iconSrc: 'unrecognized-new-url',
            }
            const copy = { ...native }
            const real = badgeState.merge([native], user) as Record<
                string,
                unknown
            >[]
            expect(real[0]?.iconSrc).toBe(gem.image)
            expect(real[0]?.id).toBe(native.id)
            expect(native).toEqual(copy)
            const catalog = replaceBoostGem({
                badge_id: 12,
                simple_icon_raster_url: `https://cdn.discordapp.com/badge-icons/${gem.hash}.png`,
            })
            expect(catalog.simple_icon_raster_url).toBe(gem.image)
            badgeState.setFake({
                target: user,
                users: { [user]: { badges: [], nitro: '', boost: gem.id } },
            })
            expect(badgeState.badges(user)[0]?.iconSrc).toBe(gem.image)
            expect(imageUrl(boostLevels[index]!.hash)).toBe(gem.image)
            setBoostGemsEnabled(false)
            expect(replaceBoostGem(native)).toBe(native)
            expect(badgeState.badges(user)[0]?.iconSrc).toContain(
                boostLevels[index]!.hash,
            )
        })
    }
    it('preserves public order, hidden badges, custom artwork and other families', () => {
        setBoostGemsEnabled(true)
        const nitro = { id: 'premium', iconSrc: 'nitro' }
        const custom = {
            id: `byaflux-${user}-official-test`,
            layoutKey: 'byaflux:test',
            iconSrc: `https://cdn.discordapp.com/badge-icons/${boostGems[0]!.hash}.png`,
        }
        expect(replaceBoostGem(nitro)).toBe(nitro)
        expect(replaceBoostGem(custom)).toBe(custom)
        badgeState.setLayoutProvider(() => ({
            revision: 1,
            order: ['discord:12', 'byaflux:test', 'discord:1'],
            hidden: ['discord:1'],
        }))
        const result = badgeState.arrange(
            [nitro, custom, { id: 'guild_booster_lvl9', iconSrc: 'native' }],
            user,
        )
        expect(result.map(b => b.id)).toEqual(['guild_booster_lvl9', custom.id])
        expect(result[0]?.iconSrc).toBe(boostGems[8]!.image)
    })
})
