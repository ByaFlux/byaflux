/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import rawCatalog from "./catalog.json";

export interface Frame {
    offset: number;
    style: Record<string, string>;
}
export interface EffectLayer {
    id: string;
    viewBox: string;
    animation: string;
    linear: boolean;
    graphic: string;
    width: number;
    height: number;
    x: number;
    y: number;
    opacity: number;
}
export interface EffectGraphic {
    layers: EffectLayer[];
    groupAnimation?: string;
    groupLinear?: boolean;
    opacity?: number;
}
interface Silhouettes {
    bodies: Record<string, string>;
    eyes: Record<string, string>;
    cuts: Record<string, string>;
}
export const catalog = rawCatalog as {
    source: string;
    attribution: string;
    modern: Silhouettes;
    classic: Silhouettes;
    effects: Record<string, EffectGraphic>;
    keyframes: Record<string, Frame[]>;
};
export interface AnimatedTransform {
    tx: number;
    ty: number;
    mx: number;
    my: number;
    sx: number;
    sy: number;
    rotate: number;
    rotateY: number;
    skewY: number;
    opacity: number;
}
const defaults = (opacity = 1): AnimatedTransform => ({
    tx: 0,
    ty: 0,
    mx: 0,
    my: 0,
    sx: 1,
    sy: 1,
    rotate: 0,
    rotateY: 0,
    skewY: 0,
    opacity
});
const position = (value = "0") => parseFloat(value) / (value.includes("%") ? 100 : 128);
const angle = (value = "0") =>
    parseFloat(value) * (value.endsWith("turn") ? 360 : value.endsWith("rad") ? 180 / Math.PI : 1);
