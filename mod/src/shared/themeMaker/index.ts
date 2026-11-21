/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const EMOJI_PACKS = [
    "Discord",
    "Apple",
    "BlobMoji",
    "Facebook",
    "Google",
    "Huawei",
    "JoyPixels",
    "Microsoft",
    "Microsoft-3D",
    "OpenMoji",
    "Samsung",
    "Samsung-Old",
    "Toss",
    "WhatsApp"
] as const;
export type EmojiPack = (typeof EMOJI_PACKS)[number];
export const ICON_SHAPES = ["native", "round", "triangle", "square", "rounded"] as const;
export type IconShape = (typeof ICON_SHAPES)[number];
export const RADIAL_URL = "https://discordstyles.github.io/RadialStatus/RadialStatus.css";
export const EMOJI_BASE = "https://mwittrien.github.io/BetterDiscordAddons/Themes/EmojiReplace";
export const STATUS_COLORS = {
    online: "#43b581",
    idle: "#faa61a",
    dnd: "#f04747",
    offline: "#636b75",
    streaming: "#643da7",
    invisible: "#747f8d",
    speaking: "#57d39b"
};
export const FONTS = {
    Discord: { label: "Discord (gg sans)", family: '"gg sans", "Noto Sans", sans-serif', url: "" },
    Inter: {
        label: "Inter",
        family: '"Inter", sans-serif',
        url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
    },
    Roboto: {
        label: "Roboto",
        family: '"Roboto", sans-serif',
        url: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap"
    },
    Manrope: {
        label: "Manrope",
        family: '"Manrope", sans-serif',
        url: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap"
    },
    System: { label: "Sistema", family: 'system-ui, "Segoe UI", sans-serif', url: "" },
    Arial: { label: "Arial", family: "Arial, Helvetica, sans-serif", url: "" },
    Georgia: { label: "Georgia", family: 'Georgia, "Times New Roman", serif', url: "" },
    Mono: { label: "Monoespaçada", family: '"Cascadia Code", Consolas, monospace', url: "" }
} as const;
export type FontChoice = keyof typeof FONTS;
export interface Palette {
    chat: string;
    sidebar: string;
    servers: string;
    surface: string;
    text: string;
    muted: string;
}
export const PALETTES = [
    {
        id: "discord",
        name: "Discord",
        accent: "#5865f2",
        colors: {
            chat: "#313338",
            sidebar: "#2b2d31",
            servers: "#1e1f22",
            surface: "#383a40",
            text: "#dbdee1",
            muted: "#949ba4"
        }
    },
    {
        id: "graphite",
        name: "Grafite",
        accent: "#ff8038",
        colors: {
            chat: "#242429",
            sidebar: "#1d1d22",
            servers: "#17171b",
            surface: "#303037",
            text: "#ececf0",
            muted: "#a2a2af"
        }
    },
    {
        id: "midnight",
        name: "Meia-noite",
        accent: "#a99aff",
        colors: {
            chat: "#13151c",
            sidebar: "#101117",
            servers: "#0b0c11",
            surface: "#20222d",
            text: "#e3e5ef",
            muted: "#989db3"
        }
    },
    {
        id: "ocean",
        name: "Oceano",
        accent: "#53c7c2",
        colors: {
            chat: "#172a32",
            sidebar: "#13232a",
            servers: "#0d191f",
            surface: "#243a44",
            text: "#d9e9ed",
            muted: "#97afb8"
        }
    },
    {
        id: "light",
        name: "Claro",
        accent: "#4752c4",
        colors: {
            chat: "#ffffff",
            sidebar: "#f2f3f5",
            servers: "#e3e5e8",
            surface: "#ebedef",
            text: "#313338",
            muted: "#5c6068"
        }
    }
] as const;
export const defaultPalette = (): Palette => ({ ...PALETTES[1].colors });
export interface ThemeChoices {
    palette: Palette;
    typography: { font: FontChoice; size: number; lineHeight: number; weight: number };
    layout: { sidebarWidth: number; messageGap: number; radius: number };
    accent: string;
    compact: boolean;
    background: {
        enabled: boolean;
        url: string;
        opacity: number;
        position?: "center" | "top" | "bottom" | "left" | "right";
        blur?: number;
    };
    status: {
        mode: "normal" | "radial";
        widths: [number, number, number];
        gaps: [number, number, number];
        colors: typeof STATUS_COLORS;
    };
    icons: { shape: IconShape; radius: number };
    emoji: EmojiPack;
}
export interface CtmDocument {
    schema: 1;
    id: string;
    name: string;
    choices: ThemeChoices;
}
export interface SavedCtmTheme {
    fileName: string;
    revision: string;
    document: CtmDocument;
}
export interface SaveCtmRequest {
    name: string;
    choices: ThemeChoices;
    editing?: { fileName: string; id: string; revision: string };
}
export const defaults = (): ThemeChoices => ({
    palette: defaultPalette(),
    typography: { font: "Discord", size: 16, lineHeight: 1.5, weight: 400 },
    layout: { sidebarWidth: 272, messageGap: 16, radius: 8 },
    accent: "#ff8038",
    compact: false,
    background: { enabled: false, url: "", opacity: 75, position: "center", blur: 0 },
    status: { mode: "normal", widths: [2, 3, 4], gaps: [2, 3, 4], colors: { ...STATUS_COLORS } },
    icons: { shape: "native", radius: 16 },
    emoji: "Discord"
});
export function validateName(value: unknown): string {
    if (typeof value !== "string") throw new Error("Informe um nome para o tema.");
    const name = value.normalize("NFC");
    const forbidden = new Set([
        "<",
        ">",
        ":",
        String.fromCharCode(34),
        String.fromCharCode(47),
        String.fromCharCode(92),
        "|",
        "?",
        "*"
    ]);
    const device = name.split(".")[0].toUpperCase();
    const reserved = [
        "CON",
        "PRN",
        "AUX",
        "NUL",
        ...Array.from({ length: 9 }, (_, i) => "COM" + (i + 1)),
        ...Array.from({ length: 9 }, (_, i) => "LPT" + (i + 1))
    ];
    if (
        !name ||
        name.length > 64 ||
        name !== name.trim() ||
        Array.from(name).some(
            ch =>
                forbidden.has(ch) ||
                ch.charCodeAt(0) < 32 ||
                ch.charCodeAt(0) === 127 ||
                (ch.codePointAt(0)! >= 0xd800 && ch.codePointAt(0)! <= 0xdfff)
        ) ||
        name.endsWith(".") ||
        name === "." ||
        name === ".." ||
        reserved.includes(device)
    )
        throw new Error(
            "Use um nome de até 64 caracteres, sem barras, caracteres reservados ou espaços nas extremidades."
        );
    return name;
}
function color(value: unknown): string {
    if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value))
        throw new Error("Use cores no formato #RRGGBB.");
    return value.toLowerCase();
}
function number(value: unknown, min: number, max: number): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
        throw new Error("Medida fora do intervalo permitido.");
    return Math.round(value * 100) / 100;
}
function flag(value: unknown): boolean {
    if (typeof value !== "boolean") throw new Error("Opção inválida.");
    return value;
}
export function validateChoices(value: ThemeChoices): ThemeChoices {
    if (!value || typeof value !== "object" || !value.status || !value.background || !value.icons)
        throw new Error("Configuração do tema inválida.");
    if (
        !EMOJI_PACKS.includes(value.emoji) ||
        !ICON_SHAPES.includes(value.icons.shape) ||
        !["normal", "radial"].includes(value.status.mode)
    )
        throw new Error("Seleção de tema desconhecida.");
    const colors = { ...STATUS_COLORS };
    for (const key of Object.keys(colors) as (keyof typeof colors)[])
        colors[key] = color(value.status.colors?.[key]);
    const sizes = (values: number[], min: number, max: number): [number, number, number] => {
        if (!Array.isArray(values) || values.length !== 3)
            throw new Error("Informe as três medidas de status.");
        return values.map(n => number(n, min, max)) as [number, number, number];
    };
    if (typeof value.background.url !== "string" || value.background.url.length > 2048)
        throw new Error("URL do fundo inválida.");
    let { url } = value.background;
    if (value.background.enabled) {
        try {
            const parsed = new URL(url);
            if (
                parsed.protocol !== "https:" ||
                parsed.username ||
                parsed.password ||
                /[\r\n\u0000]/.test(url)
            )
                throw new Error();
            url = parsed.href;
        } catch {
            throw new Error("O fundo deve usar uma URL HTTPS de imagem, sem credenciais.");
        }
    }
    // Older CTM files remain editable; only absent sections receive the new defaults.
    const palette = value.palette === undefined ? defaultPalette() : value.palette;
    const typography = value.typography === undefined ? defaults().typography : value.typography;
    const layout = value.layout === undefined ? defaults().layout : value.layout;
    if (!palette || !typography || !layout || !Object.hasOwn(FONTS, typography.font))
        throw new Error("Configuração de cores, fonte ou layout inválida.");
    if (!["center", "top", "bottom", "left", "right"].includes(value.background.position ?? "center"))
        throw new Error("Posição do fundo inválida.");
    const validatedPalette = defaultPalette();
    for (const key of Object.keys(validatedPalette) as (keyof Palette)[])
        validatedPalette[key] = color(palette[key]);
    if (![400, 500, 600].includes(typography.weight)) throw new Error("Peso de fonte inválido.");
    return {
        palette: validatedPalette,
        typography: {
            font: typography.font,
            size: number(typography.size, 12, 22),
            lineHeight: number(typography.lineHeight, 1.2, 2),
            weight: typography.weight
        },
        layout: {
            sidebarWidth: number(layout.sidebarWidth, 220, 360),
            messageGap: number(layout.messageGap, 0, 32),
            radius: number(layout.radius, 0, 24)
        },
        accent: color(value.accent),
        compact: flag(value.compact),
        background: {
            enabled: flag(value.background.enabled),
            url,
            opacity: number(value.background.opacity, 0, 100),
            position: value.background.position ?? "center",
            blur: number(value.background.blur ?? 0, 0, 20)
        },
        status: {
            mode: value.status.mode,
            widths: sizes(value.status.widths, 0.5, 12),
            gaps: sizes(value.status.gaps, 0, 16),
            colors
        },
        icons: { shape: value.icons.shape, radius: number(value.icons.radius, 0, 24) },
        emoji: value.emoji
    };
}
export function iconClip(shape: IconShape, radius: number): string {
    return {
        native: "none",
        round: "circle(50%)",
        triangle: "polygon(50% 0%, 100% 100%, 0% 100%)",
        square: "inset(0)",
        rounded: `inset(0 round ${radius}px)`
    }[shape];
}
export function themeModules(choices: ThemeChoices): { id: "radial" | "emoji" | "font"; url: string }[] {
    const result: { id: "radial" | "emoji" | "font"; url: string }[] = [];
    if (choices.status.mode === "radial") result.push({ id: "radial", url: RADIAL_URL });
    if (choices.emoji !== "Discord")
        result.push({ id: "emoji", url: `${EMOJI_BASE}/base/${choices.emoji}.css` });
    if (FONTS[choices.typography.font].url)
        result.push({ id: "font", url: FONTS[choices.typography.font].url });
    return result;
}
function mixHex(hex: string, factor: number): string {
    return (
        "#" +
        [1, 3, 5]
            .map(index =>
                Math.round(parseInt(hex.slice(index, index + 2), 16) * factor)
                    .toString(16)
                    .padStart(2, "0")
            )
            .join("")
    );
}
export function accentText(hex: string): string {
    const rgb = [1, 3, 5]
        .map(index => parseInt(color(hex).slice(index, index + 2), 16) / 255)
        .map(channel => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
    const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05) ? "#000000" : "#ffffff";
}
function hsl(hex: string): string {
    const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
    const max = Math.max(r, g, b),
        min = Math.min(r, g, b),
        delta = max - min,
        lightness = (max + min) / 2;
    let hue = 0;
    if (delta)
        hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
    return `${Math.round((hue * 60 + 360) % 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}
/** Map Discord's current semantic controls as well as legacy brand tokens. */
export function accentVariables(input: string): string[] {
    const accent = color(input),
        hover = mixHex(accent, 0.9),
        active = mixHex(accent, 0.8);
    const values: Record<string, string> = {};
    const set = (keys: string[], value: string) => {
        for (const key of keys) values[key] = value;
    };
    set(
        [
            "--byaflux-ctm-accent",
            "--brand-500",
            "--brand-experiment",
            "--brand-360",
            "--brand-400",
            "--brand-460",
            "--blurple-50",
            "--text-brand",
            "--icon-brand",
            "--text-link",
            "--control-brand-foreground",
            "--control-brand-foreground-new",
            "--button-filled-brand-background",
            "--background-brand",
            "--focus-primary",
            "--mention-foreground"
        ],
        accent
    );
    set(["--brand-560", "--blurple-60", "--button-filled-brand-background-hover"], hover);
    set(["--brand-600", "--blurple-65", "--button-filled-brand-background-active"], active);
    for (const [token, value] of [
        ["--brand-500", accent],
        ["--brand-560", hover],
        ["--brand-600", active],
        ["--blurple-50", accent],
        ["--blurple-60", hover],
        ["--blurple-65", active]
    ])
        values[token + "-hsl"] = hsl(value);
    for (const [state, background] of [
        ["default", accent],
        ["hover", hover],
        ["active", active]
    ]) {
        set([`--control-primary-background-${state}`, `--control-primary-border-${state}`], background);
        set([`--control-primary-text-${state}`, `--control-primary-icon-${state}`], accentText(background));
    }
    for (const control of ["switch", "checkbox", "radio"]) {
        for (const [state, background] of [
            ["default", accent],
            ["hover", hover]
        ])
            set(
                [`--${control}-background-selected-${state}`, `--${control}-border-selected-${state}`],
                background
            );
    }
    values["--switch-thumb-background-selected-default"] = accentText(accent);
    values["--checkbox-icon-active"] = accentText(accent);
    values["--radio-thumb-background-active"] = accentText(accent);
    values["--mention-background"] = `color-mix(in srgb, ${accent} 15%, transparent)`;
    for (const opacity of [15, 30])
        values[`--brand-experiment-${opacity}a`] = `color-mix(in srgb, ${accent} ${opacity}%, transparent)`;
    return Object.entries(values).map(([key, value]) => `${key}: ${value} !important`);
}

export function themeRules(input: ThemeChoices): string {
    const c = validateChoices(input);
    const p = c.palette;
    const vars = [
        ...accentVariables(c.accent),
        ...["--background-primary", "--background-base-low", "--bg-base-primary"].map(
            key => `${key}: ${p.chat} !important`
        ),
        ...[
            "--background-secondary",
            "--background-base-lower",
            "--background-surface-high",
            "--bg-base-secondary"
        ].map(key => `${key}: ${p.sidebar} !important`),
        ...[
            "--background-tertiary",
            "--background-secondary-alt",
            "--background-base-lowest",
            "--background-surface-higher",
            "--background-surface-highest",
            "--bg-base-tertiary"
        ].map(key => `${key}: ${p.servers} !important`),
        ...[
            "--channeltextarea-background",
            "--input-background",
            "--background-mod-subtle",
            "--background-modifier-selected"
        ].map(key => `${key}: ${p.surface} !important`),
        ...[
            "--text-normal",
            "--text-primary",
            "--header-primary",
            "--interactive-active",
            "--channels-default-selected"
        ].map(key => `${key}: ${p.text} !important`),
        ...[
            "--text-muted",
            "--text-secondary",
            "--header-secondary",
            "--channels-default",
            "--interactive-normal"
        ].map(key => `${key}: ${p.muted} !important`),
        `--font-primary: ${FONTS[c.typography.font].family} !important`,
        `--font-display: ${FONTS[c.typography.font].family} !important`,
        `--byaflux-ctm-font-size: ${c.typography.size}px`,
        `--byaflux-ctm-line-height: ${c.typography.lineHeight}`,
        `--byaflux-ctm-font-weight: ${c.typography.weight}`,
        `--byaflux-ctm-message-gap: ${c.layout.messageGap}px`,
        `--byaflux-ctm-radius: ${c.layout.radius}px`,
        `--custom-guild-sidebar-width: ${c.compact ? 240 : c.layout.sidebarWidth}px`
    ];
    if (c.compact) vars.push("--custom-guild-list-width: 64px");
    if (c.status.mode === "radial") {
        for (const [i, size] of ["small", "medium", "large"].entries())
            vars.push(
                `--rs-${size}-spacing: ${c.status.gaps[i]}px`,
                `--rs-${size}-width: ${c.status.widths[i]}px`
            );
        vars.push(
            "--rs-avatar-shape: 50%",
            ...Object.entries(c.status.colors).map(
                ([key, value]) => `--rs-${key === "speaking" ? "self-speaking" : key}-color: ${value}`
            ),
            "--rs-phone-color: var(--rs-online-color)",
            "--rs-phone-visible: block"
        );
    }
    let css = `:root, .theme-dark, .theme-light, .theme-darker, .theme-midnight {\n  ${vars.join(";\n  ")};\n}\n`;
    css +=
        '#app-mount { font-family: var(--font-primary); color: var(--text-normal); }\n#app-mount :is([class*="messageContent_"], .ctm-message-text) { font-family: var(--font-primary) !important; font-size: var(--byaflux-ctm-font-size) !important; line-height: var(--byaflux-ctm-line-height) !important; font-weight: var(--byaflux-ctm-font-weight) !important; }\n#app-mount :is([class*="messageListItem_"], .message) { margin-top: var(--byaflux-ctm-message-gap) !important; }\n#app-mount :is([class*="channelTextArea_"], [class*="embedFull_"], .composer) { border-radius: var(--byaflux-ctm-radius) !important; }\n';

    if (c.icons.shape !== "native") {
        const guild =
            ':is(nav[class*="guilds_"], [data-list-id="guildsnav"]) :is([data-list-item-id^="guildsnav___"], [class*="blobContainer_"])';
        css += `${guild} foreignObject:has(img[class*="icon_"]) { mask: none !important; -webkit-mask: none !important; }\n${guild} img[class*="icon_"] { border-radius: 0 !important; clip-path: ${iconClip(c.icons.shape, c.icons.radius)} !important; }\n`;
    }
    if (c.compact) css += 'nav[class*="guilds_"] { width: var(--custom-guild-list-width) !important; }\n';
    if (c.background.enabled) {
        const alpha = c.background.opacity / 100;
        css += `#app-mount { position: relative; isolation: isolate; background: transparent !important; }\n#app-mount::before { content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none; background: linear-gradient(rgb(18 19 23 / ${alpha}), rgb(18 19 23 / ${alpha})), url(${JSON.stringify(c.background.url)}) ${c.background.position ?? "center"} / cover; filter: blur(${c.background.blur ?? 0}px); transform: scale(1.05); }\n`;
        css +=
            '#app-mount :is([class*="bg_"], [class*="base_"], [class*="sidebar_"], [class*="sidebarList_"], [class*="chat_"], [class*="chatContent_"], [class*="members_"], [class*="container_"]:has(> [class*="members_"])) { background-color: transparent !important; }\n';
    }
    return css;
}
export function generateTheme(document: CtmDocument): string {
    const name = validateName(document.name);
    const choices = validateChoices(document.choices);
    if (!/^[a-z0-9-]{16,64}$/i.test(document.id)) throw new Error("Identificador CTM inválido.");
    const metadata = encodeURIComponent(JSON.stringify({ schema: 1, id: document.id, name, choices }));
    return `/**\n * @name ${name}\n * @author ByaFlux CTM, Gibbu (RadialStatus), DevilBro (EmojiReplace)\n * @version 1.0.0\n * @description Tema criado no Criador de temas do ByaFlux.\n * @source https://github.com/ByaFlux/byaflux\n * @byafluxCTM ${metadata}\n */\n${themeModules(
        choices
    )
        .map(module => `@import url("${module.url}");`)
        .join("\n")}\n\n${themeRules(choices)}`;
}
export function parseTheme(css: string): CtmDocument | null {
    const match = /^ \* @byafluxCTM ([^\r\n]+)$/m.exec(css);
    if (!match) return null;
    try {
        const data = JSON.parse(decodeURIComponent(match[1]));
        if (data.schema !== 1 || typeof data.id !== "string" || !/^[a-z0-9-]{16,64}$/i.test(data.id))
            return null;
        return {
            schema: 1,
            id: data.id,
            name: validateName(data.name),
            choices: validateChoices(data.choices)
        };
    } catch {
        return null;
    }
}
