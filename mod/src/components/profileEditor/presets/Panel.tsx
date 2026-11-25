/* ByaFlux. GPL-3.0-or-later. */
import "@shared/profileStudio.css";
import { React, UserStore, useStateFromStores } from "@webpack/common";
import { allFields, FIELDS, Field, SavedProfile } from "./model";
import {
  applyProfile,
  captureProfile,
  deleteProfile,
  loadProfiles,
  renameProfile,
} from "./runtime";

function Fields({
  available = allFields(),
  selected,
  change,
  disabled = false,
}: {
  available?: readonly Field[];
  selected: readonly Field[];
  change(value: Field[]): void;
  disabled?: boolean;
}) {
  return (
    <>
      <div className="bs-actions">
        <button disabled={disabled} onClick={() => change([...available])}>
          Selecionar tudo
        </button>
        <button disabled={disabled} onClick={() => change([])}>
          Limpar seleção
        </button>
      </div>
      <div className="bs-fields">
        {FIELDS.filter(([key]) => available.includes(key)).map(([key, label, help]) => (
          <label className="bs-field" key={key}>
            <input
              type="checkbox"
              checked={selected.includes(key)}
              disabled={disabled}
              onChange={(e) =>
                change(e.target.checked ? [...selected, key] : selected.filter((k) => k !== key))
              }
            />
            <span>
              <strong>{label}</strong>
              <small>{help}</small>
            </span>
          </label>
        ))}
      </div>
    </>
  );
}
function CardPreview({ preset }: { preset: SavedProfile }) {
  const d = preset.data;
  const color = (n: unknown, fallback: string) =>
    typeof n === "number" && n >= 0 && n <= 0xffffff
      ? `#${n.toString(16).padStart(6, "0")}`
      : fallback;
  return (
    <>
      <div
        className="bs-banner"
        style={{
          backgroundColor: color(d.accentColor, color(d.themeColors?.[0], "#754121")),
          ...(d.bannerDataUrl ? { backgroundImage: `url("${d.bannerDataUrl}")` } : {}),
        }}
      />
      <div className="bs-card-body">
        {d.avatarDataUrl ? (
          <img className="bs-avatar" src={d.avatarDataUrl} alt="Foto salva" />
        ) : (
          <div className="bs-avatar bs-avatar-placeholder">B</div>
        )}
        <h3>{preset.name}</h3>
        <p>
          {d.globalName ?? "Perfil personalizado"}
          {d.pronouns ? ` · ${d.pronouns}` : ""}
        </p>
        {d.bio && <div className="bs-bio">{d.bio}</div>}
        {d.customStatus?.text && (
          <p>
            {d.customStatus.emojiName ?? ""} {d.customStatus.text}
          </p>
        )}
        <div className="bs-chips">
          {preset.fields.map((key) => (
            <span className="bs-chip" key={key}>
              {FIELDS.find(([k]) => k === key)?.[1]}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
export function ProfilePresetPanel({ onLoaded }: { onLoaded?: () => void } = {}) {
  const accountId = useStateFromStores([UserStore], () => UserStore.getCurrentUser()?.id);
  const [loaded, setLoaded] = React.useState<string>();
  const [presets, setPresets] = React.useState<SavedProfile[]>([]);
  const [fields, setFields] = React.useState<Field[]>(allFields);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [review, setReview] = React.useState<SavedProfile>();
  const [restoreFields, setRestoreFields] = React.useState<Field[]>([]);
  const [renaming, setRenaming] = React.useState<SavedProfile>();
  const [rename, setRename] = React.useState("");
  const [removing, setRemoving] = React.useState<string>();
  const accountRef = React.useRef(accountId);
  accountRef.current = accountId;
  const alive = React.useRef(true);
  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  React.useEffect(() => {
    let active = true;
    setPresets([]);
    setReview(undefined);
    setRenaming(undefined);
    setRemoving(undefined);
    setError("");
    setMessage("");
    setFields(allFields());
    if (accountId)
      loadProfiles(accountId)
        .then((items) => {
          if (active) {
            setPresets(items);
            setLoaded(accountId);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [accountId]);
  async function task(action: () => Promise<string>) {
    if (busy || !accountId || loaded !== accountId) return;
    const owner = accountId;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const text = await action();
      const updated = await loadProfiles(owner);
      if (alive.current && accountRef.current === owner) {
        setPresets(updated);
        setMessage(text);
      }
    } catch (e) {
      if (alive.current && accountRef.current === owner) setError((e as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const disabled = busy || !accountId || loaded !== accountId;
  return (
    <div className="bf-studio">
      <header className="bs-hero">
        <span className="bs-eyebrow">ByaFlux · ProfilePreset</span>
        <h2>Seu perfil, em coleções</h2>
        <p>
          Guarde combinações completas e volte ao seu visual favorito quando quiser. Seus perfis
          ficam salvos neste dispositivo, separados por conta.
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
          <h3>Salvar perfil atual</h3>
          <label className="bs-label" htmlFor="bf-profile-name">
            Nome do conjunto
          </label>
          <input
            id="bf-profile-name"
            placeholder="Ex.: Laranja, Natal, Trabalho…"
            value={name}
            maxLength={64}
            disabled={disabled}
            onChange={(e) => setName(e.target.value)}
          />
          <Fields selected={fields} change={setFields} disabled={disabled} />
          <div className="bs-actions">
            <button
              className="bs-primary"
              disabled={disabled || !name.trim() || !fields.length}
              onClick={() =>
                void task(async () => {
                  await captureProfile(accountId!, name, fields);
                  setName("");
                  return "Perfil salvo com os campos escolhidos.";
                })
              }
            >
              {busy ? "Aguarde…" : "Salvar selecionados"}
            </button>
          </div>
        </section>
        <aside className="bs-panel">
          <h3>Você escolhe o que muda</h3>
          <p>
            Todos os campos começam selecionados. Desmarque os que não quiser guardar. Ao carregar
            um conjunto, você também pode escolher quais campos restaurar.
          </p>
          <div className="bs-note">
            As imagens ficam guardadas junto do conjunto. Decorações, efeitos e nameplates continuam
            sujeitos à disponibilidade na sua conta e aos recursos do seu plano.
          </div>
          <p>
            A foto, o banner e os campos visuais são carregados no editor do Discord para você
            revisar e salvar. Status e disponibilidade são aplicados quando você confirma o
            carregamento.
          </p>
        </aside>
      </div>
      {review && (
        <section className="bs-panel" style={{ marginTop: 20 }}>
          <h3>Carregar: {review.name}</h3>
          <p>Marque os campos que deseja usar. Os demais ficam como estão.</p>
          <Fields
            available={review.fields}
            selected={restoreFields}
            change={setRestoreFields}
            disabled={busy}
          />
          <div className="bs-actions">
            <button
              className="bs-primary"
              disabled={disabled || !restoreFields.length}
              onClick={() =>
                void task(async () => {
                  await applyProfile(review, restoreFields);
                  onLoaded?.();
                  setReview(undefined);
                  return "Conjunto carregado. Confirme as alterações visuais no editor de perfil do Discord.";
                })
              }
            >
              Carregar selecionados
            </button>
            <button disabled={busy} onClick={() => setReview(undefined)}>
              Cancelar
            </button>
          </div>
        </section>
      )}
      {renaming && (
        <section className="bs-panel" style={{ marginTop: 20 }}>
          <h3>Renomear conjunto</h3>
          <input
            aria-label="Novo nome do conjunto"
            maxLength={64}
            value={rename}
            disabled={busy}
            onChange={(e) => setRename(e.target.value)}
          />
          <div className="bs-actions">
            <button
              className="bs-primary"
              disabled={disabled || !rename.trim()}
              onClick={() =>
                void task(async () => {
                  await renameProfile(accountId!, renaming.id, rename);
                  setRenaming(undefined);
                  return "Nome atualizado.";
                })
              }
            >
              Salvar nome
            </button>
            <button disabled={busy} onClick={() => setRenaming(undefined)}>
              Cancelar
            </button>
          </div>
        </section>
      )}
      <h3 style={{ marginTop: 28 }}>
        Meus conjuntos · {loaded === accountId ? presets.length : "…"}
      </h3>
      {!presets.length && (
        <div className="bs-empty">
          <h3>Seu próximo visual começa aqui</h3>
          <p>
            {loaded === accountId
              ? "Salve seu perfil atual para criar o primeiro conjunto."
              : "Carregando seus conjuntos…"}
          </p>
        </div>
      )}
      <div className="bs-cards">
        {presets.map((preset) => (
          <article className="bs-card" key={preset.id}>
            <CardPreview preset={preset} />
            <div style={{ padding: "0 16px 17px" }}>
              <div className="bs-actions">
                <button
                  disabled={disabled}
                  className="bs-primary"
                  onClick={() => {
                    setReview(preset);
                    setRestoreFields([...preset.fields]);
                  }}
                >
                  Carregar
                </button>
                <button
                  disabled={disabled}
                  onClick={() => {
                    setRenaming(preset);
                    setRename(preset.name);
                  }}
                >
                  Renomear
                </button>
                <button
                  className="bs-danger"
                  disabled={disabled}
                  onClick={() => setRemoving(preset.id)}
                >
                  Excluir
                </button>
              </div>
              {removing === preset.id && (
                <div className="bs-note">
                  <p>Excluir este conjunto salvo?</p>
                  <div className="bs-actions">
                    <button
                      className="bs-danger"
                      disabled={busy}
                      onClick={() =>
                        void task(async () => {
                          await deleteProfile(accountId!, preset.id);
                          setRemoving(undefined);
                          return "Conjunto excluído.";
                        })
                      }
                    >
                      Confirmar exclusão
                    </button>
                    <button disabled={busy} onClick={() => setRemoving(undefined)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
