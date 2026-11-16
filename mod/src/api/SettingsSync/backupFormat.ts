export interface SettingsBackup {
    settings?: Record<string, any>;
    quickCss?: string;
    dataStore?: [IDBValidKey, unknown][];
}

function isRecord(value: unknown): value is Record<string, any> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertSafeKeys(value: unknown) {
    if (value === null || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value)) {
        if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Unsafe Settings");
        assertSafeKeys(entry);
    }
}

export function parseSettingsBackup(data: string): SettingsBackup {
    let parsed: unknown;
    try { parsed = JSON.parse(data); }
    catch { throw new Error("O arquivo não contém um JSON válido."); }
    if (!isRecord(parsed)) throw new Error("Formato de backup inválido.");
    assertSafeKeys(parsed);

    // Exported backups from all three clients share this envelope. A raw
    // settings.json with plugin settings is also accepted for older installs.
    if (!["settings", "quickCss", "dataStore"].some(key => Object.hasOwn(parsed, key))) {
        if (isRecord(parsed.plugins)) return { settings: parsed };
        throw new Error("O arquivo não contém configurações de backup reconhecidas.");
    }
    if (Object.hasOwn(parsed, "settings") && !isRecord(parsed.settings)) throw new Error("Configurações inválidas no backup.");
    if (Object.hasOwn(parsed, "quickCss") && typeof parsed.quickCss !== "string") throw new Error("QuickCSS inválido no backup.");
    if (Object.hasOwn(parsed, "dataStore") && (!Array.isArray(parsed.dataStore)
        || parsed.dataStore.some(entry => !Array.isArray(entry) || entry.length !== 2))) {
        throw new Error("DataStore inválido no backup.");
    }
    return {
        ...(parsed.settings !== undefined && { settings: parsed.settings }),
        ...(parsed.quickCss !== undefined && { quickCss: parsed.quickCss }),
        ...(parsed.dataStore !== undefined && { dataStore: parsed.dataStore })
    };
}
