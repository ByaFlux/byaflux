/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { catalog, renderEffect, rounded, sampleAnimation, svgTransform } from "./animation";
import { FRONT_EFFECTS, IconProject, validateProject } from "./index";

export function renderIcon(input: IconProject, inputPhase = 0, prefix = "iconmaker", size = 256): string {
    const c = validateProject(input);
    if (!/^[a-z][a-z0-9-]{0,64}$/i.test(prefix)) throw Error("Identificador de prévia inválido.");
    if (!Number.isFinite(inputPhase) || ![128, 256, 512, 1024].includes(size))
        throw Error("Dimensão ou quadro inválido.");
    const phase = c.mode === "animated" ? ((inputPhase % 1) + 1) % 1 : 0;
    const shapes = c.classic ? catalog.classic : catalog.modern;
    const radius = c.backgroundShape === "circle" ? 128 : c.backgroundShape === "rounded" ? 48 : 0;
    const clip = `<rect width="256" height="256" rx="${radius}"/>`;
    const backgroundScale = c.backgroundScale / 100;
    const background =
        c.background === "transparent"
            ? ""
            : c.background === "image" && c.backgroundImage
              ? `<g transform="translate(128 128) scale(${backgroundScale}) translate(-128 -128)"><image href="${c.backgroundImage}" width="256" height="256" preserveAspectRatio="xMidYMid meet"/></g>`
              : `<rect width="256" height="256" fill="${c.background === "gradient" ? `url(#${prefix}-gradient)` : c.backgroundColor}"/>`;
    const frame = sampleAnimation(c.mode === "animated" ? c.motion : "none", phase);
    const avatar = c.foregroundImage
        ? `<image href="${c.foregroundImage}" width="256" height="256" preserveAspectRatio="xMidYMid meet"/>`
        : `<g transform="scale(2)"><g color="${c.bodyColor}"${c.eyeAuto ? ` clip-path="url(#${prefix}-eyes)"` : ""}>${shapes.bodies[c.body]}</g>${c.eyeAuto ? "" : `<g color="${c.eyeColor}">${shapes.eyes[c.eyes]}</g>`}</g>`;
    const fx = c.mode === "animated" ? renderEffect(c.effect, phase, c.effectAuto ? c.bodyColor : c.effectColor) : "";
    const front = c.effectLayer === "front" || (c.effectLayer === "auto" && FRONT_EFFECTS.includes(c.effect));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" role="img" aria-label="Ícone do ByaFlux"><defs><linearGradient id="${prefix}-gradient" x2="1" y2="1"><stop stop-color="${c.backgroundColor}"/><stop offset="1" stop-color="${c.backgroundColor2}"/></linearGradient><clipPath id="${prefix}-clip">${clip}</clipPath><clipPath id="${prefix}-eyes">${shapes.cuts[c.eyes]}</clipPath></defs><g clip-path="url(#${prefix}-clip)">${background}${!front ? fx : ""}<g data-im-motion="true" opacity="${rounded(frame.opacity)}" transform="${svgTransform(frame, 256, 256)}"><g transform="translate(128 128) rotate(${c.rotation}) scale(${c.scale / 100}) translate(-128 -128)">${avatar}</g></g>${front ? fx : ""}</g></svg>`;
}

/** Update only transforms; keep the catalog geometry mounted during live playback. */
export function applyIconPhase(root: Element, project: IconProject, phase: number): void {
    const current = project.mode === "animated" ? ((phase % 1) + 1) % 1 : 0;
    const body = root.querySelector("[data-im-motion]");
    const motion = sampleAnimation(project.mode === "animated" ? project.motion : "none", current);
    body?.setAttribute("transform", svgTransform(motion, 256, 256));
    body?.setAttribute("opacity", String(rounded(motion.opacity)));
    const effect = catalog.effects[project.effect],
        group = root.querySelector("[data-im-effect-group]");
    if (!effect || !group) return;
    const frame = sampleAnimation(effect.groupAnimation ?? "", current, effect.groupLinear);
    group.setAttribute("transform", svgTransform(frame, 256, 256));
    group.setAttribute("opacity", String(rounded((effect.opacity ?? 1) * frame.opacity)));
    for (const [index, layer] of effect.layers.entries()) {
        const element = group.querySelector(`[data-im-layer="${index}"]`),
            state = sampleAnimation(layer.animation, current, layer.linear, layer.opacity);
        element?.setAttribute("transform", svgTransform(state, layer.width, layer.height, layer.x, layer.y));
        element?.setAttribute("opacity", String(rounded(state.opacity)));
    }
}

export function silhouetteThumbnail(kind: "bodies" | "eyes", name: string, classic: boolean): string {
    const shapes = classic ? catalog.classic : catalog.modern;
    if (!Object.hasOwn(shapes[kind], name)) throw Error("Forma desconhecida.");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" aria-hidden="true">${kind === "eyes" ? '<circle cx="64" cy="64" r="60" fill="#b9bbbe"/>' : ""}<g color="${kind === "eyes" ? "#2f3136" : "#b9bbbe"}">${shapes[kind][name]}</g></svg>`;
}

export function effectThumbnail(name: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" aria-hidden="true">${renderEffect(name, 0.3, "#b9bbbe")}</svg>`;
}
