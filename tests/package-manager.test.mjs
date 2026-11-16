import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packageManagerCommand } from '../scripts/package-manager.mjs';

test('runs native pnpm.exe directly on Windows', () => {
    const manager = String.raw`C:\Users\HARU\AppData\Roaming\npm\node_modules\pnpm\bin\pnpm.exe`;
    assert.deepEqual(packageManagerCommand(manager, 'node.exe'), { executable: manager, args: [] });
});
test('uses Node for pnpm JavaScript entrypoints', () => {
    for (const manager of ['/opt/pnpm/bin/pnpm.cjs', String.raw`C:\Program Files\pnpm\pnpm.js`]) {
        assert.deepEqual(packageManagerCommand(manager, 'node'), { executable: 'node', args: [manager] });
    }
});
test('runs native Unix pnpm directly', () => {
    assert.deepEqual(packageManagerCommand('/opt/pnpm/pnpm'), { executable: '/opt/pnpm/pnpm', args: [] });
});
