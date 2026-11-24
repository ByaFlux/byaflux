/* ByaFlux — profile badges and public layout. GPL-3.0-or-later. */
import {
  addProfileBadge,
  addProfileBadgeTransform,
  BadgePosition,
  notifyBadgeUpdates,
  ProfileBadge,
  removeProfileBadge,
  removeProfileBadgeTransform,
  setPublicBadgeLayout,
} from "@api/Badges";
import { Button } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import definePlugin, { PluginNative } from "@utils/types";
import { Modal, openModal, React, UserStore } from "@webpack/common";
import { BadgeLayoutEditor, BadgeCustomizationPanel } from "./editor";
import { applyBadgeLayout, BadgeLayout, readBadgeLayout } from "./layout";
import "./layout.css";

const Native = VencordNative.pluginHelpers.ByaBadges as PluginNative<typeof import("./native")>;
type RemoteBadge = { id: string; name: string; description: string; icon: string };
type SavedProfile = {
  until: number;
  badges: RemoteBadge[];
  layout: BadgeLayout | null;
  revision: number;
};
const cache = new Map<string, SavedProfile>();
const pending = new Set<string>();
let running = false;
let epoch = 0;
let timer: ReturnType<typeof setInterval> | undefined;
function installProfile(payload: any) {
  const userId = payload?.profileId;
  if (!/^\d{17,20}$/.test(userId ?? "") || !Array.isArray(payload.badges))
    throw new Error("Perfil inválido.");
  const layout = readBadgeLayout(payload.badgeLayout);
  const revision = Number.isSafeInteger(payload.layoutRevision)
    ? payload.layoutRevision
    : (layout?.revision ?? 0);
  if ((cache.get(userId)?.revision ?? 0) > revision) return;
  const hidden = new Set(layout?.hidden ?? []);
  const badges = payload.badges
    .slice(0, 128)
    .filter(
      (b: any) =>
        b &&
        typeof b.id === "string" &&
        typeof b.name === "string" &&
        typeof b.description === "string" &&
        typeof b.icon === "string" &&
        /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(b.icon) &&
        !hidden.has(`byaflux:${b.id}`),
    );
  if (cache.size >= 200 && !cache.has(userId)) {
    const oldest = cache.keys().next().value!;
    cache.delete(oldest);
    setPublicBadgeLayout(oldest, false);
  }
  cache.set(userId, { until: Date.now() + 15000, badges, layout, revision });
  setPublicBadgeLayout(userId, !!layout);
  notifyBadgeUpdates();
}
async function loadProfile(userId: string) {
  if (!running || pending.has(userId) || !/^\d{17,20}$/.test(userId)) return;
  const current = epoch;
  pending.add(userId);
  try {
    const payload = (await Native.fetchProfile(userId)) as { profileId?: string };
    if (!running || current !== epoch) return;
    if (payload.profileId !== userId) throw new Error("Perfil inválido.");
    installProfile(payload);
  } catch {
    const previous = cache.get(userId);
    if (running && current === epoch)
      cache.set(userId, {
        until: Date.now() + 15000,
        badges: previous?.badges ?? [],
        layout: previous?.layout ?? null,
        revision: previous?.revision ?? 0,
      });
  } finally {
    if (current === epoch) pending.delete(userId);
  }
}
const provider: ProfileBadge = {
  id: "byaflux_badges",
  position: BadgePosition.FIRST,
  getBadges: ({ userId }) => {
    const saved = cache.get(userId);
    if (running && (!saved || saved.until <= Date.now())) void loadProfile(userId);
    return (saved?.badges ?? []).map((b) => ({
      id: `byaflux_${b.id}`,
      layoutKey: `byaflux:${b.id}`,
      name: b.name,
      description: b.name,
      detail: b.description,
      infoLabel: "ByaFlux",
      iconSrc: b.icon,
      largeIconSrc: b.icon,
      props: { style: { objectFit: "contain" } },
    }));
  },
};
export function openLayoutEditor() {
  openModal((props) => (
    <Modal {...props} title="Personalize suas insígnias" size="md">
      <BadgeLayoutEditor onSaved={installProfile} />
    </Modal>
  ));
}
export default definePlugin({
  name: "ByaBadges",
  description: "Badges oficiais do ByaFlux e organização pública do perfil.",
  authors: [{ name: "Haru", id: 1227436212982251533n }],
  required: true,
  enabledByDefault: true,
  dependencies: ["BadgeAPI"],
  patches: [
    {
      find: 'action:"VIEW_BADGE_CUSTOMIZATION"',
      replacement: {
        match:
          /function (\i)\((\i)\)\{(?=let\{onClose:\i,returnFocusRef:\i,skipReturnFocusRef:\i\}=)(?=[\s\S]{0,2000}?action:"VIEW_BADGE_CUSTOMIZATION")(?=[\s\S]{0,3000}?\{fixedBadges:\i,reorderableBadges:\i,hiddenBadges:\i\}=\(0,(\i)\.(\i)\)\(\))/,
        replace:
          "function $1($2){return $self.renderLayoutEditor($2,$3.$4,byafluxNative_$1)}function byafluxNative_$1($2){",
      },
    },
  ],
  renderLayoutEditor(
    props: any,
    useNativeBadges: () => any,
    NativePanel: React.ComponentType<any>,
  ) {
    return (
      <BadgeCustomizationPanel
        nativeProps={props}
        NativePanel={NativePanel}
        useNativeBadges={useNativeBadges}
        onSaved={installProfile}
      />
    );
  },
  settingsAboutComponent: () => (
    <div>
      <Paragraph>
        A ordem e a visibilidade das badges do ByaFlux podem ser publicadas para outros usuários do
        cliente. Somente o dono do perfil pode salvar.
      </Paragraph>
      <Button onClick={openLayoutEditor}>Personalizar insígnias</Button>
      <Button
        onClick={() => {
          for (const saved of cache.values()) saved.until = 0;
          notifyBadgeUpdates();
        }}
      >
        Atualizar badges
      </Button>
    </div>
  ),
  start() {
    running = true;
    epoch++;
    cache.clear();
    pending.clear();
    addProfileBadge(provider);
    addProfileBadgeTransform(
      "ByaFlux.PublicBadgeLayout",
      (args, badges) => applyBadgeLayout(badges, cache.get(args.userId)?.layout ?? null),
      100,
    );
    void Native.reportOpen(VERSION).catch(() => {});
    let count = 0;
    timer = setInterval(() => {
      if (++count % 4 === 0) void Native.reportOpen(VERSION).catch(() => {});
      notifyBadgeUpdates();
    }, 15000);
  },
  stop() {
    running = false;
    epoch++;
    clearInterval(timer);
    for (const id of cache.keys()) setPublicBadgeLayout(id, false);
    cache.clear();
    pending.clear();
    removeProfileBadge(provider);
    removeProfileBadgeTransform("ByaFlux.PublicBadgeLayout");
  },
});
