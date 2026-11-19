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
    CLASSIC_PALETTE,
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
import { applyEffectPhase } from "@shared/iconMaker/animation";
import { exportGif, exportPng, readLocalImage } from "@shared/iconMaker/export";
import { applyIconPhase, effectThumbnail, renderIcon, silhouetteThumbnail } from "@shared/iconMaker/render";
import { saveFile } from "@utils/web";
import { React, useEffect, useLayoutEffect, useMemo, useRef, useState } from "@webpack/common";
import type { ReactNode } from "react";

const PROJECT_KEY = "ByaFlux.IconMaker.v1";
function Glyph({ name }: { name: string }) {
    const paths: Record<string, string> = {
        dice: "M4 4h16v16H4zM8 8h.01M16 8h.01M8 16h.01M16 16h.01M12 12h.01",
        upload: "M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6",
        download: "M12 3v13m-5-5 5 5 5-5M4 19v2h16v-2",
        save: "M4 4h13l3 3v13H4zM8 4v6h8V4M8 20v-6h8v6",
        share: "M14 4h6v6m0-6-10 10M11 6H4v14h14v-7",
        gear: "M9 4h6l1 3 3 1 2 4-2 4-3 1-1 3H9l-1-3-3-1-2-4 2-4 3-1zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
        palette:
            "M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h5a3 3 0 0 0 3-3c0-4-4-7-9-7zM7 9h.01M10 6h.01M15 7h.01M6 14h.01",
        film: "M3 4h18v16H3zM7 4v16M17 4v16M3 9h4m10 0h4M3 15h4m10 0h4",
        pipette: "m14 4 6 6M4 20l2-6L17 3l4 4-11 11-6 2Z",
        close: "M5 5l14 14M5 19 19 5",
        more: "M5 12h.01M12 12h.01M19 12h.01",
        back: "m14 5-7 7 7 7",
        sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
        moon: "M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z"
    };
    return (
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d={paths[name] ?? paths.more} />
        </svg>
    );
}
function RoundButton({
    label,
    children,
    selected = false,
    disabled = false,
    click
}: {
    label: string;
    children: ReactNode;
    selected?: boolean;
    disabled?: boolean;
    click(): void;
}) {
    return (
        <button
            className={`bf-im-round${selected ? " selected" : ""}`}
            aria-label={label}
            title={label}
            aria-pressed={selected}
            disabled={disabled}
            onClick={click}
        >
            {children}
        </button>
    );
}
function ColourChoices({
    title,
    label,
    colors,
    value,
    change,
    auto,
    setAuto,
    autoText = "Automático",
    autoIcon = "auto",
    leading
}: {
    title: string;
    label: string;
    colors: string[];
    value: string;
    change(value: string): void;
    auto?: boolean;
    setAuto?: () => void;
    autoText?: string;
    autoIcon?: string;
    leading?: ReactNode;
}) {
    return (
        <section className="bf-im-chooser">
            <h3>{title}</h3>
            <div className="bf-im-circles">
                {setAuto && (
                    <RoundButton label={autoText} selected={!!auto} click={setAuto}>
                        {autoIcon === "cut" ? (
                            <span className="bf-im-cut-icon" />
                        ) : (
                            <span className="bf-im-auto">AUTO</span>
                        )}
                    </RoundButton>
                )}
                {leading}
                {colors.map(color => (
                    <RoundButton
                        key={color}
                        label={`${label} ${color}`}
                        selected={!auto && color === value}
                        click={() => change(color)}
                    >
                        <span className="bf-im-swatch" style={{ background: color }} />
                    </RoundButton>
                ))}
                <label
                    className={`bf-im-round bf-im-picker${!auto && !colors.includes(value) ? " selected" : ""}`}
                    title={`Escolher ${label.toLowerCase()}`}
                >
                    <Glyph name="pipette" />
                    <input
                        aria-label={label}
                        type="color"
                        value={value}
                        onChange={event => change(event.target.value)}
                    />
                </label>
            </div>
        </section>
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
                {Math.round(value * 100) / 100}
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
function IconPreview({
    project,
    phase,
    prefix,
    className = ""
}: {
    project: IconProject;
    phase: number;
    prefix: string;
    className?: string;
}) {
    const root = useRef<HTMLDivElement>(null);
    const svg = useMemo(() => renderIcon(project, 0, prefix), [project, prefix]);
    useLayoutEffect(() => {
        if (root.current) applyIconPhase(root.current, project, phase);
    }, [project, phase, svg]);
    return <div ref={root} className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}
function EffectPreview({ name, phase }: { name: string; phase: number }) {
    const root = useRef<HTMLSpanElement>(null),
        svg = useMemo(() => effectThumbnail(name), [name]);
    useLayoutEffect(() => {
        if (root.current) applyEffectPhase(root.current, name, phase);
    }, [name, phase]);
    return <span ref={root} className="bf-im-thumb" dangerouslySetInnerHTML={{ __html: svg }} />;
}
function Gallery({
    title,
    labels,
    selected,
    type,
    classic,
    choose,
    leading
}: {
    title: string;
    labels: Record<string, string>;
    selected: string;
    type: "bodies" | "eyes";
    classic: boolean;
    choose(id: string): void;
    leading?: ReactNode;
}) {
    const [expanded, setExpanded] = useState(false);
    const keys = Object.keys(labels);
    useEffect(() => {
        if (keys.indexOf(selected) >= 16) setExpanded(true);
    }, [selected]);
    const thumbnails = useMemo(
        () => Object.fromEntries(keys.map(key => [key, silhouetteThumbnail(type, key, classic)])),
        [type, classic]
    );
    return (
        <section className="bf-im-chooser">
            <h3>
                {title}
                <small>{keys.length}</small>
            </h3>
            <div className="bf-im-circles" role="radiogroup" aria-label={title}>
                {leading}
                {keys.slice(0, expanded ? keys.length : 16).map(key => (
                    <label
                        key={key}
                        title={labels[key]}
                        className={`bf-im-round bf-im-choice${selected === key ? " selected" : ""}`}
                    >
                        <input
                            type="radio"
                            name={`im-${type}`}
                            aria-label={`${type === "bodies" ? "Corpo" : "Olhos"} ${labels[key]}`}
                            checked={selected === key}
                            onChange={() => choose(key)}
                        />
                        <span className="bf-im-thumb" dangerouslySetInnerHTML={{ __html: thumbnails[key] }} />
                    </label>
                ))}
                <RoundButton
                    label={expanded ? `Recolher ${title.toLowerCase()}` : `Ver todos os ${title.toLowerCase()}`}
                    selected={expanded}
                    click={() => setExpanded(!expanded)}
                >
                    <Glyph name={expanded ? "back" : "more"} />
                </RoundButton>
            </div>
        </section>
    );
}
export function IconMakerEditor() {
    const [project, setProject] = useState<IconProject>(defaultProject),
        [name, setName] = useState("ByaFlux-icon");
    const [loaded, setLoaded] = useState(false),
        [busyImage, setBusyImage] = useState(false),
        [saving, setSaving] = useState(false);
    const [playing, setPlaying] = useState(true),
        [phase, setPhase] = useState(0),
        [thumbnailPhase, setThumbnailPhase] = useState(0);
    const [exporting, setExporting] = useState<"" | "png" | "gif" | "svg">(""),
        [progress, setProgress] = useState(0);
    const [settingsOpen, setSettingsOpen] = useState(false),
        [darkUi, setDarkUi] = useState(true);
    const [message, setMessage] = useState(""),
        [error, setError] = useState(""),
        [undo, setUndo] = useState<IconProject>();
    const alive = useRef(true),
        exportGuard = useRef(false),
        uploadGeneration = useRef(0),
        controller = useRef<AbortController | undefined>(undefined);
    const backgroundInput = useRef<HTMLInputElement>(null),
        foregroundInput = useRef<HTMLInputElement>(null),
        projectInput = useRef<HTMLInputElement>(null);
    const patch = (changes: Partial<IconProject>) => {
        setProject(value => ({ ...value, ...changes }));
        setMessage("");
    };
    const busy = !loaded || busyImage || !!exporting || saving,
        missingBackground = project.background === "image" && !project.backgroundImage;
    let invalidName = "";
    try {
        exportName(name);
    } catch (e) {
        invalidName = (e as Error).message;
    }
    const motionProjects = useMemo(
        () =>
            Object.fromEntries(
                Object.keys(MOTIONS).map(key => [
                    key,
                    {
                        ...defaultProject(),
                        mode: "animated",
                        classic: project.classic,
                        background: "transparent",
                        backgroundShape: "square",
                        bodyColor: "#b9bbbe",
                        motion: key
                    } as IconProject
                ])
            ),
        [project.classic]
    );
    useEffect(() => {
        alive.current = true;
        DataStore.get(PROJECT_KEY)
            .then(value => {
                if (!alive.current || !value) return;
                setProject(validateProject(value.project));
                setName(exportName(value.name));
                if (typeof value.darkUi === "boolean") setDarkUi(value.darkUi);
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
        if (project.mode !== "animated" || exporting) return;
        let raf = 0,
            previous = performance.now();
        const { duration } = animationTiming(project);
        const tick = (now: number) => {
            if (now - previous >= 1000 / 30) {
                const elapsed = (now - previous) / duration;
                previous = now;
                setThumbnailPhase(value => (value + elapsed) % 1);
                if (playing) setPhase(value => (value + elapsed) % 1);
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [project.mode, project.duration, playing, exporting]);
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
                        : { foregroundImage: image }
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
            await DataStore.set(PROJECT_KEY, { project: validateProject(project), name: exportName(name), darkUi });
            if (alive.current) setMessage("Projeto salvo neste dispositivo.");
        } catch (e) {
            if (alive.current) setError("Não foi possível salvar o projeto: " + (e as Error).message);
        } finally {
            if (alive.current) setSaving(false);
        }
    }
    async function importProject(file: File | undefined) {
        if (!file) return;
        setError("");
        try {
            if (file.size > 12 * 1024 * 1024) throw Error("O projeto deve ter até 12 MB.");
            const data = JSON.parse(await file.text());
            const next = validateProject(data.project ?? data);
            if (alive.current) {
                setUndo(project);
                setProject(next);
                if (typeof data.name === "string") setName(exportName(data.name));
                setPhase(0);
                setMessage("Projeto importado.");
            }
        } catch (e) {
            if (alive.current) setError("Não foi possível importar: " + (e as Error).message);
        }
    }
    function shareProject() {
        try {
            saveFile(
                new File(
                    [JSON.stringify({ project: validateProject(project), name: exportName(name) }, null, 2)],
                    exportName(name) + ".byaflux-icon.json",
                    { type: "application/json" }
                )
            );
            setMessage("Arquivo do projeto pronto para compartilhar.");
        } catch (e) {
            setError((e as Error).message);
        }
    }
    async function download(format: "png" | "gif" | "svg") {
        if (exportGuard.current) return;
        exportGuard.current = true;
        const abort = new AbortController();
        controller.current = abort;
        setExporting(format);
        setProgress(0);
        setError("");
        setMessage("");
        try {
            const fileName = exportName(name),
                snapshot = validateProject(project);
            if (missingBackground) throw Error("Escolha uma imagem de fundo antes de exportar.");
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
            if (alive.current) setExporting("");
        }
    }
    const fresh = () => {
        setUndo(project);
        setProject(defaultProject());
        setName("ByaFlux-icon");
        setPhase(0);
        setMessage("");
        setError("");
    };
    const pickBody = (body: string) => patch({ body: body as IconProject["body"], foregroundImage: "" });
    const pickEye = (eyes: string) => patch({ eyes: eyes as IconProject["eyes"] });
    const palette = project.classic ? CLASSIC_PALETTE : PALETTE;
    return (
        <div className={`bf-im bf-im-site${darkUi ? " dark" : " light"}`}>
            <header className="bf-im-sitebar">
                <nav aria-label="Formato do ícone">
                    <button
                        aria-label="Estático"
                        aria-pressed={project.mode === "static"}
                        disabled={busy}
                        onClick={() => {
                            patch({ mode: "static" });
                            setPhase(0);
                        }}
                    >
                        <Glyph name="palette" />
                        Estático
                    </button>
                    <button
                        aria-label="Animado"
                        aria-pressed={project.mode === "animated"}
                        disabled={busy}
                        onClick={() => {
                            patch({
                                mode: "animated",
                                motion:
                                    project.motion === "none" && project.effect === "none"
                                        ? "floating-animation"
                                        : project.motion
                            });
                            setPlaying(true);
                        }}
                    >
                        <Glyph name="film" />
                        Animado
                    </button>
                </nav>
                <div className="bf-im-switches">
                    <label>
                        <span>Classic Mode</span>
                        <input
                            type="checkbox"
                            role="switch"
                            aria-label="Classic Mode"
                            checked={project.classic}
                            disabled={busy}
                            onChange={event => patch({ classic: event.target.checked })}
                        />
                        <i>
                            <span>◒</span>
                        </i>
                    </label>
                    <label>
                        <span>Modo escuro</span>
                        <input
                            type="checkbox"
                            role="switch"
                            aria-label="Modo escuro"
                            checked={darkUi}
                            onChange={event => setDarkUi(event.target.checked)}
                        />
                        <i>
                            <Glyph name={darkUi ? "moon" : "sun"} />
                        </i>
                    </label>
                </div>
            </header>
            <section className="bf-im-hero">
                <h2>IconMaker</h2>
                <p>Crie seu avatar ou ícone de servidor</p>
                <div
                    aria-label="Prévia do ícone"
                    className={`bf-im-stage${project.background === "transparent" ? " checker" : ""}`}
                >
                    <IconPreview project={project} phase={phase} prefix="im-preview" />
                </div>
                <div className="bf-im-hero-actions">
                    <RoundButton
                        label="Aleatório"
                        disabled={busy}
                        click={() => {
                            setUndo(project);
                            setProject(randomProject(project));
                        }}
                    >
                        <Glyph name="dice" />
                    </RoundButton>
                    <RoundButton label="Compartilhar projeto" disabled={busy || !!invalidName} click={shareProject}>
                        <Glyph name="share" />
                    </RoundButton>
                    <div className="bf-im-download-pill">
                        <button
                            aria-label={project.mode === "animated" ? "Baixar GIF animado" : "Baixar PNG"}
                            disabled={busy || !!invalidName || missingBackground}
                            onClick={() => void download(project.mode === "animated" ? "gif" : "png")}
                        >
                            <Glyph name="download" />
                            <span>
                                Baixar
                                <small>
                                    {project.mode === "animated"
                                        ? `${project.gifSize} × ${project.gifSize} GIF`
                                        : `${project.pngSize} × ${project.pngSize} PNG`}
                                </small>
                            </span>
                        </button>
                        <button
                            className={settingsOpen ? "active" : ""}
                            aria-label="Configurar exportação"
                            title="Configurar exportação"
                            aria-expanded={settingsOpen}
                            onClick={() => setSettingsOpen(!settingsOpen)}
                        >
                            <Glyph name="gear" />
                        </button>
                    </div>
                    <RoundButton
                        label="Salvar projeto"
                        disabled={busy || !!invalidName}
                        click={() => void saveProject()}
                    >
                        <Glyph name="save" />
                    </RoundButton>
                </div>
                {project.mode === "animated" && (
                    <div className="bf-im-playback">
                        <button disabled={!!exporting} onClick={() => setPlaying(!playing)}>
                            {playing ? "Pausar" : "Reproduzir"}
                        </button>
                        <input
                            aria-label="Quadro da prévia"
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={phase}
                            disabled={!!exporting}
                            onChange={event => {
                                setPlaying(false);
                                setPhase(Number(event.target.value));
                            }}
                        />
                    </div>
                )}
                {exporting && (
                    <div className="bf-im-progress" role="status">
                        <span>
                            {exporting === "gif"
                                ? `Gerando GIF… ${Math.round(progress * 100)}%`
                                : `Preparando ${exporting.toUpperCase()}…`}
                        </span>
                        <progress value={progress} max={1} />
                        <button onClick={() => controller.current?.abort()}>Cancelar exportação</button>
                    </div>
                )}
                {message && (
                    <p className="bf-im-success" role="status">
                        {message}
                    </p>
                )}
                {error && (
                    <p className="bf-im-error" role="alert">
                        {error}
                    </p>
                )}
                {busyImage && <p role="status">Preparando imagem local…</p>}
                {settingsOpen && (
                    <fieldset className="bf-im-settings" disabled={busy}>
                        <legend>Exportação e projeto</legend>
                        <label>
                            Nome do arquivo
                            <input
                                aria-label="Nome do arquivo"
                                value={name}
                                maxLength={64}
                                onChange={event => setName(event.target.value)}
                            />
                        </label>
                        <label>
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
                                <label>
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
                                <label>
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
                        <label>
                            Recorte do fundo
                            <select
                                aria-label="Recorte do fundo"
                                value={project.backgroundShape}
                                onChange={event =>
                                    patch({ backgroundShape: event.target.value as IconProject["backgroundShape"] })
                                }
                            >
                                <option value="circle">Redondo</option>
                                <option value="square">Quadrado</option>
                                <option value="rounded">Quadrado arredondado</option>
                            </select>
                        </label>
                        <label>
                            Tipo de fundo
                            <select
                                aria-label="Tipo de fundo"
                                value={project.background}
                                onChange={event =>
                                    patch({ background: event.target.value as IconProject["background"] })
                                }
                            >
                                <option value="solid">Cor sólida</option>
                                <option value="transparent">Transparente</option>
                                <option value="image">Imagem local</option>
                                <option value="gradient">Gradiente</option>
                            </select>
                        </label>
                        {project.background === "gradient" && (
                            <label>
                                Segunda cor do fundo
                                <input
                                    aria-label="Segunda cor do fundo"
                                    type="color"
                                    value={project.backgroundColor2}
                                    onChange={event => patch({ backgroundColor2: event.target.value })}
                                />
                            </label>
                        )}
                        {invalidName && <small className="bf-im-name-error">{invalidName}</small>}
                        <div className="bf-im-settings-actions">
                            {project.mode === "animated" && (
                                <button
                                    disabled={!!invalidName || missingBackground}
                                    onClick={() => void download("png")}
                                >
                                    PNG deste quadro
                                </button>
                            )}
                            <button
                                aria-label="Baixar SVG"
                                disabled={!!invalidName || missingBackground}
                                onClick={() => void download("svg")}
                            >
                                {project.mode === "animated" ? "SVG deste quadro" : "Baixar SVG"}
                            </button>
                            <button onClick={() => projectInput.current?.click()}>Importar projeto</button>
                            <button onClick={fresh}>Novo projeto</button>
                            {undo && (
                                <button
                                    onClick={() => {
                                        setProject(undo);
                                        setUndo(undefined);
                                    }}
                                >
                                    Desfazer última troca
                                </button>
                            )}
                        </div>
                        <small>
                            PNG e SVG preservam a transparência. As imagens ficam neste dispositivo; o download não
                            altera seu perfil.
                        </small>
                    </fieldset>
                )}
            </section>
            <fieldset className="bf-im-controls" disabled={busy}>
                {project.mode === "static" ? (
                    <div className="bf-im-columns">
                        <div>
                            <ColourChoices
                                title="Fundo"
                                label="Fundo"
                                colors={palette}
                                value={project.backgroundColor}
                                auto={project.background === "image"}
                                change={backgroundColor => patch({ backgroundColor, background: "solid" })}
                                leading={
                                    <RoundButton
                                        label="Escolher imagem de fundo"
                                        selected={project.background === "image"}
                                        click={() => backgroundInput.current?.click()}
                                    >
                                        <Glyph name="upload" />
                                    </RoundButton>
                                }
                            />
                            {project.background === "image" && (
                                <div className="bf-im-upload-panel">
                                    {missingBackground ? (
                                        <small>Escolha uma imagem local para usar como fundo.</small>
                                    ) : (
                                        <small>Imagem de fundo carregada.</small>
                                    )}
                                    <button onClick={() => backgroundInput.current?.click()}>
                                        Escolher imagem de fundo
                                    </button>
                                    <Range
                                        label="Tamanho do fundo"
                                        value={project.backgroundScale}
                                        min={50}
                                        max={200}
                                        suffix="%"
                                        change={backgroundScale => patch({ backgroundScale })}
                                    />
                                    <button onClick={() => patch({ backgroundImage: "", background: "solid" })}>
                                        Remover imagem de fundo
                                    </button>
                                </div>
                            )}
                            <ColourChoices
                                title="Cor do corpo"
                                label="Cor do corpo"
                                colors={["#ffffff", "#000000"]}
                                value={project.bodyColor}
                                change={bodyColor => patch({ bodyColor })}
                            />
                            <ColourChoices
                                title="Cor dos olhos"
                                label="Cor dos olhos"
                                colors={[]}
                                value={project.eyeColor}
                                auto={project.eyeAuto}
                                setAuto={() => patch({ eyeAuto: true })}
                                autoText="Olhos automáticos (recortados)"
                                autoIcon="cut"
                                change={eyeColor => patch({ eyeColor, eyeAuto: false })}
                            />
                            {project.foregroundImage && (
                                <div className="bf-im-upload-panel">
                                    <small>Sua imagem está no lugar do corpo e dos olhos.</small>
                                    <Range
                                        label="Tamanho do corpo"
                                        value={project.scale}
                                        min={50}
                                        max={200}
                                        suffix="%"
                                        change={scale => patch({ scale })}
                                    />
                                    <Range
                                        label="Rotação"
                                        value={project.rotation}
                                        min={-180}
                                        max={180}
                                        suffix="°"
                                        change={rotation => patch({ rotation })}
                                    />
                                    <button onClick={() => patch({ foregroundImage: "" })}>
                                        Remover imagem do corpo
                                    </button>
                                </div>
                            )}
                        </div>
                        <div>
                            <Gallery
                                title="Corpos"
                                labels={BODIES}
                                selected={project.foregroundImage ? "" : project.body}
                                type="bodies"
                                classic={project.classic}
                                choose={pickBody}
                                leading={
                                    <>
                                        <RoundButton
                                            label="Corpo aleatório"
                                            click={() => {
                                                const keys = Object.keys(BODIES);
                                                pickBody(keys[Math.floor(Math.random() * keys.length)]);
                                            }}
                                        >
                                            <Glyph name="dice" />
                                        </RoundButton>
                                        <RoundButton
                                            label="Usar minha imagem"
                                            selected={!!project.foregroundImage}
                                            click={() => foregroundInput.current?.click()}
                                        >
                                            <Glyph name="upload" />
                                        </RoundButton>
                                    </>
                                }
                            />
                            <Gallery
                                title="Olhos"
                                labels={EYES}
                                selected={project.eyes}
                                type="eyes"
                                classic={project.classic}
                                choose={pickEye}
                                leading={
                                    <RoundButton
                                        label="Olhos aleatórios"
                                        click={() => {
                                            const keys = Object.keys(EYES);
                                            pickEye(keys[Math.floor(Math.random() * keys.length)]);
                                        }}
                                    >
                                        <Glyph name="dice" />
                                    </RoundButton>
                                }
                            />
                        </div>
                    </div>
                ) : (
                    <div className="bf-im-columns">
                        <div>
                            <section className="bf-im-chooser">
                                <h3>
                                    Efeito<small>12</small>
                                </h3>
                                <div className="bf-im-circles" role="radiogroup" aria-label="Efeito">
                                    {Object.entries(EFFECTS).map(([key, label]) => (
                                        <label
                                            key={key}
                                            title={label}
                                            className={`bf-im-round bf-im-choice${project.effect === key ? " selected" : ""}`}
                                        >
                                            <input
                                                type="radio"
                                                name="im-effect"
                                                aria-label={`Efeito ${label}`}
                                                checked={project.effect === key}
                                                onChange={() => patch({ effect: key as IconProject["effect"] })}
                                            />
                                            {key === "none" ? (
                                                <span className="bf-im-cut-icon" />
                                            ) : (
                                                <EffectPreview name={key} phase={thumbnailPhase} />
                                            )}
                                        </label>
                                    ))}
                                </div>
                            </section>
                            <ColourChoices
                                title="Cor do efeito"
                                label="Cor do efeito"
                                colors={["#ffffff", "#000000"]}
                                value={project.effectColor}
                                auto={project.effectAuto}
                                setAuto={() => patch({ effectAuto: true })}
                                autoText="Cor automática do efeito"
                                change={effectColor => patch({ effectColor, effectAuto: false })}
                            />
                            <section className="bf-im-chooser">
                                <h3>Posição do efeito</h3>
                                <div className="bf-im-circles">
                                    {(["auto", "front", "behind"] as const).map(layer => (
                                        <RoundButton
                                            key={layer}
                                            label={
                                                layer === "auto"
                                                    ? "Posição automática"
                                                    : layer === "front"
                                                      ? "Efeito na frente"
                                                      : "Efeito atrás"
                                            }
                                            selected={project.effectLayer === layer}
                                            click={() => patch({ effectLayer: layer })}
                                        >
                                            {layer === "auto" ? (
                                                <span className="bf-im-auto">AUTO</span>
                                            ) : (
                                                <span className={`bf-im-layer-icon ${layer}`}>
                                                    <i />
                                                    <b />
                                                </span>
                                            )}
                                        </RoundButton>
                                    ))}
                                </div>
                            </section>
                        </div>
                        <div>
                            <section className="bf-im-chooser">
                                <h3>
                                    Movimento do corpo<small>12</small>
                                </h3>
                                <div className="bf-im-circles" role="radiogroup" aria-label="Movimento">
                                    {Object.entries(MOTIONS).map(([key, label]) => (
                                        <label
                                            key={key}
                                            title={label}
                                            className={`bf-im-round bf-im-choice${project.motion === key ? " selected" : ""}`}
                                        >
                                            <input
                                                type="radio"
                                                name="im-motion"
                                                aria-label={`Movimento ${label}`}
                                                checked={project.motion === key}
                                                onChange={() => patch({ motion: key as IconProject["motion"] })}
                                            />
                                            {key === "none" ? (
                                                <span className="bf-im-cut-icon" />
                                            ) : (
                                                <IconPreview
                                                    project={motionProjects[key]}
                                                    phase={thumbnailPhase}
                                                    prefix={"im-motion-" + key}
                                                    className="bf-im-thumb"
                                                />
                                            )}
                                        </label>
                                    ))}
                                </div>
                            </section>
                            <section className="bf-im-chooser">
                                <h3>Velocidade da animação</h3>
                                <Range
                                    label="Velocidade"
                                    value={6 - project.duration}
                                    min={1}
                                    max={5}
                                    step={0.1}
                                    change={value => patch({ duration: Math.round((6 - value) * 10) / 10 })}
                                />
                                <small>{project.duration.toFixed(1)} s por ciclo</small>
                                <button className="bf-im-reset" onClick={() => patch({ duration: 3 })}>
                                    Restaurar recomendado
                                </button>
                            </section>
                        </div>
                    </div>
                )}
            </fieldset>
            <footer className="bf-im-footer">
                <a href="https://discord-avatar-maker.app/" target="_blank" rel="noreferrer">
                    Catálogo visual: Discord Avatar Maker / Nerd Or Die
                </a>
                <small>
                    Estático e animado, com versões moderna e clássica. Projetos e exportações são processados
                    localmente.
                </small>
            </footer>
            <input
                hidden
                ref={backgroundInput}
                type="file"
                aria-label="Imagem de fundo"
                accept="image/png,image/jpeg,image/webp"
                onChange={event => {
                    void upload(event.target.files?.[0], "backgroundImage");
                    event.target.value = "";
                }}
            />
            <input
                hidden
                ref={foregroundInput}
                type="file"
                aria-label="Imagem do corpo"
                accept="image/png,image/jpeg,image/webp"
                onChange={event => {
                    void upload(event.target.files?.[0], "foregroundImage");
                    event.target.value = "";
                }}
            />
            <input
                hidden
                ref={projectInput}
                type="file"
                aria-label="Arquivo do projeto"
                accept="application/json,.json"
                onChange={event => {
                    void importProject(event.target.files?.[0]);
                    event.target.value = "";
                }}
            />
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
