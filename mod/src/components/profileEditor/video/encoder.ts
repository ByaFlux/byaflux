/* ByaFlux. GPL-3.0-or-later. */
import { applyPalette, GIFEncoder, quantize } from "gifenc";
export const MAX_GIF_BYTES = 8 * 1024 * 1024;
export const MAX_CLIP_SECONDS = 10;
export interface VideoOptions {
  start: number;
  end: number;
  size: number;
  fps: number;
  zoom: number;
  x: number;
  y: number;
}
export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
}
export interface ConvertedGif {
  blob: Blob;
  width: number;
  fps: number;
  duration: number;
  optimized: boolean;
}
function cancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Conversão cancelada.", "AbortError");
}
function waitVideo(
  video: HTMLVideoElement,
  event: string,
  signal?: AbortSignal,
  action?: () => void,
): Promise<void> {
  cancelled(signal);
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener(event, done);
      video.removeEventListener("error", failed);
      signal?.removeEventListener("abort", abort);
    };
    const done = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(Error("Não foi possível decodificar esse vídeo. Tente um MP4 H.264 ou WebM."));
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Conversão cancelada.", "AbortError"));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(Error("O vídeo demorou demais para carregar. Tente outro arquivo."));
    }, 15000);
    video.addEventListener(event, done, { once: true });
    video.addEventListener("error", failed, { once: true });
    signal?.addEventListener("abort", abort, { once: true });
    try {
      action?.();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
async function openVideo(file: File, signal?: AbortSignal) {
  if (
    (!file.type.startsWith("video/") && !/\.(mp4|webm|mov|m4v)$/i.test(file.name)) ||
    !file.size ||
    file.size > 100 * 1024 * 1024
  )
    throw Error("Escolha um vídeo MP4, WebM ou MOV de até 100 MB.");
  const video = document.createElement("video"),
    url = URL.createObjectURL(file);
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.style.cssText =
    "position:fixed;left:-10000px;width:2px;height:2px;opacity:0;pointer-events:none";
  document.body.appendChild(video);
  const close = () => {
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
  };
  try {
    await waitVideo(video, "loadedmetadata", signal, () => {
      video.src = url;
      video.load();
    });
    if (
      !Number.isFinite(video.duration) ||
      video.duration <= 0 ||
      !video.videoWidth ||
      !video.videoHeight
    )
      throw Error("O vídeo não tem duração ou resolução válida.");
    return { video, close };
  } catch (e) {
    close();
    throw e;
  }
}
export async function inspectVideo(file: File, signal?: AbortSignal): Promise<VideoInfo> {
  const { video, close } = await openVideo(file, signal);
  try {
    return { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
  } finally {
    close();
  }
}
export function validateOptions(options: VideoOptions, duration: number): VideoOptions {
  if (
    Object.values(options).some((v) => !Number.isFinite(v)) ||
    options.start < 0 ||
    options.end <= options.start ||
    options.end > duration + 0.001 ||
    options.end - options.start > MAX_CLIP_SECONDS + 0.001
  )
    throw Error("Escolha um trecho válido de até 10 segundos.");
  if (
    ![128, 256, 384, 512].includes(options.size) ||
    ![10, 15, 20].includes(options.fps) ||
    options.zoom < 1 ||
    options.zoom > 3 ||
    options.x < 0 ||
    options.x > 100 ||
    options.y < 0 ||
    options.y > 100
  )
    throw Error("Verifique os ajustes de qualidade e enquadramento.");
  return options;
}
export function cropRect(
  width: number,
  height: number,
  options: Pick<VideoOptions, "zoom" | "x" | "y">,
) {
  const side = Math.min(width, height) / options.zoom;
  return {
    x: ((width - side) * options.x) / 100,
    y: ((height - side) * options.y) / 100,
    size: side,
  };
}
export function encodingAttempts(size: number, fps: number) {
  return [
    { size, fps },
    { size: Math.min(size, 256), fps: Math.min(fps, 12) },
    { size: Math.min(size, 192), fps: 10 },
    { size: 128, fps: 8 },
  ].filter((v, i, a) => a.findIndex((x) => x.size === v.size && x.fps === v.fps) === i);
}
export function createFrameEncoder(size: number, fps: number) {
  const gif = GIFEncoder();
  let frame = 0;
  return {
    add(data: Uint8ClampedArray, finalDelay?: number) {
      const palette = quantize(data, 256);
      const pixels = applyPalette(data, palette);
      gif.writeFrame(pixels, size, size, {
        palette,
        delay:
          finalDelay ??
          (Math.round(((frame + 1) * 100) / fps) - Math.round((frame * 100) / fps)) * 10,
        repeat: 0,
      });
      frame++;
      return gif.bytesView().byteLength;
    },
    finish() {
      gif.finish();
      return new Blob([new Uint8Array(gif.bytes()).buffer], { type: "image/gif" });
    },
  };
}
async function seek(video: HTMLVideoElement, time: number, signal?: AbortSignal) {
  cancelled(signal);
  if (Math.abs(video.currentTime - time) < 0.001) {
    if (video.readyState < 2) await waitVideo(video, "loadeddata", signal);
  } else
    await waitVideo(video, "seeked", signal, () => {
      video.currentTime = time;
    });
  cancelled(signal);
}
export async function convertVideo(
  file: File,
  options: VideoOptions,
  onProgress: (value: number) => void,
  signal?: AbortSignal,
): Promise<ConvertedGif> {
  const { video, close } = await openVideo(file, signal);
  try {
    validateOptions(options, video.duration);
    const attempts = encodingAttempts(options.size, options.fps),
      duration = options.end - options.start;
    const crop = cropRect(video.videoWidth, video.videoHeight, options);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw Error("Não foi possível iniciar a conversão neste dispositivo.");
    for (let attempt = 0; attempt < attempts.length; attempt++) {
      cancelled(signal);
      const { size, fps } = attempts[attempt];
      canvas.width = canvas.height = size;
      const encoder = createFrameEncoder(size, fps),
        frames = Math.max(1, Math.ceil(duration * fps));
      let tooLarge = false;
      for (let i = 0; i < frames; i++) {
        await seek(video, Math.min(options.start + i / fps, options.end - 0.001), signal);
        context.fillStyle = "#000";
        context.fillRect(0, 0, size, size);
        context.drawImage(video, crop.x, crop.y, crop.size, crop.size, 0, 0, size, size);
        const length = encoder.add(
          context.getImageData(0, 0, size, size).data,
          i === frames - 1
            ? Math.max(10, (Math.round(duration * 100) - Math.round((i * 100) / fps)) * 10)
            : undefined,
        );
        onProgress((attempt + (i + 1) / frames) / attempts.length);
        if (length > MAX_GIF_BYTES) {
          tooLarge = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (!tooLarge) {
        const blob = encoder.finish();
        if (blob.size <= MAX_GIF_BYTES) {
          onProgress(1);
          return { blob, width: size, fps, duration, optimized: attempt > 0 };
        }
      }
    }
    throw Error("O trecho ainda ultrapassa 8 MB. Escolha um trecho mais curto.");
  } finally {
    close();
  }
}
