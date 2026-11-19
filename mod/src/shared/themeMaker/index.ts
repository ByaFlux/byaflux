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
export interface ThemeChoices {
    accent: string;
    compact: boolean;
    background: { enabled: boolean; url: string; opacity: number };
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
    accent: "#ff8038",
    compact: false,
    background: { enabled: false, url: "", opacity: 75 },
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
    if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error("Use cores no formato #RRGGBB.");
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
    for (const key of Object.keys(colors) as (keyof typeof colors)[]) colors[key] = color(value.status.colors?.[key]);
    const sizes = (values: number[], min: number, max: number): [number, number, number] => {
        if (!Array.isArray(values) || values.length !== 3) throw new Error("Informe as três medidas de status.");
        return values.map(n => number(n, min, max)) as [number, number, number];
    };
    if (typeof value.background.url !== "string" || value.background.url.length > 2048)
        throw new Error("URL do fundo inválida.");
    let { url } = value.background;
    if (value.background.enabled) {
        try {
            const parsed = new URL(url);
            if (parsed.protocol !== "https:" || parsed.username || parsed.password || /[\r\n\u0000]/.test(url))
                throw new Error();
            url = parsed.href;
        } catch {
            throw new Error("O fundo deve usar uma URL HTTPS de imagem, sem credenciais.");
        }
    }
    return {
        accent: color(value.accent),
        compact: flag(value.compact),
        background: {
            enabled: flag(value.background.enabled),
            url,
            opacity: number(value.background.opacity, 0, 100)
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
export function themeModules(choices: ThemeChoices): { id: "radial" | "emoji"; url: string }[] {
    const result: { id: "radial" | "emoji"; url: string }[] = [];
    if (choices.status.mode === "radial") result.push({ id: "radial", url: RADIAL_URL });
    if (choices.emoji !== "Discord") result.push({ id: "emoji", url: `${EMOJI_BASE}/base/${choices.emoji}.css` });
    return result;
}
export function themeRules(input: ThemeChoices): string {
    const c = validateChoices(input);
    const vars = [
        `--byaflux-ctm-accent: ${c.accent}`,
        `--brand-500: ${c.accent}`,
        `--brand-experiment: ${c.accent}`,
        `--brand-560: color-mix(in srgb, ${c.accent} 80%, black)`,
        `--brand-600: color-mix(in srgb, ${c.accent} 65%, black)`
    ];
    if (c.compact) vars.push("--custom-guild-list-width: 64px", "--custom-guild-sidebar-width: 240px");
    if (c.status.mode === "radial") {
        for (const [i, size] of ["small", "medium", "large"].entries())
            vars.push(`--rs-${size}-spacing: ${c.status.gaps[i]}px`, `--rs-${size}-width: ${c.status.widths[i]}px`);
        vars.push(
            "--rs-avatar-shape: 50%",
            ...Object.entries(c.status.colors).map(
                ([key, value]) => `--rs-${key === "speaking" ? "self-speaking" : key}-color: ${value}`
            ),
            "--rs-phone-color: var(--rs-online-color)",
            "--rs-phone-visible: block"
        );
    }
    let css = `:root {\n  ${vars.join(";\n  ")};\n}\n`;
    if (c.icons.shape !== "native") {
        const guild = 'nav[class*="guilds_"] :is([data-list-item-id^="guildsnav___"], [class*="blobContainer_"])';
        css += `${guild} foreignObject:has(img[class*="icon_"]) { mask: none !important; -webkit-mask: none !important; }\n${guild} img[class*="icon_"] { border-radius: 0 !important; clip-path: ${iconClip(c.icons.shape, c.icons.radius)} !important; }\n`;
    }
    if (c.compact) css += 'nav[class*="guilds_"] { width: var(--custom-guild-list-width) !important; }\n';
    if (c.background.enabled)
        css += `#app-mount { background: linear-gradient(rgb(18 19 23 / ${c.background.opacity / 100}), rgb(18 19 23 / ${c.background.opacity / 100})), url(${JSON.stringify(c.background.url)}) center / cover fixed !important; }\n#app-mount :is([class*="chat_"], [class*="chatContent_"], [class*="sidebar_"], [class*="sidebarList_"], [class*="members_"], [class*="container_"]:has(> [class*="members_"])) { background-color: transparent !important; }\n`;
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
        if (data.schema !== 1 || typeof data.id !== "string" || !/^[a-z0-9-]{16,64}$/i.test(data.id)) return null;
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
