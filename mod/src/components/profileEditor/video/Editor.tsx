/* ByaFlux. GPL-3.0-or-later. */
import { React } from "@webpack/common";
import { cropRect, VideoInfo, VideoOptions } from "./encoder";
import { CropHandle, dragCrop, framePercent, shiftTrim, trimPoint } from "./geometry";
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
type Props = {
  sourceUrl: string;
  info: VideoInfo;
  options: VideoOptions;
  disabled: boolean;
  change(value: Partial<VideoOptions>): void;
  previewRef: React.RefObject<HTMLCanvasElement | null>;
};
export function VideoEditor({ sourceUrl, info, options, disabled, change, previewRef }: Props) {
  const video = React.useRef<HTMLVideoElement>(null),
    stage = React.useRef<HTMLDivElement>(null),
    timeline = React.useRef<HTMLDivElement>(null),
    mini = React.useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = React.useState(false),
    [position, setPosition] = React.useState(0),
    [playError, setPlayError] = React.useState("");
  const cropDrag = React.useRef<
    | {
        id: number;
        x: number;
        y: number;
        bounds: DOMRect;
        handle: CropHandle;
        initial: VideoOptions;
      }
    | undefined
  >(undefined);
  const timeDrag = React.useRef<
    | {
        id: number;
        x: number;
        bounds: DOMRect;
        edge: "start" | "end" | "move";
        initial: VideoOptions;
      }
    | undefined
  >(undefined);
  const optionsRef = React.useRef(options);
  optionsRef.current = options;
  function seek(time: number) {
    const v = video.current;
    if (!v || v.readyState === 0) return;
    const value = Math.max(0, Math.min(info.duration - 0.001, time));
    v.currentTime = value;
    setPosition(value);
  }
  React.useEffect(() => {
    const v = video.current;
    if (!v) return;
    let raf = 0;
    const draw = () => {
      const o = optionsRef.current;
      if (!v.paused && v.currentTime >= o.end) {
        v.currentTime = o.start;
      }
      if (v.readyState >= 2) {
        const r = cropRect(info.width, info.height, o);
        for (const canvas of [previewRef.current, mini.current]) {
          if (!canvas) continue;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(v, r.x, r.y, r.size, r.size, 0, 0, canvas.width, canvas.height);
          }
        }
      }
    };
    const tick = () => {
      draw();
      raf = requestAnimationFrame(tick);
    };
    const begin = () => {
      cancelAnimationFrame(raf);
      tick();
    };
    const pause = () => {
      cancelAnimationFrame(raf);
      draw();
    };
    v.addEventListener("loadeddata", draw);
    v.addEventListener("seeked", draw);
    v.addEventListener("play", begin);
    v.addEventListener("pause", pause);
    draw();
    if (!v.paused) begin();
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("loadeddata", draw);
      v.removeEventListener("seeked", draw);
      v.removeEventListener("play", begin);
      v.removeEventListener("pause", pause);
    };
  }, [sourceUrl, info.width, info.height, options.x, options.y, options.zoom, previewRef]);
  React.useEffect(() => {
    const current = video.current;
    return () => current?.pause();
  }, [sourceUrl]);
  React.useEffect(() => {
    if (disabled) video.current?.pause();
  }, [disabled]);
  function startCrop(event: React.PointerEvent, handle: CropHandle) {
    if (disabled || !stage.current || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = stage.current.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    cropDrag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      bounds,
      handle,
      initial: { ...options },
    };
    stage.current.setPointerCapture(event.pointerId);
  }
  function moveCrop(event: React.PointerEvent) {
    const d = cropDrag.current;
    if (!d || d.id !== event.pointerId || disabled) return;
    change(
      dragCrop(
        info,
        d.initial,
        d.handle,
        ((event.clientX - d.x) / d.bounds.width) * info.width,
        ((event.clientY - d.y) / d.bounds.height) * info.height,
      ),
    );
  }
  function endCrop(event: React.PointerEvent) {
    if (cropDrag.current?.id !== event.pointerId) return;
    cropDrag.current = undefined;
    if (stage.current?.hasPointerCapture(event.pointerId))
      stage.current.releasePointerCapture(event.pointerId);
  }
  function nudge(event: React.KeyboardEvent) {
    if (disabled) return;
    const step = event.shiftKey ? 0.03 : 0.005;
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-info.width * step, 0],
      ArrowRight: [info.width * step, 0],
      ArrowUp: [0, -info.height * step],
      ArrowDown: [0, info.height * step],
    };
    if (arrows[event.key]) {
      event.preventDefault();
      change(dragCrop(info, options, "move", ...arrows[event.key]));
    }
  }
  function setPoint(edge: "start" | "end", value: number) {
    const next = trimPoint(options, edge, value, info.duration);
    change(next);
    seek(edge === "start" ? next.start : Math.max(next.start, next.end - 0.001));
  }
  function startTime(event: React.PointerEvent, edge: "start" | "end" | "move") {
    if (disabled || !timeline.current || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = timeline.current.getBoundingClientRect();
    if (!bounds.width) return;
    timeDrag.current = {
      id: event.pointerId,
      x: event.clientX,
      bounds,
      edge,
      initial: { ...options },
    };
    timeline.current.setPointerCapture(event.pointerId);
  }
  function moveTime(event: React.PointerEvent) {
    const d = timeDrag.current;
    if (!d || d.id !== event.pointerId || disabled) return;
    const time = ((event.clientX - d.bounds.left) / d.bounds.width) * info.duration;
    const next =
      d.edge === "move"
        ? shiftTrim(
            d.initial,
            ((event.clientX - d.x) / d.bounds.width) * info.duration,
            info.duration,
          )
        : trimPoint(d.initial, d.edge, time, info.duration);
    change(next);
    seek(d.edge === "end" ? Math.max(next.start, next.end - 0.001) : next.start);
  }
  function endTime(event: React.PointerEvent) {
    if (timeDrag.current?.id !== event.pointerId) return;
    timeDrag.current = undefined;
    if (timeline.current?.hasPointerCapture(event.pointerId))
      timeline.current.releasePointerCapture(event.pointerId);
  }
  async function toggle() {
    const v = video.current;
    if (!v || disabled) return;
    if (!v.paused) {
      v.pause();
      return;
    }
    if (v.currentTime < options.start || v.currentTime >= options.end) seek(options.start);
    try {
      setPlayError("");
      await v.play();
    } catch {
      setPlayError("Não foi possível reproduzir o vídeo. Tente um arquivo MP4 H.264 ou WebM.");
    }
  }
  const rect = framePercent(info, options),
    duration = options.end - options.start;
  return (
    <div className="bs-video-editor">
      <div
        ref={stage}
        className={`bs-video-stage${disabled ? " is-busy" : ""}`}
        style={{
          aspectRatio: `${info.width}/${info.height}`,
          maxWidth: Math.max(1, (420 * info.width) / info.height),
        }}
        onPointerMove={moveCrop}
        onPointerUp={endCrop}
        onPointerCancel={endCrop}
        onLostPointerCapture={() => {
          cropDrag.current = undefined;
        }}
      >
        <video
          ref={video}
          key={sourceUrl}
          src={sourceUrl}
          muted
          playsInline
          preload="auto"
          draggable={false}
          onLoadedMetadata={() => seek(options.start)}
          onTimeUpdate={() => {
            if (video.current) setPosition(video.current.currentTime);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          aria-label="Vídeo com área de recorte"
        />
        <div
          className="bs-crop-box"
          role="group"
          aria-label="Área do avatar: arraste para mover ou use as setas"
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          style={{
            left: `${rect.left}%`,
            top: `${rect.top}%`,
            width: `${rect.width}%`,
            height: `${rect.height}%`,
          }}
          onPointerDown={(e) => startCrop(e, "move")}
          onKeyDown={nudge}
        >
          <div className="bs-crop-circle" aria-hidden="true" />
          {(["nw", "ne", "sw", "se"] as const).map((handle) => (
            <button
              type="button"
              key={handle}
              className={`bs-crop-handle ${handle}`}
              aria-label={`Redimensionar recorte: ${handle}`}
              disabled={disabled}
              tabIndex={-1}
              onPointerDown={(e) => startCrop(e, handle)}
            />
          ))}
        </div>
        <div className="bs-crop-mini" aria-hidden="true">
          <canvas ref={mini} width={96} height={96} />
          <span>Avatar</span>
        </div>
      </div>
      <p className="bs-drag-help">
        Arraste a seleção para posicionar. Puxe um canto para aproximar ou afastar. As setas fazem
        ajustes finos.
      </p>
      <div className="bs-play-controls">
        <button type="button" disabled={disabled} onClick={() => void toggle()}>
          {playing ? "Pausar" : "Reproduzir trecho"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            change({ x: 50, y: 50, zoom: 1 });
          }}
        >
          Centralizar recorte
        </button>
        <span>
          {clock(position)} / {clock(info.duration)}
        </span>
      </div>
      <label className="bs-label" htmlFor="bf-video-playhead">
        Percorrer o vídeo
      </label>
      <input
        id="bf-video-playhead"
        type="range"
        min={0}
        max={info.duration}
        step="0.01"
        value={position}
        disabled={disabled}
        onChange={(e) => {
          video.current?.pause();
          seek(Number(e.target.value));
        }}
      />
      <div
        ref={timeline}
        className={`bs-clip-timeline${disabled ? " is-busy" : ""}`}
        onPointerMove={moveTime}
        onPointerUp={endTime}
        onPointerCancel={endTime}
        onLostPointerCapture={() => {
          timeDrag.current = undefined;
        }}
        aria-label="Seleção do trecho"
      >
        <div
          className="bs-clip-band"
          style={{
            left: `${(options.start / info.duration) * 100}%`,
            width: `${(duration / info.duration) * 100}%`,
          }}
          onPointerDown={(e) => startTime(e, "move")}
          title="Arraste para mover o trecho inteiro"
        />
        {(["start", "end"] as const).map((edge) => (
          <div
            key={edge}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            aria-label={edge === "start" ? "Início do trecho" : "Fim do trecho"}
            aria-valuemin={0}
            aria-valuemax={info.duration}
            aria-valuenow={options[edge]}
            aria-valuetext={clock(options[edge])}
            className={`bs-clip-handle ${edge}`}
            style={{ left: `${(options[edge] / info.duration) * 100}%` }}
            onPointerDown={(e) => startTime(e, edge)}
            onKeyDown={(e) => {
              if (!disabled && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
                e.preventDefault();
                setPoint(
                  edge,
                  options[edge] + (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 1 : 0.1),
                );
              }
            }}
          />
        ))}
      </div>
      <div className="bs-clip-labels">
        <span>{clock(options.start)}</span>
        <strong>{duration.toFixed(1)} s selecionados</strong>
        <span>{clock(options.end)}</span>
      </div>
      <div className="bs-actions">
        <button type="button" disabled={disabled} onClick={() => setPoint("start", position)}>
          Marcar início aqui
        </button>
        <button type="button" disabled={disabled} onClick={() => setPoint("end", position)}>
          Marcar fim aqui
        </button>
      </div>
      <p>Arraste as alças laranjas para cortar ou a faixa para mover o trecho. Até 10 segundos.</p>
      {playError && (
        <p role="alert" className="bs-note bs-error">
          {playError}
        </p>
      )}
    </div>
  );
}
