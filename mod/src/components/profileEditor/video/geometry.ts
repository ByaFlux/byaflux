/* ByaFlux. GPL-3.0-or-later. */
import { cropRect, MAX_CLIP_SECONDS, VideoInfo, VideoOptions } from "./encoder";
export type CropHandle = "move" | "nw" | "ne" | "sw" | "se";
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
function asOptions(
  info: VideoInfo,
  left: number,
  top: number,
  side: number,
): Pick<VideoOptions, "x" | "y" | "zoom"> {
  side = clamp(side, Math.min(info.width, info.height) / 3, Math.min(info.width, info.height));
  const spanX = info.width - side,
    spanY = info.height - side;
  return {
    zoom: Math.min(info.width, info.height) / side,
    x: spanX > 0 ? clamp((left / spanX) * 100, 0, 100) : 50,
    y: spanY > 0 ? clamp((top / spanY) * 100, 0, 100) : 50,
  };
}
export function dragCrop(
  info: VideoInfo,
  initial: VideoOptions,
  handle: CropHandle,
  dx: number,
  dy: number,
) {
  const r = cropRect(info.width, info.height, initial);
  if (handle === "move")
    return asOptions(
      info,
      clamp(r.x + dx, 0, info.width - r.size),
      clamp(r.y + dy, 0, info.height - r.size),
      r.size,
    );
  const east = handle.endsWith("e"),
    south = handle.startsWith("s");
  const anchorX = east ? r.x : r.x + r.size,
    anchorY = south ? r.y : r.y + r.size;
  const maximum = Math.min(
    east ? info.width - anchorX : anchorX,
    south ? info.height - anchorY : anchorY,
  );
  const delta = ((east ? dx : -dx) + (south ? dy : -dy)) / 2;
  const side = clamp(
    r.size + delta,
    Math.min(info.width, info.height) / 3,
    Math.min(maximum, Math.min(info.width, info.height)),
  );
  return asOptions(info, east ? anchorX : anchorX - side, south ? anchorY : anchorY - side, side);
}
export function trimPoint(
  initial: VideoOptions,
  edge: "start" | "end",
  time: number,
  duration: number,
): Pick<VideoOptions, "start" | "end"> {
  const minimum = Math.min(0.1, duration),
    length = clamp(initial.end - initial.start, minimum, Math.min(MAX_CLIP_SECONDS, duration));
  if (edge === "start") {
    const start = clamp(time, 0, duration - minimum);
    const end =
      initial.end <= start + minimum
        ? Math.min(duration, start + length)
        : clamp(initial.end, start + minimum, Math.min(duration, start + MAX_CLIP_SECONDS));
    return { start, end };
  }
  const end = clamp(time, minimum, duration);
  const start =
    initial.start >= end - minimum
      ? Math.max(0, end - length)
      : clamp(initial.start, Math.max(0, end - MAX_CLIP_SECONDS), end - minimum);
  return { start, end };
}
export function shiftTrim(
  initial: VideoOptions,
  delta: number,
  duration: number,
): Pick<VideoOptions, "start" | "end"> {
  const length = Math.min(initial.end - initial.start, duration, MAX_CLIP_SECONDS),
    start = clamp(initial.start + delta, 0, duration - length);
  return { start, end: start + length };
}
export function framePercent(info: VideoInfo, options: VideoOptions) {
  const r = cropRect(info.width, info.height, options);
  return {
    left: (r.x / info.width) * 100,
    top: (r.y / info.height) * 100,
    width: (r.size / info.width) * 100,
    height: (r.size / info.height) * 100,
  };
}
