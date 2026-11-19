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
    iconClip,
    IconShape,
    SavedCtmTheme,
    STATUS_COLORS,
    ThemeChoices,
    validateChoices,
    validateName
} from "@shared/themeMaker";
import { previewDocument, previewPayload, SERVER_IMAGE } from "@shared/themeMaker/preview";
import { React, useEffect, useMemo, useRef, useState } from "@webpack/common";

import { saveAndActivateTheme, ThemeMakerAdapter } from "./service";

export const desktopThemeAdapter: ThemeMakerAdapter = {
    getCtmThemes: () => VencordNative.themes.getCtmThemes(),
    saveCtmTheme: request => VencordNative.themes.saveCtmTheme(request)
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
export function ThemeMakerEditor({
    adapter = desktopThemeAdapter,
    themeSettings = Settings
}: {
    adapter?: ThemeMakerAdapter;
    themeSettings?: Pick<typeof Settings, "enabledThemes" | "themeActivationModes">;
}) {
    const [draft, setDraft] = useState<ThemeChoices>(defaults);
    const [name, setName] = useState("");
    const [editing, setEditing] = useState<SavedCtmTheme>();
    const [themes, setThemes] = useState<SavedCtmTheme[]>([]);
    const [tab, setTab] = useState<"editor" | "themes">("editor");
    const [before, setBefore] = useState(false);
    const [highlight, setHighlight] = useState("");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [resourceErrors, setResourceErrors] = useState<Record<string, string>>({});
    const frame = useRef<HTMLIFrameElement>(null);
    const saveGuard = useRef(false);
    const mounted = useRef(false);
    const listRevision = useRef(0);
    const token = useMemo(() => crypto.randomUUID(), []);
    const document = useMemo(() => previewDocument(token), [token]);
    const lastValid = useRef(defaults());
    let valid: ThemeChoices | undefined;
    let invalid = "";
    try {
        valid = validateChoices(draft);
        lastValid.current = valid;
    } catch (e) {
        invalid = String((e as Error).message);
    }
    const payload = useMemo(
        () => previewPayload(valid ?? lastValid.current, before, highlight),
        [draft, before, highlight]
    );
    const payloadRef = useRef(payload);
    payloadRef.current = payload;
    const send = () =>
        frame.current?.contentWindow?.postMessage(
            { type: "byaflux-ctm-render", token, payload: payloadRef.current },
            "*"
        );
    const refresh = async () => {
        const current = ++listRevision.current;
        try {
            const list = await adapter.getCtmThemes();
            if (mounted.current && current === listRevision.current) setThemes(list);
        } catch (e) {
            if (mounted.current) setError(String((e as Error).message));
        }
    };
    useEffect(() => {
        mounted.current = true;
        void refresh();
        const listener = (event: MessageEvent) => {
            if (event.source !== frame.current?.contentWindow || event.data?.token !== token) return;
            if (event.data.type === "byaflux-ctm-ready") send();
            if (
                event.data.type === "byaflux-ctm-resource" &&
                ["emoji", "radial", "background"].includes(event.data.kind) &&
                typeof event.data.text === "string"
            )
                setResourceErrors(previous => ({
                    ...previous,
                    [event.data.kind]: event.data.text.slice(0, 200)
                }));
        };
        window.addEventListener("message", listener);
        addThemeChangeListener(refresh);
        return () => {
            mounted.current = false;
            window.removeEventListener("message", listener);
            removeThemeChangeListener(refresh);
        };
    }, [adapter, token]);
    useEffect(send, [payload, token]);
    useEffect(() => {
        setResourceErrors({});
    }, [draft.emoji, draft.status.mode, draft.background.url, before]);
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
        setName("");
        setEditing(undefined);
        setBefore(false);
        setMessage("");
        setError("");
        setTab("editor");
    };
    const edit = (theme: SavedCtmTheme) => {
        setDraft(theme.document.choices);
        setName(theme.document.name);
        setEditing(theme);
        setBefore(false);
        setMessage("");
        setError("");
        setTab("editor");
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
                editing: editing && {
                    fileName: editing.fileName,
                    id: editing.document.id,
                    revision: editing.revision
                }
            });
            if (!mounted.current) return;
            setEditing(result);
            setName(result.document.name);
            setDraft(result.document.choices);
            setMessage(`Salvo e ativado: ${result.fileName}`);
            await refresh();
        } catch (e) {
            if (mounted.current) setError(String((e as Error).message));
        } finally {
            saveGuard.current = false;
            if (mounted.current) setSaving(false);
        }
    }
    return (
        <div className="bf-ctm">
            <header className="bf-ctm-heading">
                <div>
                    <span className="bf-ctm-eyebrow">BYAFLUX · CTM</span>
                    <h2>Criador de temas</h2>
                    <p>Personalize, compare e encontre o seu estilo.</p>
                </div>
                <button className="bf-ctm-secondary" disabled={saving} onClick={fresh}>
                    ＋ Novo tema
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
            {tab === "themes" && (
                <section className="bf-ctm-library">
                    <div className="bf-ctm-library-heading">
                        <h3>Meus temas</h3>
                        <button className="bf-ctm-secondary" onClick={() => void refresh()}>
                            Atualizar lista
                        </button>
                    </div>
                    <p>
                        As escolhas ficam no próprio arquivo. Você pode reabrir e editar seus temas depois de reiniciar
                        o ByaFlux.
                    </p>
                    {themes.length === 0 && (
                        <div className="bf-ctm-empty">
                            Seu próximo visual começa no editor.
                            <button className="bf-ctm-primary" onClick={fresh}>
                                Criar meu primeiro tema
                            </button>
                        </div>
                    )}
                    {themes.map(theme => (
                        <article key={theme.fileName} className="bf-ctm-theme-card">
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
                <div className="bf-ctm-columns">
                    <fieldset className="bf-ctm-controls" disabled={saving}>
                        <h3>Personalização</h3>
                        <section {...focus("accent")}>
                            <label htmlFor="bf-ctm-accent">Cor de destaque</label>
                            <div className="bf-ctm-color">
                                <input
                                    aria-label="Selecionar cor de destaque"
                                    type="color"
                                    value={/^#[0-9a-f]{6}$/i.test(draft.accent) ? draft.accent : "#ff8038"}
                                    onChange={e => setDraft(d => ({ ...d, accent: e.target.value }))}
                                />
                                <input
                                    id="bf-ctm-accent"
                                    spellCheck={false}
                                    value={draft.accent}
                                    maxLength={7}
                                    onChange={e => setDraft(d => ({ ...d, accent: e.target.value }))}
                                />
                            </div>
                        </section>
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
                                            {(Object.keys(STATUS_COLORS) as (keyof typeof STATUS_COLORS)[]).map(key => (
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
                                            ))}
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
                                                setDraft(d => ({ ...d, icons: { ...d.icons, shape: shape.value } }))
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
                                onClick={() => setDraft(d => ({ ...d, icons: { ...d.icons, shape: "native" } }))}
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
                        <section {...focus("emoji")}>
                            <label htmlFor="bf-ctm-emojis">Emojis</label>
                            <select
                                id="bf-ctm-emojis"
                                value={draft.emoji}
                                onChange={e => setDraft(d => ({ ...d, emoji: e.target.value as EmojiPack }))}
                            >
                                {EMOJI_PACKS.map(pack => (
                                    <option key={pack} value={pack}>
                                        {pack === "Discord"
                                            ? "Padrão do Discord"
                                            : pack === "Microsoft-3D"
                                              ? "Microsoft 3D"
                                              : pack === "Samsung-Old"
                                                ? "Samsung antigo"
                                                : pack}
                                    </option>
                                ))}
                            </select>
                            <small>A mesma sequência de emojis em todos os packs.</small>
                        </section>
                        <section {...focus("compact")}>
                            <label className="bf-ctm-check">
                                <input
                                    type="checkbox"
                                    checked={draft.compact}
                                    onChange={e => setDraft(d => ({ ...d, compact: e.target.checked }))}
                                />
                                Barra lateral compacta
                            </label>
                        </section>
                        <section {...focus("background")}>
                            <label className="bf-ctm-check">
                                <input
                                    type="checkbox"
                                    checked={draft.background.enabled}
                                    onChange={e =>
                                        setDraft(d => ({
                                            ...d,
                                            background: { ...d.background, enabled: e.target.checked }
                                        }))
                                    }
                                />
                                Fundo personalizado
                            </label>
                            {draft.background.enabled && (
                                <>
                                    <input
                                        aria-label="URL do fundo"
                                        type="url"
                                        placeholder="https://exemplo.com/fundo.jpg"
                                        value={draft.background.url}
                                        onChange={e =>
                                            setDraft(d => ({
                                                ...d,
                                                background: { ...d.background, url: e.target.value }
                                            }))
                                        }
                                    />
                                    <label className="bf-ctm-range">
                                        Escurecimento <output>{draft.background.opacity}%</output>
                                        <input
                                            aria-label="Escurecimento do fundo"
                                            type="range"
                                            min={0}
                                            max={100}
                                            value={draft.background.opacity}
                                            onChange={e =>
                                                setDraft(d => ({
                                                    ...d,
                                                    background: { ...d.background, opacity: Number(e.target.value) }
                                                }))
                                            }
                                        />
                                    </label>
                                </>
                            )}
                        </section>
                        <p className="bf-ctm-credit">RadialStatus por Gibbu · EmojiReplace por DevilBro</p>
                    </fieldset>
                    <section className="bf-ctm-preview-panel">
                        <header>
                            <div>
                                <h3>Prévia ao vivo</h3>
                                <p>O cliente só muda depois de salvar.</p>
                            </div>
                            <div className="bf-ctm-segmented" role="group" aria-label="Comparação">
                                <button aria-pressed={before} onClick={() => setBefore(true)}>
                                    Antes
                                </button>
                                <button aria-pressed={!before} onClick={() => setBefore(false)}>
                                    Depois
                                </button>
                            </div>
                        </header>
                        <div className="bf-ctm-frame">
                            <iframe
                                ref={frame}
                                title="Prévia isolada do tema"
                                sandbox="allow-scripts"
                                srcDoc={document}
                                onLoad={send}
                            />
                        </div>
                        <div className="bf-ctm-preview-note">
                            Passe o mouse ou foque um controle para destacar a área afetada.
                        </div>
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
                        {invalid && (
                            <p className="bf-ctm-warning" role="status">
                                {invalid}
                            </p>
                        )}
                    </section>
                </div>
                <footer className="bf-ctm-save">
                    <label htmlFor="bf-ctm-name">Nome do tema</label>
                    <input
                        id="bf-ctm-name"
                        placeholder="Meu tema ByaFlux"
                        maxLength={64}
                        value={name}
                        disabled={saving}
                        onChange={e => setName(e.target.value)}
                    />
                    <button
                        className="bf-ctm-primary"
                        disabled={saving || !name || !!invalid}
                        onClick={() => void save()}
                    >
                        {saving ? "Salvando…" : "Salvar e ativar"}
                    </button>
                    {editing && <small>Editando {editing.fileName}</small>}
                </footer>
            </div>
            {message && (
                <p className="bf-ctm-success" role="status">
                    {message}
                </p>
            )}
            {error && (
                <p className="bf-ctm-error" role="alert">
                    {error}
                </p>
            )}
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
