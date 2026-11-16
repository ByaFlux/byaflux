/*
 * ByaFlux — shared profile badges.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { addProfileBadge, BadgePosition, getBadgeRevision, notifyBadgeUpdates, subscribeToBadgeUpdates, ProfileBadge, removeProfileBadge } from "@api/Badges";
import * as DataStore from "@api/DataStore";
import { Button } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import { Logger } from "@utils/Logger";
import definePlugin, { PluginNative } from "@utils/types";
import { React, showToast, UserStore } from "@webpack/common";

import { BadgeCatalog, resolveBadgeIcon, userBadges, validateCatalog } from "./catalog";
import { BADGES_URL } from "./generated";
import { fetchRemoteCatalog } from "./remote";

const Native = VencordNative.pluginHelpers.ByaBadges as PluginNative<typeof import("./native")>;
const logger = new Logger("ByaBadges");
const CACHE_KEY = "ByaBadges:remote:v1";
let catalog: BadgeCatalog | null = null;
let revision = 0;
let running = false;
let refreshing = false;
let syncStatus = "Aguardando carregamento";
let timer: ReturnType<typeof setInterval> | undefined;

const provider: ProfileBadge = {
    id: "byaflux_badges",
    position: BadgePosition.FIRST,
    getBadges: ({ userId }) => {
        const source = BADGES_URL;
        if (!catalog || !source) return [];
        return userBadges(catalog, userId).map(badge => ({
            id: `byaflux_${badge.id}_${revision}`,
            name: badge.name,
            description: badge.name,
            detail: badge.description,
            infoLabel: "ByaFlux",
            iconSrc: resolveBadgeIcon(badge.icon, source),
            largeIconSrc: resolveBadgeIcon(badge.icon, source),
            props: { style: { objectFit: "contain" } }
        }));
    }
};

async function refresh() {
    if (!BADGES_URL || refreshing || !running) return false;
    refreshing = true;
    try {
        const next = validateCatalog(await (Native?.fetchCatalog ? Native.fetchCatalog() : fetchRemoteCatalog(BADGES_URL)));
        if (!running) return false;
        if (JSON.stringify(next) !== JSON.stringify(catalog)) {
            catalog = next;
            revision++;
        }
        syncStatus = "Catálogo atualizado";
        notifyBadgeUpdates();
        // A cache failure must not undo a valid update already in memory.
        await DataStore.set(CACHE_KEY, { source: BADGES_URL, catalog: next }).catch(error => logger.warn("Falha ao salvar cache", error));
        return true;
    } catch (error) {
        syncStatus = error instanceof Error ? error.message : String(error);
        notifyBadgeUpdates();
        throw error;
    } finally { refreshing = false; }
}

function BadgeInfo() {
    const [loading, setLoading] = React.useState(false);
    React.useSyncExternalStore(subscribeToBadgeUpdates, getBadgeRevision, getBadgeRevision);
    const userId = UserStore.getCurrentUser()?.id;
    const assigned = catalog && userId ? userBadges(catalog, userId).map(badge => badge.name) : [];

    return <div>
        <Paragraph>ByaBadges é obrigatório. As badges são exibidas para todos que usam ByaFlux.</Paragraph>
        <Paragraph>{BADGES_URL ? "O catálogo é atualizado a cada 5 minutos. Após atualizar, reabra o perfil." : "A fonte pública das badges ainda não foi configurada."}</Paragraph>
        <Paragraph>Sincronização: {syncStatus}</Paragraph>
        <Paragraph>Seu ID: {userId ?? "Carregando"}</Paragraph>
        <Paragraph>Suas badges: {assigned.length ? assigned.join(", ") : "Nenhuma atribuída neste catálogo"}</Paragraph>
        <Button disabled={!BADGES_URL || loading} onClick={async () => {
            setLoading(true);
            try {
                const updated = await refresh();
                showToast({ text: updated ? "Badges atualizadas. Reabra o perfil para visualizar." : "A atualização já está em andamento." });
            } catch (error) {
                logger.error(error);
                showToast({ text: "Não foi possível atualizar. O último catálogo válido foi mantido." });
            } finally { setLoading(false); }
        }}>Atualizar badges</Button>
    </div>;
}

export default definePlugin({
    name: "ByaBadges",
    description: "Badges oficiais do ByaFlux, sincronizadas por catálogo público.",
    authors: [],
    required: true,
    enabledByDefault: true,
    dependencies: ["BadgeAPI"],
    settingsAboutComponent: BadgeInfo,
    async start() {
        running = true;
        catalog = null;
        revision++;
        addProfileBadge(provider);
        if (!BADGES_URL) return;
        try {
            const cached = await DataStore.get<{ source: string; catalog: BadgeCatalog; }>(CACHE_KEY);
            if (running && cached?.source === BADGES_URL) {
                catalog = validateCatalog(cached.catalog);
                revision++;
                syncStatus = "Usando catálogo em cache";
                notifyBadgeUpdates();
            }
        } catch (error) { logger.warn("Cache inválido; aguardando catálogo remoto", error); }
        if (!running) return;
        void refresh().catch(error => logger.warn("Usando o último catálogo válido", error));
        timer = setInterval(() => void refresh().catch(error => logger.warn("Falha ao atualizar badges", error)), 5 * 60 * 1000);
    },
    stop() {
        running = false;
        clearInterval(timer);
        removeProfileBadge(provider);
    }
});
