import { extname } from 'node:path';

// npm_execpath can be a JavaScript entrypoint or a native pnpm executable.
export function packageManagerCommand(manager, node = process.execPath) {
    if (/^\.(?:cjs|mjs|js)$/i.test(extname(manager))) {
        return { executable: node, args: [manager] };
    }
    return { executable: manager, args: [] };
}
