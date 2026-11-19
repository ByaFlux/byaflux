/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { Settings, useSettings } from "@api/Settings";
import { addThemeChangeListener, removeThemeChangeListener } from "@api/Themes";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import {
    defaults,
    EMOJI_PACKS,
    EmojiPack,
    FontChoice,
    FONTS,
    iconClip,
    IconShape,
    Palette,
    PALETTES,
    SavedCtmTheme,
    STATUS_COLORS,
    ThemeChoices,
    validateChoices,
    validateName
} from "@shared/themeMaker";
import { createPreviewController, previewDocument, previewPayload, SERVER_IMAGE } from "@shared/themeMaker/preview";
import { React, useEffect, useMemo, useRef, useState } from "@webpack/common";

import { saveAndActivateTheme, ThemeMakerAdapter } from "./service";

const bridgeError = () =>
    new Error(
        "O módulo de temas não está disponível. Feche completamente o Discord, inclusive na bandeja, e abra novamente. Se continuar, repare a instalação do ByaFlux."
    );
export const desktopThemeAdapter: ThemeMakerAdapter = {
    getCtmThemes: () => {
        if (typeof VencordNative?.themes?.getCtmThemes !== "function") return Promise.reject(bridgeError());
        return VencordNative.themes.getCtmThemes();
    },
    saveCtmTheme: request => {
        if (typeof VencordNative?.themes?.saveCtmTheme !== "function") return Promise.reject(bridgeError());
        return VencordNative.themes.saveCtmTheme(request);
    }
};
const shapes: { value: IconShape; label: string }[] = [
    { value: "round", label: "Redondo" },
    { value: "triangle", label: "Triangular" },
    { value: "square", label: "Quadrado" },
    { value: "rounded", label: "Quadrado arredondado" }
];
const colorLabels: Record<keyof typeof STATUS_COLORS, string> = {
    online: "Online",
    idle: "Ausente",
    dnd: "Não perturbe",
    offline: "Offline",
    streaming: "Transmitindo",
    invisible: "Invisível",
    speaking: "Falando"
};
const paletteLabels: Record<keyof Palette, string> = {
    chat: "Fundo das mensagens",
    sidebar: "Fundo dos canais",
    servers: "Fundo dos servidores",
    surface: "Campos e cartões",
    text: "Texto principal",
    muted: "Texto secundário"
};
const categories = ["Aparência", "Tipografia", "Layout", "Detalhes"] as const;
function ColorField({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
    return (
        <label className="bf-ctm-color-field">
            <span>{label}</span>
            <div className="bf-ctm-color">
                <input
                    type="color"
                    aria-label={`Selecionar ${label.toLowerCase()}`}
                    value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
                    onChange={e => onChange(e.target.value)}
                />
                <input
                    aria-label={label}
                    value={value}
                    maxLength={7}
                    spellCheck={false}
                    onChange={e => onChange(e.target.value)}
                />
            </div>
        </label>
    );
}
function RangeField({
    label,
    value,
    min,
    max,
    step = 1,
    unit = "px",
    onChange
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    onChange(value: number): void;
}) {
    return (
        <label className="bf-ctm-range">
            <span>{label}</span>
            <output>
                {value}
                {unit}
            </output>
            <input
                aria-label={label}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={e => onChange(Number(e.target.value))}
            />
        </label>
    );
}
function SwitchField({
    label,
    description,
    checked,
    onChange
}: {
    label: string;
    description: string;
    checked: boolean;
    onChange(value: boolean): void;
}) {
    return (
        <label className="bf-ctm-switch-row">
            <span>
                <strong>{label}</strong>
                <small>{description}</small>
            </span>
            <input
                type="checkbox"
                role="switch"
                aria-label={label}
                checked={checked}
                onChange={e => onChange(e.target.checked)}
            />
            <span className="bf-ctm-switch" aria-hidden="true" />
        </label>
    );
}
export function ThemeMakerEditor({
    adapter = desktopThemeAdapter,
    themeSettings = Settings
}: {
    adapter?: ThemeMakerAdapter;
    themeSettings?: Pick<typeof Settings, "enabledThemes" | "themeActivationModes">;
}) {
    const [draft, setDraft] = useState<ThemeChoices>(defaults);
    const [name, setName] = useState("Meu tema");
    const [editing, setEditing] = useState<SavedCtmTheme>();
    const [themes, setThemes] = useState<SavedCtmTheme[]>([]);
    const [tab, setTab] = useState<"editor" | "themes">("editor");
    const [category, setCategory] = useState<(typeof categories)[number]>("Aparência");
    const [before, setBefore] = useState(false);
    const [highlight, setHighlight] = useState("");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [resourceErrors, setResourceErrors] = useState<Record<string, string>>({});
    const [previewReady, setPreviewReady] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [scale, setScale] = useState(0.6);
    const frame = useRef<HTMLIFrameElement>(null);
    const previewPanel = useRef<HTMLElement>(null);
    const viewport = useRef<HTMLDivElement>(null);
    const controller = useRef<ReturnType<typeof createPreviewController> | undefined>(undefined);
    const saveGuard = useRef(false);
    const mounted = useRef(false);
    const listRevision = useRef(0);
    const document = useMemo(previewDocument, []);
    const lastValid = useRef(defaults());
    let valid: ThemeChoices | undefined;
    let invalid = "";
    try {
        valid = validateChoices(draft);
        lastValid.current = valid;
    } catch (e) {
        invalid = (e as Error).message;
    }
    let nameError = "";
    try {
        validateName(name);
    } catch (e) {
        nameError = (e as Error).message;
    }
    const payload = useMemo(
        () => previewPayload(valid ?? lastValid.current, before, highlight),
        [draft, before, highlight]
    );
    const payloadRef = useRef(payload);
    payloadRef.current = payload;
    const refresh = async () => {
        const current = ++listRevision.current;
        try {
            const list = await adapter.getCtmThemes();
            if (mounted.current && current === listRevision.current) setThemes(list);
        } catch (e) {
            if (mounted.current) setError((e as Error).message);
        }
    };
    useEffect(() => {
        mounted.current = true;
        void refresh();
        addThemeChangeListener(refresh);
        return () => {
            mounted.current = false;
            removeThemeChangeListener(refresh);
        };
    }, [adapter]);
    useEffect(() => {
        controller.current?.render(payload);
    }, [payload]);
    useEffect(() => () => controller.current?.destroy(), []);
    useEffect(() => {
        const update = () => {
            if (viewport.current) setScale(Math.min(1, viewport.current.clientWidth / 960));
        };
        const observer = new ResizeObserver(update);
        if (viewport.current) observer.observe(viewport.current);
        update();
        return () => observer.disconnect();
    }, [expanded, tab]);
    useEffect(() => {
        if (!expanded) return;
        const previous = window.document.activeElement as HTMLElement | null;
        previewPanel.current?.querySelector<HTMLButtonElement>("button")?.focus();
        const close = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setExpanded(false);
            }
            if (event.key === "Tab") {
                const buttons = Array.from(previewPanel.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
                if (!buttons.length) return;
                const first = buttons[0],
                    last = buttons[buttons.length - 1];
                if (event.shiftKey && window.document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && window.document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };
        window.addEventListener("keydown", close, true);
        return () => {
            window.removeEventListener("keydown", close, true);
            previous?.focus();
        };
    }, [expanded]);
    const previewLoad = () => {
        controller.current?.destroy();
        const doc = frame.current?.contentDocument;
        if (!doc?.getElementById("ctm-theme")) {
            setError("A prévia não pôde ser iniciada. Reabra esta tela.");
            return;
        }
        // Reuse Discord's already registered font faces without changing the active client's styles.
        window.document.fonts.forEach(face => {
            if (/gg sans|Noto Sans/i.test(face.family)) doc.fonts.add(face);
        });
        controller.current = createPreviewController(doc, (kind, text) => {
            if (mounted.current) setResourceErrors(previous => ({ ...previous, [kind]: text }));
        });
        controller.current.render(payloadRef.current);
        setPreviewReady(true);
    };
    const updateStatus = (value: Partial<ThemeChoices["status"]>) =>
        setDraft(d => ({ ...d, status: { ...d.status, ...value } }));
    const focus = (group: string) => ({
        onMouseEnter: () => setHighlight(group),
        onMouseLeave: () => setHighlight(""),
        onFocusCapture: () => setHighlight(group),
        onBlurCapture: () => setHighlight("")
    });
    const fresh = () => {
        setDraft(defaults());
        setName("Meu tema");
        setEditing(undefined);
        setBefore(false);
        setMessage("");
        setError("");
        setTab("editor");
        setCategory("Aparência");
    };
    const edit = (theme: SavedCtmTheme) => {
        setDraft(theme.document.choices);
        setName(theme.document.name);
        setEditing(theme);
        setBefore(false);
        setMessage("");
        setError("");
        setTab("editor");
        setCategory("Aparência");
    };
    const applyPreset = (preset: (typeof PALETTES)[number]) => {
        setDraft(d => ({ ...d, accent: preset.accent, palette: { ...preset.colors } }));
        setBefore(false);
    };
    async function save() {
        if (saveGuard.current) return;
        saveGuard.current = true;
        setSaving(true);
        setError("");
        setMessage("");
        try {
            const result = await saveAndActivateTheme(adapter, themeSettings, {
                name: validateName(name),
                choices: validateChoices(draft),
                editing: editing && { fileName: editing.fileName, id: editing.document.id, revision: editing.revision }
            });
            if (!mounted.current) return;
            setEditing(result);
            setName(result.document.name);
            setDraft(result.document.choices);
            setMessage(`Salvo e ativado: ${result.fileName}`);
            await refresh();
        } catch (e) {
            if (mounted.current) setError((e as Error).message);
        } finally {
            saveGuard.current = false;
            if (mounted.current) setSaving(false);
        }
    }
    async function allowBackground() {
        try {
            const { url } = validateChoices(draft).background;
            if (await VencordNative.csp.isDomainAllowed(url, ["img-src"])) {
                setMessage("O domínio já está permitido. Confira se o link aponta diretamente para uma imagem.");
                return;
            }
            const result = await VencordNative.csp.requestAddOverride(url, ["img-src"], "Settings");
            if (result === "ok")
                setMessage("Domínio permitido. Feche completamente e abra o Discord para carregar esse fundo.");
            else if (result !== "cancelled") setError("A permissão do domínio não foi alterada.");
        } catch (e) {
            setError((e as Error).message);
        }
    }
    return (
        <div className="bf-ctm">
            <header className="bf-ctm-heading">
                <div>
                    <h2>Criador de temas</h2>
                    <p>Comece com uma paleta. Ajuste os detalhes. Veja antes de aplicar.</p>
                </div>
                <button className="bf-ctm-secondary" disabled={saving} onClick={fresh}>
                    Novo tema
                </button>
            </header>
            <nav className="bf-ctm-tabs" aria-label="Criador de temas">
                <button aria-pressed={tab === "editor"} onClick={() => setTab("editor")} disabled={saving}>
                    Editor
                </button>
                <button
                    aria-pressed={tab === "themes"}
                    onClick={() => {
                        setTab("themes");
                        void refresh();
                    }}
                    disabled={saving}
                >
                    Meus temas <span>{themes.length}</span>
                </button>
            </nav>
            {error && (
                <p className="bf-ctm-error" role="alert">
                    {error}
                </p>
            )}
            {message && (
                <p className="bf-ctm-success" role="status">
                    {message}
                </p>
            )}
            {tab === "themes" && (
                <section className="bf-ctm-library">
                    <div className="bf-ctm-library-heading">
                        <h3>Meus temas</h3>
                        <button className="bf-ctm-secondary" onClick={() => void refresh()}>
                            Atualizar lista
                        </button>
                    </div>
                    <p>Temas locais criados aqui. Suas escolhas ficam salvas no arquivo.</p>
                    {themes.length === 0 && (
                        <div className="bf-ctm-empty">
                            Você ainda não criou um tema.
                            <button className="bf-ctm-primary" onClick={fresh}>
                                Criar meu primeiro tema
                            </button>
                        </div>
                    )}
                    {themes.map(theme => (
                        <article key={theme.fileName} className="bf-ctm-theme-card">
                            <div
                                className="bf-ctm-theme-swatch"
                                style={{
                                    background: theme.document.choices.palette.chat,
                                    borderColor: theme.document.choices.accent
                                }}
                            />
                            <div>
                                <strong>{theme.document.name}</strong>
                                <small>{theme.fileName}</small>
                            </div>
                            <button className="bf-ctm-secondary" onClick={() => edit(theme)}>
                                Editar
                            </button>
                        </article>
                    ))}
                </section>
            )}
            <div hidden={tab !== "editor"}>
                <div className="bf-ctm-presets" role="group" aria-label="Paletas prontas">
                    {PALETTES.map(preset => (
                        <button
                            key={preset.id}
                            disabled={saving}
                            aria-pressed={
                                draft.accent === preset.accent &&
                                JSON.stringify(draft.palette) === JSON.stringify(preset.colors)
                            }
                            onClick={() => applyPreset(preset)}
                        >
                            <span className="bf-ctm-palette-mini" style={{ background: preset.colors.chat }}>
                                <i style={{ background: preset.colors.servers }} />
                                <i style={{ background: preset.colors.sidebar }} />
                                <i style={{ background: preset.accent }} />
                            </span>
                            {preset.name}
                        </button>
                    ))}
                </div>
                <nav className="bf-ctm-categories" aria-label="Personalização" role="tablist">
                    {categories.map(item => (
                        <button
                            key={item}
                            role="tab"
                            id={`bf-ctm-tab-${item}`}
                            aria-controls="bf-ctm-options"
                            aria-selected={category === item}
                            disabled={saving}
                            onClick={() => {
                                setCategory(item);
                                setHighlight("");
                            }}
                        >
                            {item}
                        </button>
                    ))}
                </nav>
                <div className="bf-ctm-columns">
                    <fieldset
                        className="bf-ctm-controls"
                        id="bf-ctm-options"
                        role="tabpanel"
                        aria-labelledby={`bf-ctm-tab-${category}`}
                        disabled={saving}
                    >
                        {category === "Aparência" && (
                            <>
                                <section {...focus("accent")}>
                                    <h3>Cores do tema</h3>
                                    <p>Altere a paleta sem mudar o restante do projeto.</p>
                                    <ColorField
                                        label="Cor de destaque"
                                        value={draft.accent}
                                        onChange={accent => setDraft(d => ({ ...d, accent }))}
                                    />
                                </section>
                                <section {...focus("palette")} className="bf-ctm-palette-fields">
                                    {(Object.keys(paletteLabels) as (keyof Palette)[]).map(key => (
                                        <ColorField
                                            key={key}
                                            label={paletteLabels[key]}
                                            value={draft.palette[key]}
                                            onChange={value =>
                                                setDraft(d => ({ ...d, palette: { ...d.palette, [key]: value } }))
                                            }
                                        />
                                    ))}
                                </section>
                                <section {...focus("background")}>
                                    <SwitchField
                                        label="Fundo personalizado"
                                        description="Use o link direto de uma imagem HTTPS."
                                        checked={draft.background.enabled}
                                        onChange={enabled =>
                                            setDraft(d => ({ ...d, background: { ...d.background, enabled } }))
                                        }
                                    />
                                    {draft.background.enabled && (
                                        <>
                                            <input
                                                type="url"
                                                aria-label="URL do fundo"
                                                placeholder="https://exemplo.com/imagem.jpg"
                                                value={draft.background.url}
                                                onChange={e =>
                                                    setDraft(d => ({
                                                        ...d,
                                                        background: { ...d.background, url: e.target.value }
                                                    }))
                                                }
                                            />
                                            <RangeField
                                                label="Escurecimento do fundo"
                                                value={draft.background.opacity}
                                                min={0}
                                                max={100}
                                                unit="%"
                                                onChange={opacity =>
                                                    setDraft(d => ({ ...d, background: { ...d.background, opacity } }))
                                                }
                                            />
                                            {resourceErrors.background && (
                                                <button className="bf-ctm-text" onClick={() => void allowBackground()}>
                                                    Verificar permissão do domínio
                                                </button>
                                            )}
                                        </>
                                    )}
                                </section>
                            </>
                        )}
                        {category === "Tipografia" && (
                            <section {...focus("typography")}>
                                <h3>Tipografia</h3>
                                <p>Fonte e medidas aplicadas às mensagens. Código mantém sua fonte monoespaçada.</p>
                                <label className="bf-ctm-field">
                                    Fonte
                                    <select
                                        aria-label="Fonte"
                                        value={draft.typography.font}
                                        onChange={e =>
                                            setDraft(d => ({
                                                ...d,
                                                typography: { ...d.typography, font: e.target.value as FontChoice }
                                            }))
                                        }
                                    >
                                        {Object.entries(FONTS).map(([key, font]) => (
                                            <option key={key} value={key}>
                                                {font.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <RangeField
                                    label="Tamanho da fonte"
                                    min={12}
                                    max={22}
                                    value={draft.typography.size}
                                    onChange={size => setDraft(d => ({ ...d, typography: { ...d.typography, size } }))}
                                />
                                <RangeField
                                    label="Altura da linha"
                                    min={1.2}
                                    max={2}
                                    step={0.05}
                                    unit="×"
                                    value={draft.typography.lineHeight}
                                    onChange={lineHeight =>
                                        setDraft(d => ({ ...d, typography: { ...d.typography, lineHeight } }))
                                    }
                                />
                                <label className="bf-ctm-field">
                                    Peso da fonte
                                    <select
                                        aria-label="Peso da fonte"
                                        value={draft.typography.weight}
                                        onChange={e =>
                                            setDraft(d => ({
                                                ...d,
                                                typography: { ...d.typography, weight: Number(e.target.value) }
                                            }))
                                        }
                                    >
                                        <option value={400}>Regular · 400</option>
                                        <option value={500}>Médio · 500</option>
                                        <option value={600}>Seminegrito · 600</option>
                                    </select>
                                </label>
                                <small>
                                    Inter, Roboto e Manrope são carregadas do Google Fonts. As demais usam fontes do
                                    Discord ou do sistema.
                                </small>
                            </section>
                        )}
                        {category === "Layout" && (
                            <>
                                <section {...focus("layout")}>
                                    <h3>Layout e espaçamento</h3>
                                    <p>Encontre o equilíbrio entre conteúdo e espaço livre.</p>
                                    <RangeField
                                        label="Largura dos canais"
                                        min={220}
                                        max={360}
                                        value={draft.layout.sidebarWidth}
                                        onChange={sidebarWidth =>
                                            setDraft(d => ({
                                                ...d,
                                                compact: false,
                                                layout: { ...d.layout, sidebarWidth }
                                            }))
                                        }
                                    />
                                    <RangeField
                                        label="Espaço entre mensagens"
                                        min={0}
                                        max={32}
                                        value={draft.layout.messageGap}
                                        onChange={messageGap =>
                                            setDraft(d => ({ ...d, layout: { ...d.layout, messageGap } }))
                                        }
                                    />
                                    <RangeField
                                        label="Raio dos cartões"
                                        min={0}
                                        max={24}
                                        value={draft.layout.radius}
                                        onChange={radius => setDraft(d => ({ ...d, layout: { ...d.layout, radius } }))}
                                    />
                                </section>
                                <section {...focus("compact")}>
                                    <SwitchField
                                        label="Barra lateral compacta"
                                        description="Servidores em 64 px e canais em 240 px."
                                        checked={draft.compact}
                                        onChange={compact => setDraft(d => ({ ...d, compact }))}
                                    />
                                </section>
                                <section {...focus("icons")}>
                                    <h4>Ícones de servidores</h4>
                                    <div className="bf-ctm-shapes" role="radiogroup" aria-label="Formato dos ícones">
                                        {shapes.map(shape => (
                                            <label
                                                key={shape.value}
                                                className={draft.icons.shape === shape.value ? "selected" : ""}
                                            >
                                                <input
                                                    type="radio"
                                                    name="bf-ctm-shape"
                                                    value={shape.value}
                                                    checked={draft.icons.shape === shape.value}
                                                    onChange={() =>
                                                        setDraft(d => ({
                                                            ...d,
                                                            icons: { ...d.icons, shape: shape.value }
                                                        }))
                                                    }
                                                />
                                                <img
                                                    src={SERVER_IMAGE}
                                                    alt=""
                                                    style={{ clipPath: iconClip(shape.value, draft.icons.radius) }}
                                                />
                                                <span>{shape.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <button
                                        className="bf-ctm-text"
                                        onClick={() =>
                                            setDraft(d => ({ ...d, icons: { ...d.icons, shape: "native" } }))
                                        }
                                    >
                                        Restaurar formato nativo{draft.icons.shape === "native" ? " ✓" : ""}
                                    </button>
                                    {draft.icons.shape === "rounded" && (
                                        <label className="bf-ctm-range">
                                            Raio dos ícones <output>{draft.icons.radius} px</output>
                                            <input
                                                aria-label="Raio dos ícones"
                                                type="range"
                                                min={0}
                                                max={24}
                                                step={1}
                                                value={draft.icons.radius}
                                                onChange={e =>
                                                    setDraft(d => ({
                                                        ...d,
                                                        icons: { ...d.icons, radius: Number(e.target.value) }
                                                    }))
                                                }
                                            />
                                        </label>
                                    )}
                                </section>
                            </>
                        )}
                        {category === "Detalhes" && (
                            <>
                                <section {...focus("status")}>
                                    <h4>Status</h4>
                                    <div className="bf-ctm-segmented" role="group" aria-label="Estilo de status">
                                        {(["normal", "radial"] as const).map(mode => (
                                            <button
                                                key={mode}
                                                aria-pressed={draft.status.mode === mode}
                                                onClick={() => updateStatus({ mode })}
                                            >
                                                {mode === "normal" ? "Normal" : "Radial"}
                                            </button>
                                        ))}
                                    </div>
                                    {draft.status.mode === "radial" && (
                                        <div className="bf-ctm-radial-controls">
                                            <div className="bf-ctm-measure-grid">
                                                <span>Tamanho</span>
                                                <span>Espessura</span>
                                                <span>Distância</span>
                                                {["Membros", "Popout", "Perfil"].map((label, i) => (
                                                    <React.Fragment key={label}>
                                                        <span>{label}</span>
                                                        <label>
                                                            <input
                                                                aria-label={`Espessura ${label}`}
                                                                type="number"
                                                                min={0.5}
                                                                max={12}
                                                                step={0.5}
                                                                value={draft.status.widths[i]}
                                                                onChange={e => {
                                                                    const widths = [...draft.status.widths] as [
                                                                        number,
                                                                        number,
                                                                        number
                                                                    ];
                                                                    widths[i] = Number(e.target.value);
                                                                    updateStatus({ widths });
                                                                }}
                                                            />
                                                            <span>px</span>
                                                        </label>
                                                        <label>
                                                            <input
                                                                aria-label={`Distância ${label}`}
                                                                type="number"
                                                                min={0}
                                                                max={16}
                                                                step={0.5}
                                                                value={draft.status.gaps[i]}
                                                                onChange={e => {
                                                                    const gaps = [...draft.status.gaps] as [
                                                                        number,
                                                                        number,
                                                                        number
                                                                    ];
                                                                    gaps[i] = Number(e.target.value);
                                                                    updateStatus({ gaps });
                                                                }}
                                                            />
                                                            <span>px</span>
                                                        </label>
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                            <details>
                                                <summary>Cores do status</summary>
                                                <div className="bf-ctm-status-colors">
                                                    {(Object.keys(STATUS_COLORS) as (keyof typeof STATUS_COLORS)[]).map(
                                                        key => (
                                                            <label key={key}>
                                                                <input
                                                                    type="color"
                                                                    aria-label={`Cor ${colorLabels[key]}`}
                                                                    value={draft.status.colors[key]}
                                                                    onChange={e =>
                                                                        updateStatus({
                                                                            colors: {
                                                                                ...draft.status.colors,
                                                                                [key]: e.target.value
                                                                            }
                                                                        })
                                                                    }
                                                                />
                                                                {colorLabels[key]}
                                                            </label>
                                                        )
                                                    )}
                                                </div>
                                            </details>
                                            <button
                                                className="bf-ctm-text"
                                                onClick={() =>
                                                    updateStatus({
                                                        widths: [2, 3, 4],
                                                        gaps: [2, 3, 4],
                                                        colors: { ...STATUS_COLORS }
                                                    })
                                                }
                                            >
                                                Restaurar padrões do RadialStatus
                                            </button>
                                        </div>
                                    )}
                                </section>
                                <section {...focus("emoji")}>
                                    <label className="bf-ctm-field">
                                        Emojis
                                        <select
                                            aria-label="Emojis"
                                            value={draft.emoji}
                                            onChange={e =>
                                                setDraft(d => ({ ...d, emoji: e.target.value as EmojiPack }))
                                            }
                                        >
                                            {EMOJI_PACKS.map(pack => (
                                                <option key={pack} value={pack}>
                                                    {pack === "Discord" ? "Padrão do Discord" : pack.replace("-", " ")}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <small>Um único pack por tema. A prévia usa sempre os mesmos emojis.</small>
                                </section>
                                <p className="bf-ctm-credit">RadialStatus por Gibbu · EmojiReplace por DevilBro</p>
                            </>
                        )}
                    </fieldset>
                    <section
                        ref={previewPanel}
                        role={expanded ? "dialog" : undefined}
                        aria-modal={expanded || undefined}
                        className={`bf-ctm-preview-panel${expanded ? " bf-ctm-expanded" : ""}`}
                        aria-label="Prévia do tema"
                    >
                        <header>
                            <div>
                                <h3>Prévia</h3>
                                <p>{before ? "Visual original do Discord" : "Seu tema em tempo real"}</p>
                            </div>
                            <div className="bf-ctm-segmented" role="group" aria-label="Comparação">
                                <button aria-pressed={before} onClick={() => setBefore(true)}>
                                    Antes
                                </button>
                                <button aria-pressed={!before} onClick={() => setBefore(false)}>
                                    Depois
                                </button>
                            </div>
                            <button className="bf-ctm-secondary" onClick={() => setExpanded(!expanded)}>
                                {expanded ? "Fechar prévia" : "Ampliar"}
                            </button>
                        </header>
                        <div className="bf-ctm-frame" ref={viewport} style={{ height: 600 * scale }}>
                            <iframe
                                ref={frame}
                                title="Prévia isolada do tema"
                                sandbox="allow-same-origin"
                                srcDoc={document}
                                onLoad={previewLoad}
                                style={{ width: 960, height: 600, zoom: scale }}
                            />
                        </div>
                        {!previewReady && (
                            <p role="status" className="bf-ctm-preview-note">
                                Preparando prévia…
                            </p>
                        )}
                        <p className="bf-ctm-preview-note">
                            O Discord só muda quando você salvar e ativar. Passe sobre um controle para localizar o
                            efeito.
                        </p>
                        {resourceErrors.emoji && (
                            <p className="bf-ctm-warning" role="status">
                                O pack {resourceErrors.emoji} não carregou. A prévia está usando emojis padrão.
                            </p>
                        )}
                        {resourceErrors.radial && (
                            <p className="bf-ctm-warning" role="status">
                                Não foi possível carregar o RadialStatus na prévia.
                            </p>
                        )}
                        {resourceErrors.font && (
                            <p className="bf-ctm-warning" role="status">
                                A fonte {resourceErrors.font} não carregou. Usando a alternativa do sistema.
                            </p>
                        )}
                        {resourceErrors.background && (
                            <p className="bf-ctm-warning" role="status">
                                {resourceErrors.background}
                            </p>
                        )}
                        {invalid && (
                            <p className="bf-ctm-warning" role="status">
                                {invalid}
                            </p>
                        )}
                    </section>
                </div>
                <footer className="bf-ctm-save">
                    <label htmlFor="bf-ctm-name">
                        Nome do tema
                        <input
                            id="bf-ctm-name"
                            placeholder="Meu tema"
                            value={name}
                            maxLength={64}
                            disabled={saving}
                            aria-invalid={!!nameError}
                            onChange={e => setName(e.target.value)}
                        />
                    </label>
                    <div>
                        <small>
                            {editing
                                ? `Editando ${editing.fileName}`
                                : "Um arquivo .theme.css, pronto para usar e compartilhar."}
                        </small>
                        <button
                            className="bf-ctm-primary"
                            disabled={saving || !!nameError || !!invalid}
                            onClick={() => void save()}
                        >
                            {saving ? "Salvando…" : "Salvar e ativar"}
                        </button>
                    </div>
                    {nameError && <small className="bf-ctm-name-error">{nameError}</small>}
                </footer>
            </div>
        </div>
    );
}
export default wrapTab(function ThemeMakerTab() {
    useSettings(["enabledThemes"]);
    return (
        <SettingsTab>
            <ThemeMakerEditor />
        </SettingsTab>
    );
}, "Criador de temas");
