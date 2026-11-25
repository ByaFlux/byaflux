/* ByaFlux. GPL-3.0-or-later. */
import "@shared/profileStudio.css";
import { saveFile } from "@utils/web";
import { React, UserStore, useStateFromStores } from "@webpack/common";
import { ConvertedGif, convertVideo, inspectVideo, VideoInfo, VideoOptions } from "./encoder";
import { useGifAvatar } from "./runtime";
import { VideoEditor } from "./Editor";
const initial: VideoOptions = { start: 0, end: 3, size: 256, fps: 15, zoom: 1, x: 50, y: 50 };
export function VideoGifPanel({ onApplied }: { onApplied?: () => void } = {}) {
  const account = useStateFromStores([UserStore], () => UserStore.getCurrentUser()?.id);
  const [file, setFile] = React.useState<File>();
  const [info, setInfo] = React.useState<VideoInfo>();
  const [options, setOptions] = React.useState<VideoOptions>(initial);
  const [result, setResult] = React.useState<ConvertedGif>();
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [gifUrl, setGifUrl] = React.useState("");
  const [showFinal, setShowFinal] = React.useState(false);
  const previewCanvas = React.useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const input = React.useRef<HTMLInputElement>(null);
  const controller = React.useRef<AbortController | undefined>(undefined);
  const generation = React.useRef(0),
    alive = React.useRef(true);
  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
      controller.current?.abort();
    };
  }, []);
  React.useEffect(() => {
    if (!file) {
      setSourceUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  React.useEffect(() => {
    if (!result) {
      setGifUrl("");
      return;
    }
    const url = URL.createObjectURL(result.blob);
    setGifUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);
  React.useEffect(() => {
    controller.current?.abort();
    generation.current++;
    setBusy(false);
    setFile(undefined);
    setInfo(undefined);
    setResult(undefined);
    setError("");
    setMessage("");
  }, [account]);
  const change = (patch: Partial<VideoOptions>) => {
    setOptions((v) => ({ ...v, ...patch }));
    setResult(undefined);
    setShowFinal(false);
    setMessage("");
    setError("");
  };
  async function generate(source: File, settings: VideoOptions, probe = false) {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const run = ++generation.current;
    setBusy(true);
    setError("");
    setMessage("");
    setProgress(0);
    setResult(undefined);
    try {
      let selected = settings;
      if (probe) {
        const metadata = await inspectVideo(source, abort.signal);
        if (!alive.current || run !== generation.current) return;
        setInfo(metadata);
        selected = { ...initial, end: Math.min(3, metadata.duration) };
        setOptions(selected);
      }
      const output = await convertVideo(
        source,
        selected,
        (value) => {
          if (alive.current && run === generation.current) setProgress(value);
        },
        abort.signal,
      );
      if (alive.current && run === generation.current) {
        setResult(output);
        setShowFinal(true);
        setMessage(
          output.optimized
            ? "GIF pronto. A qualidade foi ajustada para ficar abaixo de 8 MB."
            : "GIF pronto! Confira a prévia e escolha como usar.",
        );
      }
    } catch (e) {
      if (alive.current && run === generation.current) {
        if ((e as Error).name === "AbortError") setMessage("Conversão cancelada.");
        else setError((e as Error).message);
      }
    } finally {
      if (alive.current && run === generation.current) setBusy(false);
    }
  }
  async function apply() {
    if (!result || !account || busy) return;
    setBusy(true);
    setError("");
    try {
      await useGifAvatar(result.blob, account);
      onApplied?.();
      if (alive.current)
        setMessage(
          "GIF aberto no editor de avatar. Confirme o recorte e salve as alterações no Discord.",
        );
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <div className="bf-studio">
      <header className="bs-hero">
        <span className="bs-eyebrow">ByaFlux · Vídeo para GIF</span>
        <h2>Um vídeo. Seu próximo avatar.</h2>
        <p>
          Escolha um vídeo e receba um GIF automaticamente. Recorte seu momento favorito, ajuste o
          enquadramento e veja o resultado antes de usar.
        </p>
      </header>
      {error && (
        <div role="alert" className="bs-note bs-error">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="bs-note bs-success">
          {message}
        </div>
      )}
      <div className="bs-layout">
        <section className="bs-panel">
          <h3>Seu vídeo</h3>
          <input
            ref={input}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
            hidden
            onChange={(e) => {
              const selected = e.target.files?.[0];
              e.target.value = "";
              if (selected) {
                setFile(selected);
                setInfo(undefined);
                void generate(selected, initial, true);
              }
            }}
          />
          <div
            className="bs-file-drop"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const selected = e.dataTransfer.files?.[0];
              if (selected && !busy) {
                setFile(selected);
                setInfo(undefined);
                void generate(selected, initial, true);
              }
            }}
          >
            <button className="bs-primary" disabled={busy} onClick={() => input.current?.click()}>
              {file ? "Escolher outro vídeo" : "Escolher vídeo"}
            </button>
            <p>Arraste um vídeo aqui ou escolha um arquivo. MP4, WebM ou MOV · até 100 MB.</p>
          </div>
          {sourceUrl && info && (
            <VideoEditor
              sourceUrl={sourceUrl}
              info={info}
              options={options}
              disabled={busy}
              change={change}
              previewRef={previewCanvas}
            />
          )}
          {file && <p style={{ overflowWrap: "anywhere" }}>{file.name}</p>}
          <details className="bs-video-advanced">
            <summary>Ajustes de qualidade e valores exatos</summary>
            <div className="bs-row">
              <div>
                <label className="bs-label" htmlFor="bf-video-start">
                  Início (segundos)
                </label>
                <input
                  id="bf-video-start"
                  type="number"
                  min={0}
                  max={info?.duration ?? 0}
                  step="0.1"
                  value={options.start}
                  disabled={busy || !info}
                  onChange={(e) => change({ start: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="bs-label" htmlFor="bf-video-end">
                  Fim (segundos)
                </label>
                <input
                  id="bf-video-end"
                  type="number"
                  min={0}
                  max={info?.duration ?? 0}
                  step="0.1"
                  value={options.end}
                  disabled={busy || !info}
                  onChange={(e) => change({ end: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="bs-row">
              <div>
                <label className="bs-label" htmlFor="bf-video-size">
                  Resolução
                </label>
                <select
                  id="bf-video-size"
                  value={options.size}
                  disabled={busy}
                  onChange={(e) => change({ size: Number(e.target.value) })}
                >
                  {[128, 256, 384, 512].map((size) => (
                    <option key={size} value={size}>
                      {size} × {size}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="bs-label" htmlFor="bf-video-fps">
                  Fluidez
                </label>
                <select
                  id="bf-video-fps"
                  value={options.fps}
                  disabled={busy}
                  onChange={(e) => change({ fps: Number(e.target.value) })}
                >
                  {[10, 15, 20].map((fps) => (
                    <option key={fps} value={fps}>
                      {fps} FPS
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="bs-label" htmlFor="bf-video-zoom">
              Zoom · {options.zoom.toFixed(1)}×
            </label>
            <input
              id="bf-video-zoom"
              type="range"
              min={1}
              max={3}
              step="0.1"
              value={options.zoom}
              disabled={busy}
              onChange={(e) => change({ zoom: Number(e.target.value) })}
            />
            <label className="bs-label" htmlFor="bf-video-x">
              Posição horizontal · {options.x.toFixed(0)}%
            </label>
            <input
              id="bf-video-x"
              type="range"
              min={0}
              max={100}
              value={options.x}
              disabled={busy}
              onChange={(e) => change({ x: Number(e.target.value) })}
            />
            <label className="bs-label" htmlFor="bf-video-y">
              Posição vertical · {options.y.toFixed(0)}%
            </label>
            <input
              id="bf-video-y"
              type="range"
              min={0}
              max={100}
              value={options.y}
              disabled={busy}
              onChange={(e) => change({ y: Number(e.target.value) })}
            />
          </details>
          <div className="bs-actions">
            <button
              className="bs-primary"
              disabled={busy || !file || !info}
              onClick={() => file && void generate(file, options)}
            >
              Gerar GIF com estes ajustes
            </button>
            {busy && <button onClick={() => controller.current?.abort()}>Cancelar</button>}
          </div>
          {busy && (
            <div role="status" style={{ marginTop: 14 }}>
              <p>Preparando GIF… {Math.round(progress * 100)}%</p>
              <progress max={1} value={progress} />
            </div>
          )}
        </section>
        <aside className="bs-panel">
          <h3>Prévia do avatar</h3>
          <div className="bs-preview">
            <canvas
              ref={previewCanvas}
              width={256}
              height={256}
              hidden={!sourceUrl || (!!result && showFinal)}
              aria-label="Prévia ao vivo do recorte"
            />
            {gifUrl && showFinal && <img src={gifUrl} alt="Prévia animada do GIF" />}
            {!sourceUrl && (
              <span style={{ color: "#a6a8b4", textAlign: "center", padding: 25 }}>
                Escolha um vídeo para começar
              </span>
            )}
          </div>
          {sourceUrl && (
            <p style={{ textAlign: "center" }}>
              {result && showFinal ? "GIF pronto para usar" : "Enquadramento ao vivo"}
            </p>
          )}
          {result && (
            <div className="bs-actions">
              <button aria-pressed={!showFinal} onClick={() => setShowFinal(false)}>
                Ao vivo
              </button>
              <button aria-pressed={showFinal} onClick={() => setShowFinal(true)}>
                GIF final
              </button>
            </div>
          )}
          {result && (
            <div className="bs-stats">
              <span>
                {result.width} × {result.width}
              </span>
              <span>{result.fps} FPS</span>
              <span>{result.duration.toFixed(1)} s</span>
              <span>{(result.blob.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
          )}
          <div className="bs-actions">
            <button
              className="bs-primary"
              disabled={busy || !result || !account}
              onClick={() => void apply()}
            >
              Usar como avatar
            </button>
            <button
              disabled={busy || !result}
              onClick={() =>
                result &&
                saveFile(new File([result.blob], "ByaFlux-avatar.gif", { type: "image/gif" }))
              }
            >
              Baixar GIF
            </button>
          </div>
          <div className="bs-note">
            Avatar animado requer um plano do Discord que ofereça esse recurso. O GIF é aberto no
            editor nativo para você confirmar o envio.
          </div>
          <p>
            Esta versão converte trechos de até 10 segundos e limita a saída a 8 MB por segurança.
            Esses são limites do conversor; o Discord faz a validação final do avatar.
          </p>
          <p>O processamento acontece no seu dispositivo. O vídeo original não é enviado.</p>
        </aside>
      </div>
    </div>
  );
}
