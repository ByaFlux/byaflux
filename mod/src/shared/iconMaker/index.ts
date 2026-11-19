/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const BODIES = {
    base: "Base",
    cat: "Gato",
    robot: "Robô",
    ghost: "Fantasma",
    fox: "Raposa",
    crown: "Coroa",
    hat: "Chapéu",
    headset: "Headset",
    wings: "Asas",
    horns: "Chifres"
} as const;
export const EYES = {
    normal: "Normal",
    happy: "Feliz",
    wink: "Piscando",
    hearts: "Corações",
    angry: "Bravo",
    stars: "Estrelas",
    sleepy: "Sono",
    shine: "Brilho",
    none: "Sem olhos"
} as const;
export const MOTIONS = {
    none: "Nenhum",
    float: "Flutuar",
    bounce: "Pular",
    pulse: "Pulsar",
    spin: "Girar",
    swing: "Balançar",
    shake: "Tremor",
    stretch: "Esticar",
    orbit: "Orbitar",
    flip: "Virar",
    blink: "Piscar"
} as const;
export const EFFECTS = {
    none: "Sem efeito",
    stripes: "Listras",
    rays: "Raios",
    rings: "Anéis",
    dots: "Partículas",
    sparkles: "Estrelas",
    hearts: "Corações",
    grid: "Grade"
} as const;
export const PALETTE = [
    "#5865f2",
    "#7289da",
    "#ff8038",
    "#ed4245",
    "#eb459e",
    "#9b6dff",
    "#3ba55c",
    "#00b0b8",
    "#111318",
    "#ffffff"
];
export interface IconProject {
    schema: 1;
    mode: "static" | "animated";
    classic: boolean;
    body: keyof typeof BODIES;
    eyes: keyof typeof EYES;
    bodyColor: string;
    eyeColor: string;
    background: "solid" | "gradient" | "transparent" | "image";
    backgroundColor: string;
    backgroundColor2: string;
    backgroundShape: "square" | "rounded" | "circle";
    backgroundImage: string;
    foregroundImage: string;
    scale: number;
    rotation: number;
    motion: keyof typeof MOTIONS;
    effect: keyof typeof EFFECTS;
    effectColor: string;
    effectLayer: "behind" | "front";
    speed: number;
    fps: 12 | 20 | 24;
    pngSize: 128 | 256 | 512 | 1024;
    gifSize: 128 | 256 | 512;
}
export const defaultProject = (): IconProject => ({
    schema: 1,
    mode: "static",
    classic: false,
    body: "base",
    eyes: "normal",
    bodyColor: "#ffffff",
    eyeColor: "#191b22",
    background: "solid",
    backgroundColor: "#ff8038",
    backgroundColor2: "#9b6dff",
    backgroundShape: "square",
    backgroundImage: "",
    foregroundImage: "",
    scale: 100,
    rotation: 0,
    motion: "float",
    effect: "none",
    effectColor: "#ffffff",
    effectLayer: "behind",
    speed: 1,
    fps: 20,
    pngSize: 512,
    gifSize: 256
});
function color(value: unknown): string {
    if (typeof value !== "string" || !/^#[a-f\d]{6}$/i.test(value)) throw Error("Use uma cor no formato #RRGGBB.");
    return value.toLowerCase();
}
function choice<T extends string | number>(value: unknown, options: readonly T[]): T {
    if (!options.includes(value as T)) throw Error("Opção do IconMaker inválida.");
    return value as T;
}
function number(value: unknown, min: number, max: number): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
        throw Error("Medida do IconMaker fora do intervalo.");
    return value;
}
function image(value: unknown): string {
    if (value === "") return "";
    if (typeof value !== "string" || value.length > 4200000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(value))
        throw Error("A imagem local não é um PNG válido.");
    return value;
}
export function validateProject(value: unknown): IconProject {
    if (!value || typeof value !== "object") throw Error("Projeto do IconMaker inválido.");
    const v = value as IconProject;
    if (v.schema !== 1 || typeof v.classic !== "boolean") throw Error("Versão do projeto não suportada.");
    return {
        schema: 1,
        mode: choice(v.mode, ["static", "animated"]),
        classic: v.classic,
        body: choice(v.body, Object.keys(BODIES) as (keyof typeof BODIES)[]),
        eyes: choice(v.eyes, Object.keys(EYES) as (keyof typeof EYES)[]),
        bodyColor: color(v.bodyColor),
        eyeColor: color(v.eyeColor),
        background: choice(v.background, ["solid", "gradient", "transparent", "image"]),
        backgroundColor: color(v.backgroundColor),
        backgroundColor2: color(v.backgroundColor2),
        backgroundShape: choice(v.backgroundShape, ["square", "rounded", "circle"]),
        backgroundImage: image(v.backgroundImage),
        foregroundImage: image(v.foregroundImage),
        scale: number(v.scale, 50, 140),
        rotation: number(v.rotation, -180, 180),
        motion: choice(v.motion, Object.keys(MOTIONS) as (keyof typeof MOTIONS)[]),
        effect: choice(v.effect, Object.keys(EFFECTS) as (keyof typeof EFFECTS)[]),
        effectColor: color(v.effectColor),
        effectLayer: choice(v.effectLayer, ["behind", "front"]),
        speed: number(v.speed, 0.5, 2),
        fps: choice(v.fps, [12, 20, 24]),
        pngSize: choice(v.pngSize, [128, 256, 512, 1024]),
        gifSize: choice(v.gifSize, [128, 256, 512])
    };
}
export function exportName(value: string): string {
    const name = value.normalize("NFC").trim();
    if (
        !name ||
        name.length > 64 ||
        /[<>:"/\\|?*\x00-\x1f]/.test(name) ||
        name.endsWith(".") ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
    )
        throw Error("Use um nome de até 64 caracteres, sem barras ou caracteres reservados.");
    return name;
}
export function animationTiming(project: IconProject) {
    const duration = 2000 / project.speed;
    const frames = Math.max(12, Math.min(72, Math.round((duration / 1000) * project.fps)));
    return { frames, delay: Math.max(20, Math.round(duration / frames / 10) * 10), duration };
}
export function randomProject(current: IconProject, random = Math.random): IconProject {
    const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length) % items.length];
    return {
        ...current,
        body: pick(Object.keys(BODIES) as IconProject["body"][]),
        eyes: pick(Object.keys(EYES) as IconProject["eyes"][]),
        backgroundColor: pick(PALETTE),
        backgroundColor2: pick(PALETTE),
        effect: current.mode === "animated" ? pick(Object.keys(EFFECTS) as IconProject["effect"][]) : current.effect,
        motion: pick(Object.keys(MOTIONS).filter(key => key !== "none") as IconProject["motion"][])
    };
}
