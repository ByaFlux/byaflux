import { describe, expect, it } from 'vitest'
import {
    emptyRoles,
    orderedRoles,
    readSelection,
    roleKey,
    toggleRole,
    visibleRoles,
} from '../../src/plugins/start/fake-roles/model'

const a = '1227436212982251533',
    b = '2227436212982251533',
    c = '3227436212982251533'
describe('FakeRoles local state', () => {
    it('adds and hides display roles without mutating native roles', () => {
        const real = Object.freeze([a])
        const add = toggleRole(real, emptyRoles(), b, true)
        const hide = toggleRole(real, add, a, false)
        expect(visibleRoles(real, hide, [a, b, c])).toEqual([b])
        expect(real).toEqual([a])
        expect(visibleRoles([...real, c], hide, [a, b, c])).toEqual([c, b])
        expect(visibleRoles(real, hide, [a, c])).toEqual([])
        expect(visibleRoles(real, undefined, [a, b])).toEqual([a])
    })
    it('separates accounts and servers and validates saved data', () => {
        expect(roleKey(a, b)).not.toBe(roleKey(b, a))
        expect(roleKey(a, b)).not.toBe(roleKey(a, c))
        expect(readSelection({ added: [b, b, 'bad'], hidden: null })).toEqual({
            added: [b],
            hidden: [],
        })
    })
    it('includes managed roles and excludes everyone from editable roles', () => {
        expect(
            orderedRoles(
                [
                    { id: a, name: 'everyone' },
                    { id: b, name: 'bot', position: 1, managed: true },
                    { id: c, name: 'owner', position: 2 },
                ],
                a,
            ).map(x => x.id),
        ).toEqual([c, b])
    })
})
