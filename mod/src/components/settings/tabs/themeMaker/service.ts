/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { SaveCtmRequest, SavedCtmTheme } from "../../../../shared/themeMaker";
export interface ThemeMakerAdapter {
    getCtmThemes(): Promise<SavedCtmTheme[]>;
    saveCtmTheme(request: SaveCtmRequest): Promise<SavedCtmTheme>;
}
interface ThemeSettings {
    enabledThemes: string[];
    themeActivationModes: Partial<Record<string, "always" | "light" | "dark">>;
}
export async function saveAndActivateTheme(
    adapter: ThemeMakerAdapter,
    settings: ThemeSettings,
    request: SaveCtmRequest
): Promise<SavedCtmTheme> {
    const saved = await adapter.saveCtmTheme(request);
    let themes: SavedCtmTheme[];
    try {
        themes = await adapter.getCtmThemes();
    } catch {
        throw new Error(`O arquivo ${saved.fileName} foi salvo, mas não foi ativado. Reabra-o em Meus temas.`);
    }
    const ctmFiles = new Set(themes.map(theme => theme.fileName));
    const otherThemes = settings.enabledThemes.filter(file => !ctmFiles.has(file));
    settings.themeActivationModes = { ...settings.themeActivationModes, [saved.fileName]: "always" };
    settings.enabledThemes = [...otherThemes, saved.fileName];
    return saved;
}
