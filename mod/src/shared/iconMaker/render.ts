/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IconProject, validateProject } from "./index";

const modern =
    "M74 79Q96 65 116 73L120 84Q128 81 136 84L140 73Q163 66 183 80C196 104 204 144 194 168Q180 182 163 186L154 170Q128 180 102 170L93 186Q73 182 59 168C51 143 59 104 74 79Z";
const classic =
    "M68 81Q93 67 115 73L120 83Q128 81 136 83L141 73Q164 68 188 81C197 112 202 143 197 169Q181 187 161 191L152 174Q128 182 104 174L95 191Q75 187 59 169C54 142 59 110 68 81Z";
const heart = "M0 6C-17-6-10-15 0-7C10-15 17-6 0 6Z";
const star = "M0-12 4-4 13-3 6 3 8 12 0 7-8 12-6 3-13-3-4-4Z";
const f = (n: number) => Number(n.toFixed(3));
function eyeShape(kind: IconProject["eyes"], x: number, right: boolean, classic: boolean) {
    const round = `<ellipse rx="${classic ? 9 : 10}" ry="${classic ? 10 : 12}"/>`;
    const shape = {
        normal: round,
        happy: '<path d="M-10 3Q0-13 10 3L6 6Q0-2-6 6Z"/>',
        wink: right ? '<path d="M-10-6 9 0-10 7-12 2-2 0-12-2Z"/>' : round,
        hearts: `<path d="${heart}" transform="scale(1.1)"/>`,
        angry: `<path d="${right ? "M-11-2 11-10 9 8Q-3 14-11-2Z" : "M11-2-11-10-9 8Q3 14 11-2Z"}"/>`,
        stars: `<path d="${star}"/>`,
        sleepy: '<rect x="-11" y="-2" width="22" height="5" rx="2"/>',
        shine: '<ellipse rx="11" ry="13"/><circle cx="-3" cy="-4" r="4" fill="white"/>',
        none: ""
    }[kind];
    return `<g transform="translate(${x} 126)">${shape}</g>`;
}
function decorations(c: IconProject) {
    const shapes = {
        base: "",
        cat: '<path d="M69 91 67 49 105 76ZM151 76 188 49 187 94Z"/>',
        robot: '<rect x="80" y="65" width="96" height="17" rx="7"/><rect x="123" y="45" width="10" height="27"/><circle cx="128" cy="41" r="9"/><rect x="46" y="113" width="18" height="35" rx="7"/><rect x="193" y="113" width="18" height="35" rx="7"/>',
        ghost: '<path d="M60 156 52 199 77 184 94 202 111 185 129 202 146 185 164 202 181 184 202 199 195 156Z"/>',
        fox: '<path d="M64 101 58 43 106 79ZM151 79 198 43 191 101Z"/><path d="M94 161 128 191 162 161Z"/>',
        crown: '<path d="M83 75 75 37 108 52 128 26 149 52 181 37 173 75Z"/>',
        hat: '<ellipse cx="128" cy="75" rx="65" ry="12"/><rect x="91" y="28" width="74" height="48" rx="9"/>',
        headset:
            '<path d="M54 125C50 33 208 33 202 125" fill="none" stroke="currentColor" stroke-width="12"/><rect x="43" y="111" width="20" height="42" rx="8"/><rect x="194" y="111" width="20" height="42" rx="8"/><path d="M200 146Q199 181 165 176" fill="none" stroke="currentColor" stroke-width="9"/><rect x="150" y="168" width="22" height="13" rx="6"/>',
        wings: '<path d="M70 107Q42 89 19 72Q12 118 52 146Q28 137 20 128Q26 173 72 165ZM186 107Q214 89 237 72Q244 118 204 146Q228 137 236 128Q230 173 184 165Z"/>',
        horns: '<path d="M74 90Q43 75 61 28Q62 66 101 75ZM155 75Q194 66 195 28Q213 75 182 90Z"/>'
    };
    return shapes[c.body];
}
function effect(c: IconProject, phase: number) {
    const angle = phase * 360;
    let shapes = "";
    if (c.effect === "stripes")
        shapes = `<g transform="translate(${f(phase * 48)} 0) rotate(-35 128 128)">${Array.from({ length: 13 }, (_, i) => `<rect x="${i * 48 - 192}" y="-256" width="20" height="768"/>`).join("")}</g>`;
    if (c.effect === "rays")
        shapes = `<g transform="rotate(${f(angle)} 128 128)">${Array.from({ length: 12 }, (_, i) => `<path d="M128 128 104-80 152-80Z" transform="rotate(${i * 30} 128 128)"/>`).join("")}</g>`;
    if (c.effect === "rings")
        shapes = Array.from(
            { length: 5 },
            (_, i) =>
                `<circle cx="128" cy="128" r="${f(((phase + i / 5) % 1) * 190)}" fill="none" stroke="currentColor" stroke-width="9"/>`
        ).join("");
    if (c.effect === "dots" || c.effect === "sparkles" || c.effect === "hearts")
        shapes = Array.from({ length: 16 }, (_, i) => {
            const x = (i * 73 + 19) % 256,
                y = (((i * 47 + 33 - phase * 256) % 256) + 256) % 256;
            return `<g transform="translate(${x} ${f(y)}) scale(${0.4 + (i % 3) * 0.2})">${c.effect === "dots" ? '<circle r="5"/>' : `<path d="${c.effect === "hearts" ? heart : star}"/>`}</g>`;
        }).join("");
    if (c.effect === "grid")
        shapes = `<g transform="translate(${f(phase * 32)} ${f(phase * 32)})">${Array.from({ length: 11 }, (_, i) => `<path d="M${i * 32 - 32}-32V288M-32 ${i * 32 - 32}H288" fill="none" stroke="currentColor" stroke-width="2"/>`).join("")}</g>`;
    return `<g color="${c.effectColor}" fill="${c.effectColor}" opacity="${c.effectLayer === "front" ? 0.32 : 0.22}">${shapes}</g>`;
}
export function renderIcon(input: IconProject, inputPhase = 0, prefix = "iconmaker", size = 256): string {
    const c = validateProject(input);
    if (!/^[a-z][a-z0-9-]{0,64}$/i.test(prefix)) throw Error("Identificador de prévia inválido.");
    if (!Number.isFinite(inputPhase) || ![128, 256, 512, 1024].includes(size))
        throw Error("Dimensão ou quadro inválido.");
    const phase = c.mode === "animated" ? ((inputPhase % 1) + 1) % 1 : 0,
        sine = Math.sin(phase * Math.PI * 2);
    const radius = c.backgroundShape === "circle" ? 128 : c.backgroundShape === "rounded" ? 48 : 0;
    const shape = `<rect width="256" height="256" rx="${radius}"/>`;
    const bg =
        c.background === "transparent"
            ? ""
            : c.background === "image" && c.backgroundImage
              ? `<image href="${c.backgroundImage}" width="256" height="256" preserveAspectRatio="xMidYMid slice"/>`
              : `<rect width="256" height="256" fill="${c.background === "gradient" ? `url(#${prefix}-gradient)` : c.backgroundColor}"/>`;
    let x = 0,
        y = 0,
        rotate = c.rotation,
        scaleX = c.scale / 100,
        scaleY = c.scale / 100;
    if (c.mode === "animated") {
        if (c.motion === "float") y = sine * 8;
        if (c.motion === "bounce") y = -Math.abs(sine) * 18;
        if (c.motion === "pulse") scaleX = scaleY = scaleX * (1 + sine * 0.09);
        if (c.motion === "spin") rotate += phase * 360;
        if (c.motion === "swing") rotate += sine * 13;
        if (c.motion === "shake") x = Math.sin(phase * Math.PI * 12) * 5;
        if (c.motion === "stretch") {
            scaleX *= 1 + sine * 0.1;
            scaleY *= 1 - sine * 0.12;
        }
        if (c.motion === "orbit") {
            x = Math.cos(phase * Math.PI * 2) * 9;
            y = sine * 9;
        }
        if (c.motion === "flip") scaleX *= Math.cos(phase * Math.PI * 2);
    }
    const blink =
        c.mode === "animated" && c.motion === "blink" && phase > 0.42 && phase < 0.58
            ? Math.max(0.06, 1 - Math.sin(((phase - 0.42) / 0.16) * Math.PI) ** 4)
            : 1;
    const avatar = c.foregroundImage
        ? `<image href="${c.foregroundImage}" x="43" y="43" width="170" height="170" preserveAspectRatio="xMidYMid meet"/>`
        : `<g fill="${c.bodyColor}" color="${c.bodyColor}">${decorations(c)}<path d="${c.classic ? classic : modern}"/></g><g fill="${c.eyeColor}" transform="translate(0 126) scale(1 ${f(blink)}) translate(0 -126)">${eyeShape(c.eyes, c.classic ? 104 : 105, false, c.classic)}${eyeShape(c.eyes, c.classic ? 152 : 151, true, c.classic)}</g>`;
    const fx = effect(c, phase);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" role="img" aria-label="Ícone do ByaFlux"><defs><linearGradient id="${prefix}-gradient" x2="1" y2="1"><stop stop-color="${c.backgroundColor}"/><stop offset="1" stop-color="${c.backgroundColor2}"/></linearGradient><clipPath id="${prefix}-clip">${shape}</clipPath></defs><g clip-path="url(#${prefix}-clip)">${bg}${c.effectLayer === "behind" ? fx : ""}<g transform="translate(${f(128 + x)} ${f(128 + y)}) rotate(${f(rotate)}) scale(${f(scaleX)} ${f(scaleY)}) translate(-128 -128)">${avatar}</g>${c.effectLayer === "front" ? fx : ""}</g></svg>`;
}
