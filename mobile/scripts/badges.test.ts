import { badgeState, readFakeSettings } from '../work/core/bundle/src/byaflux/state.ts'
import { validateCatalog } from '../work/core/bundle/src/byaflux/catalog.ts'
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
const a = '1227436212982251533'
const b = '1447184878411186288'
const catalog = validateCatalog({schemaVersion:1,badges:{developer:{name:'Desenvolvedor',description:'Dev',icon:'icons/developer-minimal.svg'}},users:{[a]:['developer']}})
badgeState.setOfficial(catalog)
const native = [{id:'premium',icon:'native-nitro'},{id:'guild_booster_lvl1',icon:'native-boost'},{id:'early_supporter',icon:'native-early'}]
const original = JSON.stringify(native)
badgeState.setFake(readFakeSettings({target:a,users:{[a]:{badges:['staff','staff','invalid'],nitro:'gold',boost:'3m'},[b]:{badges:[],nitro:'bronze',boost:''}}}))
const merged = badgeState.merge(native,a) as Record<string,unknown>[]
assert(merged[0].description === 'Desenvolvedor','Official badges must come first')
assert(merged.filter(b=>String(b.id).includes('fake-staff')).length === 1,'Duplicate selection was not removed')
assert(!merged.some(b=>b.id==='premium'||b.id==='guild_booster_lvl1'),'Native Nitro/boost must be replaced')
assert(merged.some(b=>b.id==='early_supporter'),'Early Supporter must be preserved')
assert(JSON.stringify(native)===original,'Native badge array was mutated')
assert(merged.filter(b=>String(b.id).includes('fake-nitro')).length===1,'Missing Nitro replacement')
const ownNitro = merged.find(b=>String(b.id).endsWith('fake-nitro'))!
const otherNitro = badgeState.badges(b).find(b=>b.id.endsWith('fake-nitro'))!
assert(badgeState.props(ownNitro.id)?.source.uri !== badgeState.props(otherNitro.id)?.source.uri,'User-specific tiers leaked across profiles')
const twice = badgeState.merge(merged,a)
assert(twice.length===merged.length,'Repeated render duplicated badges')
badgeState.setFake(undefined)
assert(badgeState.merge(native,a).some(b=>(b as Record<string,unknown>).id==='premium'),'Disabling FakeBadges must restore native badges')
let invalid=false;try{validateCatalog({schemaVersion:1,badges:{x:{name:'x',description:'x',icon:'http://insecure/x.png'}},users:{}})}catch{invalid=true}
assert(invalid,'Invalid catalog accepted')
console.log('PASS: badge order, deduplication, tier replacement, per-user isolation, immutable inputs, disable cleanup and catalog validation.')
