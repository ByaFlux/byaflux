/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import * as DataStore from "@api/DataStore";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import {
    animationTiming,
    BODIES,
    defaultProject,
    EFFECTS,
    exportName,
    EYES,
    IconProject,
    MOTIONS,
    PALETTE,
    randomProject,
    validateProject
} from "@shared/iconMaker";
import { exportGif, exportPng, readLocalImage } from "@shared/iconMaker/export";
import { renderIcon } from "@shared/iconMaker/render";
import { saveFile } from "@utils/web";
import { React, useEffect, useMemo, useRef, useState } from "@webpack/common";

const PROJECT_KEY = "ByaFlux.IconMaker.v1";
function ColorField({ label, value, change }: { label: string; value: string; change(value: string): void }) {
    return (
        <label className="bf-im-color">
            <span>{label}</span>
            <input aria-label={label} type="color" value={value} onChange={event => change(event.target.value)} />
            <code>{value.toUpperCase()}</code>
        </label>
    );
}
function Range({
    label,
    value,
    min,
    max,
    step = 1,
    suffix = "",
    change
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    suffix?: string;
    change(value: number): void;
}) {
    return (
        <label className="bf-im-range">
            <span>{label}</span>
            <output>
                {value}
                {suffix}
            </output>
            <input
                aria-label={label}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={event => change(Number(event.target.value))}
            />
        </label>
    );
}
export function IconMakerEditor() {
    const [project, setProject] = useState<IconProject>(defaultProject);
    const [section, setSection] = useState<"appearance" | "animation">("appearance");
    const [loaded, setLoaded] = useState(false),
        [busyImage, setBusyImage] = useState(false),
        [saving, setSaving] = useState(false);
    const [playing, setPlaying] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const [phase, setPhase] = useState(0),
        [exporting, setExporting] = useState(false),
        [progress, setProgress] = useState(0);
    const [name, setName] = useState("ByaFlux-icon"),
        [message, setMessage] = useState(""),
        [error, setError] = useState("");
    const [undo, setUndo] = useState<IconProject>();
    const alive = useRef(true),
        exportGuard = useRef(false),
        uploadGeneration = useRef(0),
        controller = useRef<AbortController | undefined>(undefined);
    const patch = (changes: Partial<IconProject>) => {
        setProject(value => ({ ...value, ...changes }));
        setMessage("");
    };
    useEffect(() => {
        alive.current = true;
        DataStore.get(PROJECT_KEY)
            .then(value => {
                if (!alive.current || !value) return;
                const stored = value as { project: unknown; name: string };
                setProject(validateProject(stored.project));
                setName(exportName(stored.name));
            })
            .catch(() => {
                if (alive.current) setError("Não foi possível restaurar o projeto salvo. Você pode iniciar um novo.");
            })
            .finally(() => {
                if (alive.current) setLoaded(true);
            });
        return () => {
            alive.current = false;
            uploadGeneration.current++;
            controller.current?.abort();
        };
    }, []);
    useEffect(() => {
        if (project.mode !== "animated" || !playing || exporting) return;
        let raf = 0,
            previous = 0;
        const start = performance.now(),
            { duration } = animationTiming(project);
        const tick = (now: number) => {
            if (now - previous >= 1000 / 30) {
                previous = now;
                setPhase(((now - start) % duration) / duration);
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [project.mode, project.speed, playing, exporting]);
    const galleries = useMemo(
        () => ({
            bodies: Object.fromEntries(
                Object.keys(BODIES).map(key => [
                    key,
                    renderIcon(
                        {
                            ...project,
                            body: key as IconProject["body"],
                            foregroundImage: "",
                            background: "transparent",
                            effect: "none",
                            mode: "static",
                            scale: 100,
                            rotation: 0
                        },
                        0,
                        "im-body-" + key
                    )
                ])
            ),
            eyes: Object.fromEntries(
                Object.keys(EYES).map(key => [
                    key,
                    renderIcon(
                        {
                            ...project,
                            eyes: key as IconProject["eyes"],
                            body: "base",
                            foregroundImage: "",
                            background: "transparent",
                            effect: "none",
                            mode: "static",
                            scale: 125,
                            rotation: 0
                        },
                        0,
                        "im-eye-" + key
                    )
                ])
            ),
            effects: Object.fromEntries(
                Object.keys(EFFECTS).map(key => [
                    key,
                    renderIcon(
                        {
                            ...project,
                            effect: key as IconProject["effect"],
                            foregroundImage: "",
                            mode: "animated",
                            motion: "none",
                            scale: 90,
                            rotation: 0
                        },
                        0.2,
                        "im-effect-" + key
                    )
                ])
            )
        }),
        [project]
    );
    const svg = useMemo(() => renderIcon(project, phase, "im-preview"), [project, phase]);
    const missingBackground = project.background === "image" && !project.backgroundImage;
    const busy = !loaded || busyImage || exporting || saving;
    let invalidName = "";
    try {
        exportName(name);
    } catch (e) {
        invalidName = (e as Error).message;
    }
    async function upload(file: File | undefined, target: "backgroundImage" | "foregroundImage") {
        if (!file) return;
        const generation = ++uploadGeneration.current;
        setBusyImage(true);
        setError("");
        try {
            const image = await readLocalImage(file);
            if (alive.current && generation === uploadGeneration.current)
                patch(
                    target === "backgroundImage"
                        ? { backgroundImage: image, background: "image" }
                        : { foregroundImage: image, motion: project.motion === "blink" ? "float" : project.motion }
                );
        } catch (e) {
            if (alive.current) setError((e as Error).message);
        } finally {
            if (alive.current && generation === uploadGeneration.current) setBusyImage(false);
        }
    }
    async function saveProject() {
        setSaving(true);
        setError("");
        try {
            await DataStore.set(PROJECT_KEY, { project: validateProject(project), name: exportName(name) });
            if (alive.current) setMessage("Projeto salvo neste dispositivo.");
        } catch (e) {
            if (alive.current) setError("Não foi possível salvar o projeto: " + (e as Error).message);
        } finally {
            if (alive.current) setSaving(false);
        }
    }
    async function download(format: "png" | "gif" | "svg") {
        if (exportGuard.current) return;
        exportGuard.current = true;
        const abort = new AbortController();
        controller.current = abort;
        setExporting(true);
        setProgress(0);
        setError("");
        setMessage("");
        try {
            const fileName = exportName(name),
                snapshot = validateProject(project);
            const blob =
                format === "png"
                    ? await exportPng(snapshot, phase, abort.signal)
                    : format === "gif"
                      ? await exportGif(
                            snapshot,
                            value => {
                                if (alive.current) setProgress(value);
                            },
                            abort.signal
                        )
                      : new Blob([renderIcon(snapshot, phase, "im-export", snapshot.pngSize)], {
                            type: "image/svg+xml"
                        });
            if (!alive.current || abort.signal.aborted) return;
            saveFile(new File([blob], `${fileName}.${format}`, { type: blob.type }));
            setMessage(`${format.toUpperCase()} pronto para baixar.`);
        } catch (e) {
            if (alive.current) {
                if ((e as Error).name === "AbortError") setMessage("Exportação cancelada.");
                else setError((e as Error).message);
            }
        } finally {
            exportGuard.current = false;
            if (alive.current) setExporting(false);
        }
    }
    const fresh = () => {
        setUndo(project);
        setProject(defaultProject());
        setName("ByaFlux-icon");
        setSection("appearance");
        setPhase(0);
        setMessage("");
        setError("");
    };
    return (
        <div className="bf-im">
            <header className="bf-im-heading">
                <div>
                    <span>ESTÚDIO BYAFLUX</span>
                    <h2>IconMaker</h2>
                    <p>Seu próximo ícone começa aqui.</p>
                </div>
                <button className="bf-im-secondary" disabled={busy} onClick={fresh}>
                    Novo projeto
                </button>
            </header>
            <div className="bf-im-modebar">
                <div role="group" aria-label="Formato do ícone" className="bf-im-modes">
                    <button
                        aria-pressed={project.mode === "static"}
                        disabled={busy}
                        onClick={() => {
                            patch({ mode: "static" });
                            setSection("appearance");
                            setPhase(0);
                        }}
                    >
                        Estático <small>PNG · SVG</small>
                    </button>
                    <button
                        aria-pressed={project.mode === "animated"}
                        disabled={busy}
                        onClick={() => {
                            patch({ mode: "animated" });
                            setSection("animation");
                        }}
                    >
                        Animado <small>GIF em loop</small>
                    </button>
                </div>
                <label className="bf-im-classic">
                    <span>
                        <strong>Classic Mode</strong>
                        <small>Silhueta clássica dos corpos prontos</small>
                    </span>
                    <input
                        aria-label="Classic Mode"
                        role="switch"
                        type="checkbox"
                        checked={project.classic}
                        disabled={busy}
                        onChange={event => patch({ classic: event.target.checked })}
                    />
                    <i aria-hidden="true" />
                </label>
            </div>
            {error && (
                <p className="bf-im-error" role="alert">
                    {error}
                </p>
            )}
            {message && (
                <p className="bf-im-success" role="status">
                    {message}
                </p>
            )}
            <div className="bf-im-grid">
                <div>
                    <nav className="bf-im-tabs" aria-label="Controles do IconMaker">
                        <button
                            aria-pressed={section === "appearance"}
                            disabled={busy}
                            onClick={() => setSection("appearance")}
                        >
                            Aparência
                        </button>
                        <button
                            aria-pressed={section === "animation"}
                            disabled={busy || project.mode !== "animated"}
                            onClick={() => setSection("animation")}
                        >
                            Animação
                        </button>
                    </nav>
                    <fieldset className="bf-im-controls" disabled={busy}>
                        {section === "appearance" ? (
                            <>
                                <section>
                                    <h3>Fundo</h3>
                                    <label className="bf-im-field">
                                        Tipo de fundo
                                        <select
                                            aria-label="Tipo de fundo"
                                            value={project.background}
                                            onChange={event =>
                                                patch({ background: event.target.value as IconProject["background"] })
                                            }
                                        >
                                            <option value="solid">Cor sólida</option>
                                            <option value="gradient">Gradiente</option>
                                            <option value="transparent">Transparente</option>
                                            <option value="image">Imagem local</option>
                                        </select>
                                    </label>
                                    {(project.background === "solid" || project.background === "gradient") && (
                                        <>
                                            <div className="bf-im-swatches" aria-label="Cores prontas">
                                                {PALETTE.map(color => (
                                                    <button
                                                        key={color}
                                                        aria-label={`Fundo ${color}`}
                                                        title={color}
                                                        style={{ backgroundColor: color }}
                                                        aria-pressed={project.backgroundColor === color}
                                                        onClick={() => patch({ backgroundColor: color })}
                                                    />
                                                ))}
                                            </div>
                                            <ColorField
                                                label="Cor do fundo"
                                                value={project.backgroundColor}
                                                change={backgroundColor => patch({ backgroundColor })}
                                            />
                                            {project.background === "gradient" && (
                                                <ColorField
                                                    label="Segunda cor do fundo"
                                                    value={project.backgroundColor2}
                                                    change={backgroundColor2 => patch({ backgroundColor2 })}
                                                />
                                            )}
                                        </>
                                    )}
                                    {missingBackground && <small>Escolha uma imagem local para usar como fundo.</small>}
                                    {project.background === "image" && (
                                        <label className="bf-im-upload">
                                            Escolher imagem de fundo
                                            <input
                                                type="file"
                                                aria-label="Imagem de fundo"
                                                accept="image/png,image/jpeg,image/webp"
                                                onChange={event => {
                                                    void upload(event.target.files?.[0], "backgroundImage");
                                                    event.target.value = "";
                                                }}
                                            />
                                        </label>
                                    )}
                                    <label className="bf-im-field">
                                        Recorte do fundo
                                        <select
                                            aria-label="Recorte do fundo"
                                            value={project.backgroundShape}
                                            onChange={event =>
                                                patch({
                                                    backgroundShape: event.target
                                                        .value as IconProject["backgroundShape"]
                                                })
                                            }
                                        >
                                            <option value="square">Quadrado</option>
                                            <option value="rounded">Quadrado arredondado</option>
                                            <option value="circle">Redondo</option>
                                        </select>
                                    </label>
                                </section>
                                <section>
                                    <h3>Corpo</h3>
                                    <p>Escolha uma silhueta ou use seu próprio desenho.</p>
                                    <div className="bf-im-options" role="radiogroup" aria-label="Corpo">
                                        {Object.entries(BODIES).map(([key, label]) => (
                                            <label
                                                key={key}
                                                className={
                                                    project.body === key && !project.foregroundImage ? "selected" : ""
                                                }
                                            >
                                                <input
                                                    type="radio"
                                                    name="im-body"
                                                    aria-label={`Corpo ${label}`}
                                                    checked={project.body === key && !project.foregroundImage}
                                                    onChange={() =>
                                                        patch({ body: key as IconProject["body"], foregroundImage: "" })
                                                    }
                                                />
                                                <span dangerouslySetInnerHTML={{ __html: galleries.bodies[key] }} />
                                                <small>{label}</small>
                                            </label>
                                        ))}
                                    </div>
                                    <label className="bf-im-upload">
                                        Usar minha imagem
                                        <input
                                            type="file"
                                            aria-label="Imagem do corpo"
                                            accept="image/png,image/jpeg,image/webp"
                                            onChange={event => {
                                                void upload(event.target.files?.[0], "foregroundImage");
                                                event.target.value = "";
                                            }}
                                        />
                                    </label>
                                    {project.foregroundImage && (
                                        <button className="bf-im-link" onClick={() => patch({ foregroundImage: "" })}>
                                            Remover imagem do corpo
                                        </button>
                                    )}
                                    {!project.foregroundImage && (
                                        <ColorField
                                            label="Cor do corpo"
                                            value={project.bodyColor}
                                            change={bodyColor => patch({ bodyColor })}
                                        />
                                    )}
                                    <Range
                                        label="Tamanho do corpo"
                                        min={50}
                                        max={140}
                                        suffix="%"
                                        value={project.scale}
                                        change={scale => patch({ scale })}
                                    />
                                    <Range
                                        label="Rotação"
                                        min={-180}
                                        max={180}
                                        suffix="°"
                                        value={project.rotation}
                                        change={rotation => patch({ rotation })}
                                    />
                                </section>
                                {!project.foregroundImage && (
                                    <section>
                                        <h3>Olhos</h3>
                                        <div className="bf-im-options bf-im-eyes" role="radiogroup" aria-label="Olhos">
                                            {Object.entries(EYES).map(([key, label]) => (
                                                <label key={key} className={project.eyes === key ? "selected" : ""}>
                                                    <input
                                                        type="radio"
                                                        name="im-eyes"
                                                        aria-label={`Olhos ${label}`}
                                                        checked={project.eyes === key}
                                                        onChange={() => patch({ eyes: key as IconProject["eyes"] })}
                                                    />
                                                    <span dangerouslySetInnerHTML={{ __html: galleries.eyes[key] }} />
                                                    <small>{label}</small>
                                                </label>
                                            ))}
                                        </div>
                                        <ColorField
                                            label="Cor dos olhos"
                                            value={project.eyeColor}
                                            change={eyeColor => patch({ eyeColor })}
                                        />
                                    </section>
                                )}
                            </>
                        ) : (
                            <>
                                <section>
                                    <h3>Movimento</h3>
                                    <p>A mesma animação da prévia será exportada no GIF.</p>
                                    <div className="bf-im-motions" role="radiogroup" aria-label="Movimento">
                                        {Object.entries(MOTIONS).map(([key, label]) => (
                                            <label key={key} className={project.motion === key ? "selected" : ""}>
                                                <input
                                                    type="radio"
                                                    name="im-motion"
                                                    aria-label={`Movimento ${label}`}
                                                    checked={project.motion === key}
                                                    disabled={key === "blink" && !!project.foregroundImage}
                                                    onChange={() => patch({ motion: key as IconProject["motion"] })}
                                                />
                                                <span>
                                                    {
                                                        {
                                                            none: "—",
                                                            float: "↕",
                                                            bounce: "↑",
                                                            pulse: "◉",
                                                            spin: "↻",
                                                            swing: "↔",
                                                            shake: "≋",
                                                            stretch: "⤢",
                                                            orbit: "◌",
                                                            flip: "⇄",
                                                            blink: "◡"
                                                        }[key]
                                                    }
                                                </span>
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                    {project.foregroundImage && (
                                        <small>Piscar funciona com os olhos dos corpos prontos.</small>
                                    )}
                                    <Range
                                        label="Velocidade"
                                        min={0.5}
                                        max={2}
                                        step={0.1}
                                        suffix="×"
                                        value={project.speed}
                                        change={speed => patch({ speed })}
                                    />
                                </section>
                                <section>
                                    <h3>Efeito</h3>
                                    <div className="bf-im-options" role="radiogroup" aria-label="Efeito">
                                        {Object.entries(EFFECTS).map(([key, label]) => (
                                            <label key={key} className={project.effect === key ? "selected" : ""}>
                                                <input
                                                    type="radio"
                                                    name="im-effect"
                                                    aria-label={`Efeito ${label}`}
                                                    checked={project.effect === key}
                                                    onChange={() => patch({ effect: key as IconProject["effect"] })}
                                                />
                                                <span dangerouslySetInnerHTML={{ __html: galleries.effects[key] }} />
                                                <small>{label}</small>
                                            </label>
                                        ))}
                                    </div>
                                    {project.effect !== "none" && (
                                        <>
                                            <ColorField
                                                label="Cor do efeito"
                                                value={project.effectColor}
                                                change={effectColor => patch({ effectColor })}
                                            />
                                            <label className="bf-im-field">
                                                Camada do efeito
                                                <select
                                                    aria-label="Camada do efeito"
                                                    value={project.effectLayer}
                                                    onChange={event =>
                                                        patch({
                                                            effectLayer: event.target
                                                                .value as IconProject["effectLayer"]
                                                        })
                                                    }
                                                >
                                                    <option value="behind">Atrás do corpo</option>
                                                    <option value="front">Na frente do corpo</option>
                                                </select>
                                            </label>
                                        </>
                                    )}
                                </section>
                            </>
                        )}
                    </fieldset>
                </div>
                <aside className="bf-im-preview-panel">
                    <div className="bf-im-preview-heading">
                        <div>
                            <h3>Prévia ao vivo</h3>
                            <p>
                                {project.mode === "static" ? "Imagem estática" : "Animação em loop"}
                                {project.classic ? " · Classic" : ""}
                            </p>
                        </div>
                        <button
                            className="bf-im-secondary"
                            disabled={busy}
                            onClick={() => {
                                setUndo(project);
                                setProject(randomProject(project));
                            }}
                        >
                            Aleatório
                        </button>
                    </div>
                    <div
                        className="bf-im-canvas"
                        aria-label="Prévia do ícone"
                        dangerouslySetInnerHTML={{ __html: svg }}
                    />
                    {project.mode === "animated" && (
                        <div className="bf-im-playback">
                            <button
                                className="bf-im-secondary"
                                disabled={exporting}
                                onClick={() => setPlaying(!playing)}
                            >
                                {playing ? "Pausar" : "Reproduzir"}
                            </button>
                            <label>
                                Quadro da prévia
                                <input
                                    aria-label="Quadro da prévia"
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={phase}
                                    disabled={exporting}
                                    onChange={event => {
                                        setPlaying(false);
                                        setPhase(Number(event.target.value));
                                    }}
                                />
                            </label>
                        </div>
                    )}
                    <div className="bf-im-context">
                        <div>
                            <span dangerouslySetInnerHTML={{ __html: svg.replaceAll("im-preview", "im-context") }} />
                            <strong>Seu ícone</strong>
                            <small>Perfil e servidor</small>
                        </div>
                    </div>
                    {undo && (
                        <button
                            className="bf-im-link"
                            disabled={busy}
                            onClick={() => {
                                setProject(undo);
                                setUndo(undefined);
                            }}
                        >
                            Desfazer última troca
                        </button>
                    )}
                    <fieldset className="bf-im-export" disabled={busy}>
                        <label className="bf-im-field">
                            Nome do arquivo
                            <input
                                aria-label="Nome do arquivo"
                                value={name}
                                maxLength={64}
                                onChange={event => setName(event.target.value)}
                            />
                        </label>
                        {invalidName && <small className="bf-im-name-error">{invalidName}</small>}
                        <div className="bf-im-export-options">
                            <label className="bf-im-field">
                                Tamanho PNG
                                <select
                                    aria-label="Tamanho PNG"
                                    value={project.pngSize}
                                    onChange={event =>
                                        patch({ pngSize: Number(event.target.value) as IconProject["pngSize"] })
                                    }
                                >
                                    {[128, 256, 512, 1024].map(size => (
                                        <option key={size} value={size}>
                                            {size} × {size}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {project.mode === "animated" && (
                                <>
                                    <label className="bf-im-field">
                                        Tamanho GIF
                                        <select
                                            aria-label="Tamanho GIF"
                                            value={project.gifSize}
                                            onChange={event =>
                                                patch({ gifSize: Number(event.target.value) as IconProject["gifSize"] })
                                            }
                                        >
                                            {[128, 256, 512].map(size => (
                                                <option key={size} value={size}>
                                                    {size} × {size}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="bf-im-field">
                                        Fluidez
                                        <select
                                            aria-label="Fluidez"
                                            value={project.fps}
                                            onChange={event =>
                                                patch({ fps: Number(event.target.value) as IconProject["fps"] })
                                            }
                                        >
                                            {[12, 20, 24].map(fps => (
                                                <option key={fps} value={fps}>
                                                    {fps} fps
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </>
                            )}
                        </div>
                        <button
                            className="bf-im-primary"
                            disabled={!!invalidName || missingBackground}
                            onClick={() => void download(project.mode === "animated" ? "gif" : "png")}
                        >
                            {project.mode === "animated" ? "Baixar GIF animado" : "Baixar PNG"}
                        </button>
                        <div className="bf-im-export-extra">
                            {project.mode === "animated" && (
                                <button
                                    className="bf-im-secondary"
                                    disabled={!!invalidName || missingBackground}
                                    onClick={() => void download("png")}
                                >
                                    PNG deste quadro
                                </button>
                            )}
                            <button
                                className="bf-im-secondary"
                                disabled={!!invalidName || missingBackground}
                                onClick={() => void download("svg")}
                            >
                                {project.mode === "animated" ? "SVG deste quadro" : "Baixar SVG"}
                            </button>
                            <button
                                className="bf-im-secondary"
                                disabled={!!invalidName || missingBackground}
                                onClick={() => void saveProject()}
                            >
                                Salvar projeto
                            </button>
                        </div>
                    </fieldset>
                    {busyImage && <p role="status">Preparando imagem local…</p>}
                    {exporting && (
                        <div className="bf-im-progress" role="status">
                            <span>Gerando arquivo… {Math.round(progress * 100)}%</span>
                            <progress value={progress} max={1} />
                            <button className="bf-im-secondary" onClick={() => controller.current?.abort()}>
                                Cancelar exportação
                            </button>
                        </div>
                    )}
                    <p className="bf-im-note">
                        As imagens são processadas neste dispositivo. O download não altera seu perfil.
                    </p>
                    <a
                        className="bf-im-reference"
                        href="https://discord-avatar-maker.app/"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Referência: Discord Avatar Maker
                    </a>
                </aside>
            </div>
        </div>
    );
}
export default wrapTab(function IconMakerTab() {
    return (
        <SettingsTab>
            <IconMakerEditor />
        </SettingsTab>
    );
}, "IconMaker");
