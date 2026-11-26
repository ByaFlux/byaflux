import {
  addProfileBadgeTransform,
  notifyBadgeUpdates,
  removeProfileBadgeTransform,
} from "@api/Badges";
import { Paragraph } from "@components/Paragraph";
import BadgeAPI from "@plugins/_api/badges";
import {
  boostGems,
  getBoostGemImage,
  getUserBoostGem,
  replaceBoostGem,
  replaceUserBoostGems,
  setBoostGemsEnabled,
} from "@shared/boostGems";
import definePlugin from "@utils/types";
import { findStore } from "@webpack";
import { React } from "@webpack/common";

let restore: (() => void) | undefined;

export default definePlugin({
  name: "BetterNitroGem",
  description: "Substitui as badges de Boost por gemas animadas, incluindo as do FakeBadges.",
  authors: [{ name: "Haru", id: 1227436212982251533n }],
  enabledByDefault: false,
  dependencies: ["BadgeAPI"],
  settingsAboutComponent: () => (
    <div>
      <Paragraph>
        Gemas animadas para os nove níveis de Boost. A alteração é visual, apenas no seu ByaFlux.
      </Paragraph>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {boostGems.map((gem) => (
          <div key={gem.id} style={{ textAlign: "center" }}>
            <img src={gem.image} alt={`Boost de ${gem.months} meses`} width={40} height={40} />
            <div>
              {gem.months} {gem.months === 1 ? "mês" : "meses"}
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
  start() {
    const Directory = findStore("BadgeDirectoryStore") as {
      getBadgeById(id: number | string, userId?: string): Record<string, unknown> | undefined;
    } | null;
    if (typeof Directory?.getBadgeById !== "function")
      throw new Error("Reinicie o Discord para carregar o catálogo de badges.");
    const badgeDescriptor = Object.getOwnPropertyDescriptor(Directory, "getBadgeById");
    setBoostGemsEnabled(true);
    addProfileBadgeTransform(
      "ByaFlux.BetterNitroGem",
      (args, badges) => replaceUserBoostGems(args.userId, badges),
      400,
    );
    const originalId = BadgeAPI.getDirectoryBadgeId;
    const originalBadge = Directory.getBadgeById;
    const directoryId: typeof originalId = function (badgeId, userId) {
      if (badgeId === "byaflux-local-boost" && getBoostGemImage(boostGems[0].hash)) return 12;
      return originalId.call(BadgeAPI, badgeId, userId);
    };
    const directoryBadge: typeof originalBadge = function (id, userId) {
      const badge = originalBadge.call(Directory, id, userId);
      if (!badge) return badge;
      const gem = (id === 12 || id === "12") && userId ? getUserBoostGem(userId) : undefined;
      return replaceBoostGem(badge, gem);
    };
    BadgeAPI.getDirectoryBadgeId = directoryId;
    Directory.getBadgeById = directoryBadge;
    restore = () => {
      if (BadgeAPI.getDirectoryBadgeId === directoryId) BadgeAPI.getDirectoryBadgeId = originalId;
      if (Directory.getBadgeById === directoryBadge) {
        if (badgeDescriptor) Object.defineProperty(Directory, "getBadgeById", badgeDescriptor);
        else Reflect.deleteProperty(Directory, "getBadgeById");
      }
    };
    notifyBadgeUpdates();
  },
  stop() {
    restore?.();
    restore = undefined;
    setBoostGemsEnabled(false);
    removeProfileBadgeTransform("ByaFlux.BetterNitroGem");
    notifyBadgeUpdates();
  },
});
