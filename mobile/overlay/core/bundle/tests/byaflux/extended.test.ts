import { describe, expect, it } from 'vitest'
import {
    ExpandedBadgeLimit,
    expandBadgeLimit,
    expandedBadgeProps,
} from '../../src/plugins/start/always-extended/limits'

describe('AlwaysExtended mobile integration', () => {
    it('restores a configurable constant including its descriptor', () => {
        const module = { MAX_DISPLAYED_PROFILE_BADGES: 6 }
        const previous = Object.getOwnPropertyDescriptor(
            module,
            'MAX_DISPLAYED_PROFILE_BADGES',
        )
        const stop = expandBadgeLimit(module)
        expect(module.MAX_DISPLAYED_PROFILE_BADGES).toBe(ExpandedBadgeLimit)
        stop!()
        expect(
            Object.getOwnPropertyDescriptor(
                module,
                'MAX_DISPLAYED_PROFILE_BADGES',
            ),
        ).toEqual(previous)
    })
    it('supports live getters and restores the original getter', () => {
        let value = 6
        const module = {
            get MAX_DISPLAYED_PROFILE_BADGES() {
                return value
            },
        }
        const stop = expandBadgeLimit(module)
        value = 8
        expect(module.MAX_DISPLAYED_PROFILE_BADGES).toBe(ExpandedBadgeLimit)
        stop!()
        expect(module.MAX_DISPLAYED_PROFILE_BADGES).toBe(8)
    })
    it('supports writable nonconfigurable exports', () => {
        const module = {}
        Object.defineProperty(module, 'MAX_DISPLAYED_PROFILE_BADGES', {
            value: 6,
            writable: true,
            configurable: false,
        })
        const stop = expandBadgeLimit(module)
        expect(Reflect.get(module, 'MAX_DISPLAYED_PROFILE_BADGES')).toBe(
            ExpandedBadgeLimit,
        )
        stop!()
        expect(Reflect.get(module, 'MAX_DISPLAYED_PROFILE_BADGES')).toBe(6)
    })
    it('ignores frozen exports, missing values and throwing getters without crashing', () => {
        expect(
            expandBadgeLimit(
                Object.freeze({ MAX_DISPLAYED_PROFILE_BADGES: 6 }),
            ),
        ).toBeUndefined()
        expect(expandBadgeLimit({})).toBeUndefined()
        expect(
            expandBadgeLimit({ MAX_DISPLAYED_PROFILE_BADGES: '6' }),
        ).toBeUndefined()
        expect(
            expandBadgeLimit({
                get MAX_DISPLAYED_PROFILE_BADGES() {
                    throw Error('unavailable')
                },
            }),
        ).toBeUndefined()
    })
    it('does not overwrite another plugin during cleanup', () => {
        const module = { MAX_DISPLAYED_PROFILE_BADGES: 6 }
        const stop = expandBadgeLimit(module)
        Object.defineProperty(module, 'MAX_DISPLAYED_PROFILE_BADGES', {
            value: 10,
            writable: true,
            configurable: true,
        })
        stop!()
        expect(module.MAX_DISPLAYED_PROFILE_BADGES).toBe(10)
    })
    it('adds wrapping while preserving badges, callbacks, dimensions and the input object', () => {
        const badges = Object.freeze([
            { id: 'native' },
            { id: 'byaflux-custom' },
        ])
        const onPress = () => {}
        const style = Object.freeze({ maxWidth: 280 })
        const props = Object.freeze({ badges, userId: '123', style, onPress })
        const expanded = expandedBadgeProps(props)
        expect(expanded.badges).toBe(badges)
        expect(expanded.onPress).toBe(onPress)
        expect(props.style).toBe(style)
        expect(expanded.style).toEqual([
            style,
            { flexWrap: 'wrap', rowGap: 4, flexShrink: 1 },
        ])
    })
    it('can be enabled and disabled repeatedly', () => {
        const module = { MAX_DISPLAYED_PROFILE_BADGES: 6 }
        for (let i = 0; i < 5; i++) {
            const stop = expandBadgeLimit(module)
            expect(module.MAX_DISPLAYED_PROFILE_BADGES).toBe(ExpandedBadgeLimit)
            stop!()
            expect(module.MAX_DISPLAYED_PROFILE_BADGES).toBe(6)
        }
    })
})
