/* ByaFlux — profile-scoped badges and automatic IP statistics. GPL-3.0-or-later. */
import { addProfileBadge, BadgePosition, notifyBadgeUpdates, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { Button } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import definePlugin, { PluginNative } from "@utils/types";
import { React } from "@webpack/common";

const Native = VencordNative.pluginHelpers.ByaBadges as PluginNative<typeof import("./native")>;
type RemoteBadge = { id: string; name: string; description: string; icon: string; };
const cache = new Map<string, { until: number; badges: RemoteBadge[]; }>();
const pending = new Set<string>();
let running = false;
let epoch = 0;
let timer: ReturnType<typeof setInterval> | undefined;

async function loadProfile(userId: string) {
    if (!running || pending.has(userId) || !/^\d{17,20}$/.test(userId)) return;
    const current = epoch;
    pending.add(userId);
    try {
        const payload = await Native.fetchProfile(userId) as { profileId?: string; badges?: RemoteBadge[]; };
        if (!running || current !== epoch) return;
        if (payload.profileId !== userId || !Array.isArray(payload.badges)) throw new Error("Resposta de perfil inválida");
        const badges = payload.badges.slice(0, 128).filter(b => b && typeof b.id === "string" && typeof b.name === "string" && typeof b.description === "string" && typeof b.icon === "string" && /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(b.icon));
        if (cache.size >= 200 && !cache.has(userId)) cache.delete(cache.keys().next().value!);
        cache.set(userId, { until: Date.now() + 60000, badges });
        notifyBadgeUpdates();
    } catch {
        if (running && current === epoch) cache.set(userId, { until: Date.now() + 15000, badges: cache.get(userId)?.badges ?? [] });
    } finally { if (current === epoch) pending.delete(userId); }
}
const provider: ProfileBadge = {
    id: "byaflux_badges", position: BadgePosition.FIRST,
    getBadges: ({ userId }) => {
        const saved = cache.get(userId);
        if (running && (!saved || saved.until <= Date.now())) void loadProfile(userId);
        return (saved?.badges ?? []).map(b => ({ id: `byaflux_${b.id}`, name: b.name, description: b.name, detail: b.description, infoLabel: "ByaFlux", iconSrc: b.icon, largeIconSrc: b.icon, props: { style: { objectFit: "contain" } } }));
    }
};
export default definePlugin({
    name: "ByaBadges",
    description: "Badges oficiais do ByaFlux, consultadas por perfil.",
    authors: [{ name: "Haru", id: 1227436212982251533n }],
    required: true, enabledByDefault: true, dependencies: ["BadgeAPI"],
    settingsAboutComponent: () => <div>
        <Paragraph>Badges consultadas por perfil, sem login ou bot. Termos: https://byaflux.discloud.dev/terms.</Paragraph>
        <Button onClick={() => { cache.clear(); notifyBadgeUpdates(); }}>Atualizar badges</Button>
    </div>,
    start() {
        running = true; epoch++; cache.clear(); pending.clear(); addProfileBadge(provider);
        void Native.reportOpen(VERSION).catch(() => {});
        timer = setInterval(() => { void Native.reportOpen(VERSION).catch(() => {}); notifyBadgeUpdates(); }, 60000);
    },
    stop() { running = false; epoch++; clearInterval(timer); cache.clear(); pending.clear(); removeProfileBadge(provider); }
});
