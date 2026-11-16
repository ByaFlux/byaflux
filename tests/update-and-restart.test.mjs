import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateAndRestart } from '../mod/src/utils/updateAndRestart.ts';

test('waits for a successful update before restarting Discord', async()=>{
    const events=[];
    const action=createUpdateAndRestart(async()=>{events.push('updated');return true;},()=>events.push('restart'));
    await action();
    assert.deepEqual(events,['updated','restart']);
});

test('a failed update never restarts and permits retry', async()=>{
    let attempts=0,restarts=0;
    const action=createUpdateAndRestart(async()=>{attempts++;if(attempts===1)throw new Error('download failed');return true;},()=>restarts++);
    await assert.rejects(action(),/download failed/);
    assert.equal(restarts,0);
    await action();assert.equal(restarts,1);
});

test('rejects an unapplied update without restarting',async()=>{
    let restarts=0;
    const action=createUpdateAndRestart(async()=>false,()=>restarts++);
    await assert.rejects(action(),/não foi aplicada/);
    assert.equal(restarts,0);
});

test('repeated clicks share the same download and restart once',async()=>{
    let finish,downloads=0,restarts=0;
    const action=createUpdateAndRestart(()=>{downloads++;return new Promise(resolve=>{finish=resolve;});},()=>restarts++);
    const first=action(),second=action();
    assert.equal(first,second);assert.equal(downloads,1);
    finish(true);await Promise.all([first,second]);assert.equal(restarts,1);
});
