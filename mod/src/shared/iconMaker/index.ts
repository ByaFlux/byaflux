/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const BODIES = {
    "base-shape": "Padrão",
    thick: "Largo",
    "chubby-shape": "Fofinho",
    "hanging-ears": "Orelhas caídas",
    "triangle-hair": "Franja",
    "tounge-shape": "Língua",
    devil: "Diabinho",
    angel: "Anjo",
    "top-hat": "Cartola",
    ribbon: "Laço",
    "hair-1": "Cabelo curto",
    "hair-2": "Cabelo longo",
    mohawk: "Moicano",
    headphones: "Headphones",
    "face-mask": "Máscara",
    cap: "Boné",
    "knit-cap": "Gorro",
    mustache: "Bigode",
    "mustache-top-hat": "Bigode e cartola",
    crown: "Coroa",
    "american-indian": "Cocar",
    cat: "Gato",
    mouse: "Rato",
    bunny: "Coelho",
    "ninja-band": "Ninja",
    samurai: "Samurai",
    alien: "Alien",
    "scarred-laugh": "Cicatriz",
    vampire: "Vampiro",
    "vampire-ears": "Orelhas de vampiro",
    hannibal: "Máscara de contenção",
    "base-upside-down": "Invertido",
    "thick-upside-down": "Largo invertido"
} as const;
export const EYES = {
    "base-eyes": "Padrão",
    wink: "Piscando",
    squinting: "Apertados",
    happy: "Feliz",
    angry: "Bravo",
    sad: "Triste",
    annoyed: "Entediado",
    "angry-brows": "Sobrancelhas bravas",
    sceptical: "Desconfiado",
    "mono-brow": "Monocelha",
    "female-lashes": "Cílios",
    scared: "Assustado",
    cute: "Fofos",
    "cute-downwards": "Fofos baixos",
    chubby: "Bochechas",
    "third-eye": "Terceiro olho",
    "single-eye": "Ciclope",
    "line-eyes": "Retos",
    "line-eyes-happy": "Sorriso",
    dead: "Sem vida",
    "glasses-1": "Óculos redondos",
    "glasses-2": "Óculos quadrados",
    "8-bit-shades": "Óculos 8-bit",
    sunglasses: "Óculos de sol",
    monocle: "Monóculo",
    "cat-eyes": "Gato",
    "evil-eyes": "Malignos",
    "spider-eyes": "Aranha",
    "star-eyes": "Estrelas",
    "heart-eyes": "Corações",
    "swirly-eyes": "Espirais",
    "crazy-eyes": "Maluquinhos"
} as const;
export const MOTIONS = {
    none: "Nenhum",
    "floating-animation": "Flutuar",
    "spinning-animation": "Girar e parar",
    "rotate-linear-animation": "Giro contínuo",
    "jumping-animation": "Pular",
    "spinning-y-axis-animation": "Giro no eixo Y",
    "rubber-stretch-animation": "Elástico",
    "scaling-animation": "Zoom elástico",
    "scale-fade-animation": "Zoom e desaparecer",
    "running-around-animation": "Dar a volta",
    "teleport-animation": "Teletransporte",
    "break-out-animation": "Escapar",
    "shake-dance-animation": "Dançar"
} as const;
export const EFFECTS = {
    none: "Sem efeito",
    "shiny-effect": "Brilho diagonal",
    "rotating-stripes": "Raios giratórios",
    "expanding-circles": "Círculos expansivos",
    "star-sky": "Céu estrelado",
    "rain-sky": "Chuva",
    "earth-effect": "Terra",
    "fill-up-effect": "Enchimento",
    "check-pattern": "Xadrez",
    "sparkle-effect": "Estrelas brilhantes",
    "music-notes": "Notas musicais",
    "hearts-effect": "Corações",
    "sawblade-effect": "Serra circular"
} as const;
export const PALETTE = [
    "#757e8a",
    "#5865f2",
    "#3ba3e8",
    "#3ab8ba",
    "#3ba55c",
    "#88c800",
    "#faa61a",
    "#fa7a0b",
    "#ed4245",
    "#eb459e",
    "#a072ed",
    "#ffffff",
    "#000000"
];
export const CLASSIC_PALETTE = [
    "#747f8d",
    "#7289da",
    "#3ba3e8",
    "#3ab8ba",
    "#43b581",
    "#88c800",
    "#faa61a",
    "#fa7a0b",
    "#f04747",
    "#f35ab9",
    "#9d7bd5",
    "#ffffff",
    "#000000"
];
export const FRONT_EFFECTS: string[] = [
    "shiny-effect",
    "sparkle-effect",
    "music-notes",
    "hearts-effect",
    "sawblade-effect"
];
export interface IconProject {
    schema: 2;
    mode: "static" | "animated";
    classic: boolean;
    body: keyof typeof BODIES;
    eyes: keyof typeof EYES;
    bodyColor: string;
    eyeColor: string;
    eyeAuto: boolean;
    background: "solid" | "gradient" | "transparent" | "image";
    backgroundColor: string;
    backgroundColor2: string;
    backgroundShape: "square" | "rounded" | "circle";
    backgroundImage: string;
    foregroundImage: string;
    backgroundScale: number;
    scale: number;
    rotation: number;
    motion: keyof typeof MOTIONS;
    effect: keyof typeof EFFECTS;
    effectColor: string;
    effectAuto: boolean;
    effectLayer: "auto" | "behind" | "front";
    duration: number;
    fps: 12 | 20 | 24;
    pngSize: 128 | 256 | 512 | 1024;
    gifSize: 128 | 256 | 512;
}
export const defaultProject = (): IconProject => ({
    schema: 2,
    mode: "static",
    classic: false,
    body: "base-shape",
    eyes: "base-eyes",
    bodyColor: "#ffffff",
    eyeColor: "#191b22",
    eyeAuto: true,
    background: "solid",
    backgroundColor: "#5865f2",
    backgroundColor2: "#9b6dff",
    backgroundShape: "circle",
    backgroundImage: "",
    foregroundImage: "",
    backgroundScale: 100,
    scale: 100,
    rotation: 0,
    motion: "none",
    effect: "none",
    effectColor: "#ffffff",
    effectAuto: true,
    effectLayer: "auto",
    duration: 3,
    fps: 20,
    pngSize: 512,
    gifSize: 128
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
function flag(value: unknown): boolean {
    if (typeof value !== "boolean") throw Error("Opção do IconMaker inválida.");
    return value;
}
function image(value: unknown): string {
    if (value === "") return "";
    if (typeof value !== "string" || value.length > 4200000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(value))
        throw Error("A imagem local não é um PNG válido.");
    return value;
}
function migrate(value: Record<string, any>): Record<string, any> {
    if (value.schema !== 1) return value;
    const bodies: Record<string, string> = {
        base: "base-shape",
        cat: "cat",
        robot: "alien",
        ghost: "chubby-shape",
        fox: "cat",
        crown: "crown",
        hat: "top-hat",
        headset: "headphones",
        wings: "angel",
        horns: "devil"
    };
    const eyes: Record<string, string> = {
        normal: "base-eyes",
        happy: "happy",
        wink: "wink",
        hearts: "heart-eyes",
        angry: "angry",
        stars: "star-eyes",
        sleepy: "line-eyes",
        shine: "cute",
        none: "base-eyes"
    };
    const motions: Record<string, string> = {
        none: "none",
        float: "floating-animation",
        bounce: "jumping-animation",
        pulse: "scaling-animation",
        spin: "rotate-linear-animation",
        swing: "shake-dance-animation",
        shake: "shake-dance-animation",
        stretch: "rubber-stretch-animation",
        orbit: "running-around-animation",
        flip: "spinning-y-axis-animation",
        blink: "floating-animation"
    };
    const effects: Record<string, string> = {
        none: "none",
        stripes: "shiny-effect",
        rays: "rotating-stripes",
        rings: "expanding-circles",
        dots: "star-sky",
        sparkles: "sparkle-effect",
        hearts: "hearts-effect",
        grid: "check-pattern"
    };
    return {
        ...value,
        schema: 2,
        body: bodies[value.body] ?? value.body,
        eyes: eyes[value.eyes] ?? value.eyes,
        motion: motions[value.motion] ?? value.motion,
        effect: effects[value.effect] ?? value.effect,
        eyeAuto: false,
        eyeColor: value.eyes === "none" ? value.bodyColor : value.eyeColor,
        effectAuto: false,
        backgroundScale: 100,
        duration: Math.max(1, Math.min(5, 2 / number(value.speed, 0.5, 2)))
    };
}
export function validateProject(value: unknown): IconProject {
    if (!value || typeof value !== "object") throw Error("Projeto do IconMaker inválido.");
    const v = migrate(value as Record<string, any>) as IconProject;
    if (v.schema !== 2) throw Error("Versão do projeto não suportada.");
    return {
        schema: 2,
        mode: choice(v.mode, ["static", "animated"]),
        classic: flag(v.classic),
        body: choice(v.body, Object.keys(BODIES) as (keyof typeof BODIES)[]),
        eyes: choice(v.eyes, Object.keys(EYES) as (keyof typeof EYES)[]),
        bodyColor: color(v.bodyColor),
        eyeColor: color(v.eyeColor),
        eyeAuto: flag(v.eyeAuto),
        background: choice(v.background, ["solid", "gradient", "transparent", "image"]),
        backgroundColor: color(v.backgroundColor),
        backgroundColor2: color(v.backgroundColor2),
        backgroundShape: choice(v.backgroundShape, ["square", "rounded", "circle"]),
        backgroundImage: image(v.backgroundImage),
        foregroundImage: image(v.foregroundImage),
        backgroundScale: number(v.backgroundScale, 50, 200),
        scale: number(v.scale, 50, 200),
        rotation: number(v.rotation, -180, 180),
        motion: choice(v.motion, Object.keys(MOTIONS) as (keyof typeof MOTIONS)[]),
        effect: choice(v.effect, Object.keys(EFFECTS) as (keyof typeof EFFECTS)[]),
        effectColor: color(v.effectColor),
        effectAuto: flag(v.effectAuto),
        effectLayer: choice(v.effectLayer, ["auto", "behind", "front"]),
        duration: number(v.duration, 1, 5),
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
        /[<>:"/\\|?*\x00-\x1f\x7f]/.test(name) ||
        name.endsWith(".") ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
    )
        throw Error("Use um nome de até 64 caracteres, sem barras ou caracteres reservados.");
    return name;
}
export function animationTiming(project: IconProject) {
    const duration = project.duration * 1000,
        frames = Math.max(12, Math.min(120, Math.round(project.duration * project.fps)));
    return { frames, delay: Math.max(20, Math.round(duration / frames / 10) * 10), duration };
}
export function randomProject(current: IconProject, random = Math.random): IconProject {
    const pick = <T>(items: T[]): T => items[Math.min(items.length - 1, Math.floor(random() * items.length))];
    return {
        ...current,
        body: pick(Object.keys(BODIES) as IconProject["body"][]),
        eyes: pick(Object.keys(EYES) as IconProject["eyes"][]),
        backgroundColor: pick(current.classic ? CLASSIC_PALETTE : PALETTE),
        bodyColor: random() < 0.5 ? "#ffffff" : "#000000",
        foregroundImage: "",
        effect: current.mode === "animated" ? pick(Object.keys(EFFECTS) as IconProject["effect"][]) : current.effect,
        motion:
            current.mode === "animated"
                ? pick(Object.keys(MOTIONS).filter(key => key !== "none") as IconProject["motion"][])
                : current.motion
    };
}
