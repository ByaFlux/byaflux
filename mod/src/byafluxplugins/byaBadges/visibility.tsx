import type { ProfileBadge } from "@api/Badges";
import { Switch } from "@components/Switch";
import { React } from "@webpack/common";
import { isSubscriptionBadge } from "../profileBadges/local";
import type { BadgeLayout } from "./layout";

export function applyBadgeVisibility(
  badges: ProfileBadge[],
  layout: BadgeLayout | null,
): ProfileBadge[] {
  if (!layout?.hidden.includes("discord:1")) return badges;
  return badges.filter((badge) => {
    if (badge.id === "byaflux-local-nitro") return false;
    const { layoutKey } = badge as ProfileBadge & { layoutKey?: unknown };
    if (
      (typeof layoutKey === "string" && layoutKey.startsWith("byaflux:")) ||
      (typeof badge.id === "string" && badge.id.startsWith("byaflux_"))
    )
      return true;
    return !isSubscriptionBadge(badge, "nitro");
  });
}

export function BadgeVisibilityControl({
  hidden,
  disabled,
  onChange,
}: {
  hidden: boolean;
  disabled: boolean;
  onChange(hidden: boolean): void;
}) {
  const id = React.useId();
  return (
    <div className="bf-badge-visibility">
      <div>
        <label htmlFor={id}>Ocultar minha badge de Nitro</label>
        <p>
          Ao salvar, esconde qualquer nível da sua Nitro para quem usa uma versão compatível do
          ByaFlux.
        </p>
      </div>
      <Switch id={id} checked={hidden} disabled={disabled} onChange={onChange} />
    </div>
  );
}
