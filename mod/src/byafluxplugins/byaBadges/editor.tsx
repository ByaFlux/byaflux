import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { PluginNative } from "@utils/types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { React, UserStore, useStateFromStores } from "@webpack/common";
import { badgeKey, BadgeLayout, moveLayoutItem, readBadgeLayout } from "./layout";
import { BadgeVisibilityControl } from "./visibility";

const Native = VencordNative.pluginHelpers.ByaBadges as PluginNative<typeof import("./native")>;
const Directory: any = findStoreLazy("BadgeDirectoryStore");
const DirectoryActions = findByPropsLazy("openBadgeDirectoryModal");
type Entry = { key: string; name: string; icon: string; custom: boolean; nativeHidden: boolean };
type OwnerProfile = {
  connected?: boolean;
  profileId?: string;
  badges?: { id: string; name: string; icon: string }[];
  badgeLayout?: BadgeLayout | null;
  layoutRevision?: number;
};
function useFallbackBadges() {
  const userId = UserStore.getCurrentUser()?.id;
  const catalog = useStateFromStores(
    [Directory],
    () => (userId ? Directory.getBadges(userId) : []),
    [userId],
  );
  return { fixedBadges: [], reorderableBadges: catalog, hiddenBadges: [] };
}
function Editor({
  useNativeBadges,
  onSaved,
  onClose,
  returnFocusRef,
  skipReturnFocusRef,
  autoFocus = true,
}: {
  useNativeBadges?: () => any;
  onSaved(profile: unknown): void;
  onClose?(): void;
  returnFocusRef?: React.RefObject<HTMLElement>;
  skipReturnFocusRef?: React.MutableRefObject<boolean>;
  autoFocus?: boolean;
}) {
  const userId = useStateFromStores([UserStore], () => UserStore.getCurrentUser()?.id);
  const native = (useNativeBadges ?? useFallbackBadges)();
  const [profile, setProfile] = React.useState<OwnerProfile | null>(null);
  const [order, setOrder] = React.useState<string[]>([]);
  const [hidden, setHidden] = React.useState<string[]>(["discord:1"]);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState("Carregando sua organização…");
  const [code, setCode] = React.useState("");
  const [drag, setDrag] = React.useState<string | null>(null);
  const root = React.useRef<HTMLElement | null>(null);
  const mounted = React.useRef(true);
  const currentUser = React.useRef(userId);
  const positions = React.useRef(new Map<string, DOMRect>());
  const nodes = React.useRef(new Map<string, HTMLDivElement>());
  const entries: Entry[] = [];
  const keys = new Set<string>();
  for (const badge of profile?.badges ?? []) {
    const key = `byaflux:${badge.id}`;
    if (!keys.has(key)) {
      keys.add(key);
      entries.push({ key, name: badge.name, icon: badge.icon, custom: true, nativeHidden: false });
    }
  }
  for (const badge of [
    ...(native?.fixedBadges ?? []),
    ...(native?.reorderableBadges ?? []),
    ...(native?.hiddenBadges ?? []),
  ]) {
    if (!badge?.owned) continue;
    const key = badgeKey(badge);
    if (!key?.startsWith("discord:") || keys.has(key)) continue;
    keys.add(key);
    entries.push({
      key,
      name: String(badge.name ?? badge.description ?? "Badge do Discord"),
      icon:
        badge.simple_icon_raster_url ??
        badge.complex_icon_static_url ??
        badge.simple_icon_url ??
        "",
      custom: false,
      nativeHidden: !!badge.hidden,
    });
  }
  const shownOrder = [
    ...new Set([...order.filter((key) => keys.has(key)), ...entries.map((b) => b.key)]),
  ];
  const byKey = new Map(entries.map((e) => [e.key, e]));
  const revision = profile?.layoutRevision ?? readBadgeLayout(profile?.badgeLayout)?.revision ?? 0;
  function accept(data: OwnerProfile) {
    if (data.connected && data.profileId !== currentUser.current)
      throw new Error("A conta mudou. Reabra o painel.");
    setProfile(data);
    const layout = readBadgeLayout(data.badgeLayout);
    setOrder(layout?.order ?? []);
    setHidden(layout?.hidden ?? ["discord:1"]);
  }
  async function task(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      if (mounted.current) setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  React.useEffect(() => {
    mounted.current = true;
    currentUser.current = userId;
    setProfile(null);
    setOrder([]);
    setHidden(["discord:1"]);
    setCode("");
    setBusy(true);
    if (userId)
      void Native.getEditorProfile(userId)
        .then((value) => {
          if (!mounted.current || currentUser.current !== userId) return;
          const data = value as OwnerProfile;
          accept(data);
          setNotice(
            data.connected
              ? "Organização pública: usuários do ByaFlux verão a mesma ordem."
              : "Confirme sua conta uma vez para salvar para todos no ByaFlux.",
          );
        })
        .catch((error) => {
          if (mounted.current && currentUser.current === userId)
            setNotice(String(error.message ?? error));
        })
        .finally(() => {
          if (mounted.current && currentUser.current === userId) setBusy(false);
        });
    else {
      setBusy(false);
      setNotice("Abra seu próprio perfil para organizar as badges.");
    }
    if (autoFocus) root.current?.focus();
    return () => {
      mounted.current = false;
      if (autoFocus && !skipReturnFocusRef?.current) returnFocusRef?.current?.focus?.();
    };
  }, [userId]);
  React.useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const [key, node] of nodes.current) {
      const before = positions.current.get(key),
        after = node.getBoundingClientRect();
      if (before && (before.left !== after.left || before.top !== after.top))
        node.animate(
          [
            { transform: `translate(${before.left - after.left}px,${before.top - after.top}px)` },
            { transform: "translate(0,0)" },
          ],
          { duration: 180, easing: "ease-out" },
        );
    }
    positions.current.clear();
  }, [shownOrder.join("|")]);
  function move(key: string, target: string) {
    if (!profile?.connected || busy) return;
    positions.current = new Map(
      [...nodes.current].map(([k, node]) => [k, node.getBoundingClientRect()]),
    );
    setOrder(moveLayoutItem(shownOrder, key, target));
  }
  function toggle(entry: Entry) {
    if (!profile?.connected || busy) return;
    if (!entry.custom) {
      setNotice("Use os controles do Discord acima para ocultar ou mostrar as badges oficiais.");
      return;
    }
    setHidden((value) =>
      value.includes(entry.key) ? value.filter((k) => k !== entry.key) : [...value, entry.key],
    );
  }
  async function save() {
    if (!userId || userId !== UserStore.getCurrentUser()?.id)
      throw new Error("A conta mudou. Reabra o painel.");
    const result = (await Native.saveProfileLayout(userId, {
      expectedRevision: revision,
      order: [...new Set([...shownOrder, ...(hidden.includes("discord:1") ? ["discord:1"] : [])])],
      hidden: hidden.filter((key) => key === "discord:1" || keys.has(key)),
    })) as OwnerProfile;
    if (!mounted.current) return;
    accept({ ...result, connected: true });
    onSaved(result);
    setNotice(
      "Salvo! Outros usuários do ByaFlux receberão esta organização ao atualizar o perfil.",
    );
  }
  return (
    <section
      className="bf-badge-layout"
      ref={root}
      tabIndex={-1}
      aria-label="Personalize suas insígnias"
    >
      <h3>Personalize suas insígnias</h3>
      <BadgeVisibilityControl
        hidden={hidden.includes("discord:1")}
        disabled={!profile?.connected || busy}
        onChange={(checked) =>
          setHidden((value) =>
            checked
              ? [...new Set([...value, "discord:1"])]
              : value.filter((key) => key !== "discord:1"),
          )
        }
      />
      <p>Arraste para reordenar. Clique nas badges do ByaFlux para ocultar ou mostrar.</p>
      <div className="bf-badge-layout-grid" role="group" aria-label="Ordem das badges">
        {shownOrder.map((key) => {
          const entry = byKey.get(key)!;
          const invisible = hidden.includes(key) || (!entry.custom && entry.nativeHidden);
          return (
            <div
              key={key}
              ref={(node) => {
                node ? nodes.current.set(key, node) : nodes.current.delete(key);
              }}
              className={`bf-badge-layout-tile ${invisible ? "is-hidden" : ""} ${drag === key ? "is-dragging" : ""}`}
              role="button"
              tabIndex={profile?.connected ? 0 : -1}
              aria-label={`${entry.name}. ${invisible ? "Oculta" : "Visível"}. ${entry.custom ? "Clique para alterar. " : ""}Use Alt e as setas para mover.`}
              aria-pressed={!invisible}
              title={`${entry.name}${entry.custom ? " · ByaFlux" : ""}`}
              draggable={!!profile?.connected && !busy}
              onClick={() => {
                if (!drag) toggle(entry);
              }}
              onDragStart={(e) => {
                setDrag(key);
                e.dataTransfer.setData("text/plain", key);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (drag) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (drag) move(drag, key);
                setDrag(null);
              }}
              onDragEnd={() => setDrag(null)}
              onKeyDown={(e) => {
                if (
                  e.altKey &&
                  ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
                ) {
                  e.preventDefault();
                  const from = shownOrder.indexOf(key);
                  const step =
                    e.key === "ArrowLeft"
                      ? -1
                      : e.key === "ArrowRight"
                        ? 1
                        : e.key === "ArrowUp"
                          ? -6
                          : 6;
                  const target =
                    shownOrder[Math.max(0, Math.min(shownOrder.length - 1, from + step))];
                  if (target) move(key, target);
                } else if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  toggle(entry);
                }
              }}
            >
              <img src={entry.icon} alt="" draggable={false} />
              {entry.custom && <span className="bf-badge-layout-brand">BF</span>}
              {invisible && (
                <svg className="bf-badge-layout-eye" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm1-9 18 18M9 9a4 4 0 0 0 6 6" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
      {!entries.length && <p>Nenhuma badge disponível neste perfil.</p>}
      <p className="bf-badge-layout-notice" role="status">
        {notice}
      </p>
      {code && (
        <p className="bf-badge-layout-code">
          Código: <strong>{code}</strong>
        </p>
      )}
      {!profile?.connected ? (
        <div className="bf-badge-layout-actions">
          <Button
            disabled={busy || !userId}
            onClick={() =>
              task(async () => {
                const result = await Native.beginLayoutConnection(userId!);
                if (mounted.current) {
                  setCode(result.code);
                  setNotice("Confirme este código na página aberta e depois verifique a conexão.");
                }
              })
            }
          >
            Confirmar com Discord
          </Button>
          {code && (
            <Button
              disabled={busy}
              onClick={() =>
                task(async () => {
                  const result = (await Native.checkLayoutConnection(userId!)) as OwnerProfile & {
                    pending?: boolean;
                  };
                  if (!mounted.current) return;
                  if (result.pending) {
                    setNotice("Aguardando sua confirmação no navegador.");
                    return;
                  }
                  accept(result);
                  setCode("");
                  setNotice("Conta confirmada. Você já pode organizar e salvar.");
                })
              }
            >
              Verificar conexão
            </Button>
          )}
        </div>
      ) : (
        <div className="bf-badge-layout-actions">
          <Button disabled={busy} onClick={() => task(save)}>
            Salvar organização
          </Button>
          <Button
            disabled={busy || !profile.badgeLayout}
            onClick={() =>
              task(async () => {
                const result = (await Native.resetProfileLayout(userId!, revision)) as OwnerProfile;
                if (mounted.current) {
                  accept({ ...result, connected: true });
                  onSaved(result);
                  setNotice("Organização padrão restaurada.");
                }
              })
            }
          >
            Restaurar padrão
          </Button>
          <button
            type="button"
            className="bf-badge-layout-link"
            disabled={busy}
            onClick={() =>
              task(async () => {
                const data = (await Native.getEditorProfile(userId!)) as OwnerProfile;
                if (mounted.current) {
                  accept(data);
                  setNotice("Organização atualizada.");
                }
              })
            }
          >
            Atualizar
          </button>
        </div>
      )}
      <button
        type="button"
        className="bf-badge-layout-directory"
        onClick={() => {
          onClose?.();
          DirectoryActions.openBadgeDirectoryModal({ viewingCurrentUserBadges: true });
        }}
      >
        Ver insígnias
      </button>
      <small>
        Esta organização é pública nos clientes ByaFlux. Badges simuladas não são publicadas.
      </small>
    </section>
  );
}
export const BadgeLayoutEditor = ErrorBoundary.wrap(Editor, { noop: true });

export function BadgeCustomizationPanel({
  nativeProps,
  NativePanel,
  useNativeBadges,
  onSaved,
}: {
  nativeProps: Record<string, any>;
  NativePanel: React.ComponentType<any>;
  useNativeBadges: () => any;
  onSaved(profile: unknown): void;
}) {
  return (
    <div className="bf-badge-customization-panel">
      <NativePanel {...nativeProps} />
      <details className="bf-badge-customization-extra" open>
        <summary>Organizar badges do ByaFlux</summary>
        <BadgeLayoutEditor
          {...nativeProps}
          useNativeBadges={useNativeBadges}
          onSaved={onSaved}
          autoFocus={false}
        />
      </details>
    </div>
  );
}
