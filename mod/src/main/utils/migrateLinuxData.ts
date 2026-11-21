import { cpSync, existsSync } from "fs";
import { join } from "path";

export function migrateLinuxData(destination: string, legacy: string) {
    for (const name of ["settings", "themes"]) {
        const from = join(legacy, name), to = join(destination, name);
        if (existsSync(from) && !existsSync(to)) cpSync(from, to, { recursive: true, force: false, errorOnExist: true });
    }
}