function transform(value: string): AnimatedTransform {
    const result = defaults();
    for (const match of value.matchAll(/([\w]+)\(([^)]+)\)/g)) {
        const [a, b] = match[2].split(/[\s,]+/).filter(Boolean);
        switch (match[1]) {
            case "translate":
                result.tx = position(a);
                result.ty = position(b);
                break;
            case "translateX":
                result.tx = position(a);
                break;
            case "translateY":
                result.ty = position(a);
                break;
            case "scale":
                result.sx = parseFloat(a);
                result.sy = parseFloat(b ?? a);
                break;
            case "scaleX":
                result.sx = parseFloat(a);
                break;
            case "scaleY":
                result.sy = parseFloat(a);
                break;
            case "rotate":
                result.rotate = angle(a);
                break;
            case "rotateY":
                result.rotateY = angle(a);
                break;
            case "skewY":
                result.skewY = angle(a);
                break;
        }
    }
    return result;
}
interface Point {
    offset: number;
    value: number;
    easing?: string;
}
type Track = Partial<Record<keyof AnimatedTransform, Point[]>>;
const tracks = new Map<string, Track>();
function compile(name: string, opacity: number): Track {
    const key = name + "|" + opacity;
    if (tracks.has(key)) return tracks.get(key)!;
    const result: Track = {},
        base = defaults(opacity);
    for (const frame of catalog.keyframes[name] ?? []) {
        const values: Partial<AnimatedTransform> = {};
        if (frame.style.transform !== undefined) {
            const parsed = transform(frame.style.transform);
            for (const property of ["tx", "ty", "sx", "sy", "rotate", "rotateY", "skewY"] as const)
                values[property] = parsed[property];
        }
        if (frame.style["margin-left"] !== undefined) values.mx = position(frame.style["margin-left"]);
        if (frame.style["margin-top"] !== undefined) values.my = position(frame.style["margin-top"]);
        if (frame.style.opacity !== undefined) values.opacity = Number(frame.style.opacity);
        for (const [property, value] of Object.entries(values))
            (result[property as keyof AnimatedTransform] ??= []).push({
                offset: frame.offset,
                value,
                easing: frame.style["animation-timing-function"]
            });
    }
    for (const [property, points] of Object.entries(result)) {
        if (points[0].offset > 0) points.unshift({ offset: 0, value: base[property as keyof AnimatedTransform] });
        if (points[points.length - 1].offset < 1)
            points.push({ offset: 1, value: base[property as keyof AnimatedTransform] });
    }
    tracks.set(key, result);
    return result;
}
function ease(value: number, kind: string) {
    if (kind === "linear" || value <= 0 || value >= 1) return value;
    const [x1, y1, x2, y2] =
        kind === "ease-in"
            ? [0.42, 0, 1, 1]
            : kind === "ease-out"
              ? [0, 0, 0.58, 1]
              : kind === "ease-in-out"
                ? [0.42, 0, 0.58, 1]
                : [0.25, 0.1, 0.25, 1];
    const curve = (t: number, p1: number, p2: number) => 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3;
    let low = 0,
        high = 1;
    for (let i = 0; i < 16; i++) {
        const mid = (low + high) / 2;
        if (curve(mid, x1, x2) < value) low = mid;
        else high = mid;
    }
    return curve((low + high) / 2, y1, y2);
}
export function sampleAnimation(name: string, phase: number, linear = false, opacity = 1): AnimatedTransform {
    const result = defaults(opacity);
    if (!name || name === "none") return result;
    for (const [property, points] of Object.entries(compile(name, opacity))) {
        let right = points.findIndex(point => point.offset > phase);
        if (right < 0) right = points.length - 1;
        const a = points[Math.max(0, right - 1)],
            b = points[right];
        const progress =
            b.offset === a.offset ? 0 : Math.max(0, Math.min(1, (phase - a.offset) / (b.offset - a.offset)));
        result[property as keyof AnimatedTransform] =
            a.value + (b.value - a.value) * ease(progress, a.easing ?? (linear ? "linear" : "ease"));
    }
    return result;
}
export const rounded = (value: number) => Number(value.toFixed(4));
export function svgTransform(frame: AnimatedTransform, width: number, height: number, x = 0, y = 0): string {
    return `translate(${rounded(x + frame.mx * 256 + frame.tx * width + width / 2)} ${rounded(y + frame.my * 256 + frame.ty * height + height / 2)}) rotate(${rounded(frame.rotate)}) skewY(${rounded(frame.skewY)}) scale(${rounded(frame.sx * Math.cos((frame.rotateY * Math.PI) / 180))} ${rounded(frame.sy)}) translate(${-width / 2} ${-height / 2})`;
}
export function renderEffect(name: string, phase: number, color: string): string {
    const graphic = catalog.effects[name];
    if (!graphic) return "";
    const layers = graphic.layers
        .map((layer, index) => {
            const frame = sampleAnimation(layer.animation, phase, layer.linear, layer.opacity),
                box = layer.viewBox.split(/\s+/).map(Number);
            return `<g data-im-layer="${index}" opacity="${rounded(frame.opacity)}" transform="${svgTransform(frame, layer.width, layer.height, layer.x, layer.y)}"><g transform="scale(${rounded(layer.width / box[2])} ${rounded(layer.height / box[3])})">${layer.graphic}</g></g>`;
        })
        .join("");
    const frame = sampleAnimation(graphic.groupAnimation ?? "", phase, graphic.groupLinear);
    return `<g data-im-effect-group="true" color="${color}" fill="${color}" opacity="${rounded((graphic.opacity ?? 1) * frame.opacity)}" transform="${svgTransform(frame, 256, 256)}">${layers}</g>`;
}

/** The live preview and SVG export sample the same timelines. */
export function applyEffectPhase(root: Element, name: string, phase: number): void {
    const graphic = catalog.effects[name],
        group = root.querySelector("[data-im-effect-group]");
    if (!graphic || !group) return;
    const current = ((phase % 1) + 1) % 1,
        frame = sampleAnimation(graphic.groupAnimation ?? "", current, graphic.groupLinear);
    group.setAttribute("transform", svgTransform(frame, 256, 256));
    group.setAttribute("opacity", String(rounded((graphic.opacity ?? 1) * frame.opacity)));
    for (const [index, layer] of graphic.layers.entries()) {
        const element = group.querySelector(`[data-im-layer="${index}"]`),
            state = sampleAnimation(layer.animation, current, layer.linear, layer.opacity);
        element?.setAttribute("transform", svgTransform(state, layer.width, layer.height, layer.x, layer.y));
        element?.setAttribute("opacity", String(rounded(state.opacity)));
    }
}
