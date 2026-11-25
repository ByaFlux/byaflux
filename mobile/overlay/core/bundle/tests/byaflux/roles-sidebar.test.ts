import assert from 'node:assert/strict'
import { it as test } from 'vitest'
import * as m from '../../src/plugins/start/fake-roles/model'

const platform = 'mobile',
    guild = '111111111111111111',
    self = '222222222222222222',
    role = '333333333333333333'
const catalog = [
    { id: role, name: 'Equipe', position: 99, hoist: true, color: 0xff8800 },
]
const member = { userId: self, roles: [] },
    user = { id: self, username: 'Haru' }
const header = (id, count, index) => ({
    type: 'GROUP',
    key: id,
    id,
    title: id === 'online' ? 'Online' : id,
    count,
    index,
})
const person = (id, name) => ({
    type: 'MEMBER',
    user: { id, username: name },
    roles: [],
})
const own = person(self, 'Haru')
const project = (
    source,
    status = 'online',
    selection = { added: [role], hidden: [] },
) =>
    m.projectMemberList(
        source,
        guild,
        self,
        selection,
        catalog,
        member,
        user,
        status,
    )
function aligned(result) {
    let offset = 0
    const keys = []
    for (const g of result.groups) {
        assert.equal(g.index, offset)
        assert.equal(g.key, g.id)
        assert.equal(result.rows[offset]?.id, g.id)
        assert.equal(result.rows[offset]?.count, g.count)
        keys.push(g.key)
        offset += g.count + 1
    }
    assert.equal(result.rows.length, offset)
    assert.equal(new Set(keys).size, keys.length)
    assert.equal(result.rows.filter(r => m.memberRowId(r) === self).length, 1)
}
test(`${platform}: new role group has its own native key, title and offsets`, () => {
    const a = header('online', 2, 0),
        b = header('offline', 1, 3)
    const source = {
        groups: [a, b],
        rows: [
            a,
            own,
            person('444444444444444444', 'Zoe'),
            b,
            person('555555555555555555', 'Ada'),
        ],
        version: 3,
    }
    const r = project(source)
    aligned(r)
    assert.equal(r.groups[0].title, 'Equipe')
    assert.equal(r.rows[1].user.id, self)
    assert.equal(source.groups[0].count, 2)
    assert.equal(source.rows[1], own)
    assert.equal(r.rows[1].colorString, '#ff8800')
})
test(`${platform}: partially loaded groups keep every placeholder and later header`, () => {
    const a = header(role, 100, 0),
        b = header('online', 2, 101),
        c = header('offline', 50, 104)
    const rows = new Array(155)
    rows[0] = a
    rows[1] = person('444444444444444444', 'Alice')
    rows[101] = b
    rows[102] = own
    rows[103] = person('555555555555555555', 'Zoe')
    rows[104] = c
    rows[154] = person('666666666666666666', 'Last')
    const r = project({ groups: [a, b, c], rows, version: 4 })
    aligned(r)
    assert.equal(r.rows.length, rows.length)
    assert.equal(r.rows[154], rows[154])
    assert.equal(r.groups[1].index, 102)
    assert.equal(r.groups[2].index, 104)
    assert.equal(r.rows.filter(r => r === undefined).length, 0)
    assert.ok(!(3 in r.rows))
})
test(`${platform}: unloaded headers use native group metadata`, () => {
    const a = header(role, 3, 0),
        b = header('online', 1, 4)
    const rows = new Array(6)
    rows[4] = b
    rows[5] = own
    const r = project({ groups: [a, b], rows, version: 4 })
    aligned(r)
    assert.equal(r.groups.length, 1)
    assert.equal(r.rows[0].title, role)
})
test(`${platform}: offline and reset do not duplicate or strand member rows`, () => {
    const a = header('online', 1, 0)
    const source = { groups: [a], rows: [a, own], version: 5 }
    const r = project(source, 'offline')
    aligned(r)
    assert.equal(r.groups[0].id, 'offline')
    const unchanged = m.projectMemberList(
        source,
        guild,
        self,
        undefined,
        catalog,
        member,
        user,
        'online',
    )
    assert.equal(unchanged, source)
})
test(`${platform}: store cache respects replacement groups even without a version change`, () => {
    const a = header('online', 1, 0)
    let source = { groups: [a], rows: [a, own], version: 5 }
    let status = 'online'
    const store = {
        getProps: () => ({ ...source }),
        getRows: () => source.rows,
    }
    const ctx = () => ({
        guildId: guild,
        userId: self,
        selection: { added: [role], hidden: [] },
        roles: catalog,
        member,
        user,
        status,
        revision: 0,
    })
    const restore = m.bindMemberListStore(store, ctx)
    const r = store.getProps()
    assert.equal(store.getProps(), r)
    source = { ...source, groups: source.groups.map(g => ({ ...g })) }
    assert.notEqual(store.getProps(), r)
    status = 'offline'
    assert.equal(store.getProps().groups[0].id, 'offline')
    restore()
})
