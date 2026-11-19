/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { applyPalette, GIFEncoder, quantize } from "gifenc";

import { animationTiming, IconProject, validateProject } from "./index";
import { renderIcon } from "./render";

const cancelled = (signal?: AbortSignal) => {
    if (signal?.aborted) throw new DOMException("Exportação cancelada.", "AbortError");
};
function loadImage(blob: Blob, signal?: AbortSignal): Promise<HTMLImageElement> {
    cancelled(signal);
    return new Promise((resolve, reject) => {
        const image = new Image(),
            url = URL.createObjectURL(blob);
        const finish = (error?: Error) => {
            clearTimeout(timeout);
            signal?.removeEventListener("abort", abort);
            image.onload = image.onerror = null;
            URL.revokeObjectURL(url);
            error ? reject(error) : resolve(image);
        };
        const abort = () => finish(new DOMException("Exportação cancelada.", "AbortError"));
        const timeout = setTimeout(() => finish(Error("A imagem demorou demais para carregar.")), 10000);
        image.onload = () => finish();
        image.onerror = () => finish(Error("Não foi possível decodificar a imagem."));
        signal?.addEventListener("abort", abort, { once: true });
        image.src = url;
    });
}
export async function readLocalImage(file: File): Promise<string> {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024)
        throw Error("Escolha uma imagem PNG, JPG ou WebP de até 8 MB.");
    const image = await loadImage(file);
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40000000)
        throw Error("A imagem é muito grande. Reduza para até 40 megapixels.");
    const canvas = document.createElement("canvas");
    for (const maximum of [1024, 512]) {
        const scale = Math.min(1, maximum / Math.max(image.naturalWidth, image.naturalHeight));
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) throw Error("Canvas indisponível.");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const result = canvas.toDataURL("image/png");
        if (result.length <= 4200000) return result;
    }
    throw Error("Não foi possível reduzir a imagem para o projeto.");
}
async function drawFrame(canvas: HTMLCanvasElement, project: IconProject, phase: number, signal?: AbortSignal) {
    const svg = renderIcon(project, phase, "iconmaker-export", canvas.width);
    const image = await loadImage(new Blob([svg], { type: "image/svg+xml" }), signal);
    cancelled(signal);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw Error("Canvas indisponível.");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return context;
}
export async function exportPng(input: IconProject, phase = 0, signal?: AbortSignal): Promise<Blob> {
    const project = validateProject(input),
        canvas = document.createElement("canvas");
    canvas.width = canvas.height = project.pngSize;
    await drawFrame(canvas, project, phase, signal);
    const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
            result => (result ? resolve(result) : reject(Error("Não foi possível gerar o PNG."))),
            "image/png"
        )
    );
    cancelled(signal);
    return blob;
}
export async function exportGif(
    input: IconProject,
    progress: (value: number) => void,
    signal?: AbortSignal
): Promise<Blob> {
    const project = validateProject(input);
    if (project.mode !== "animated") throw Error("Selecione o modo Animado para exportar GIF.");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = project.gifSize;
    const gif = GIFEncoder(),
        timing = animationTiming(project);
    for (let frame = 0; frame < timing.frames; frame++) {
        cancelled(signal);
        const context = await drawFrame(canvas, project, frame / timing.frames, signal);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        const palette = quantize(data, 256, { format: "rgba4444", oneBitAlpha: true });
        const indexed = applyPalette(data, palette, "rgba4444"),
            transparentIndex = palette.findIndex(entry => entry[3] === 0);
        gif.writeFrame(indexed, canvas.width, canvas.height, {
            palette,
            transparent: transparentIndex >= 0,
            transparentIndex: Math.max(0, transparentIndex),
            delay: timing.delay,
            repeat: 0,
            dispose: 2
        });
        progress((frame + 1) / timing.frames);
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    cancelled(signal);
    gif.finish();
    return new Blob([new Uint8Array(gif.bytes()).buffer], { type: "image/gif" });
}
