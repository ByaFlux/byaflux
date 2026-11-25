import type { ProfileBadge } from "@api/Badges";

export const profileBadgeUpdatesPatch = {
  find: "UserProfileBadgeListRows",
  replacement: [
    {
      match: /(\(0,\i\.\i\)\(\{location:"UserProfileBadgeListRows"\}\))/,
      replace: "($self.useBadgeUpdates(),$1)",
    },
    {
      match: /(?<=,)(\i)=(\(0,\i\.\i\)\((\i),\i\))(?=,\{pendingBadgeDisplayOrder:)/,
      replace: "$1=$self.mergeProfileBadges($3,$2)",
    },
  ],
};

/** Native profile data can be incomplete during an initial fetch or account switch. */
export function mergeProfileBadges(
  current: ProfileBadge[] | null | undefined,
  native: ProfileBadge[] | null | undefined,
): ProfileBadge[] {
  const valid = (badge: ProfileBadge | null | undefined): badge is ProfileBadge =>
    !!badge && typeof badge.id === "string" && badge.id.length > 0;
  const custom = Array.isArray(current) ? current.filter(valid) : [];
  const ids = new Set(custom.map((badge) => badge.id));
  const result = [...custom];
  for (const badge of Array.isArray(native) ? native : []) {
    if (
      !valid(badge) ||
      ids.has(badge.id) ||
      badge.id.startsWith("byaflux_") ||
      badge.id.startsWith("byaflux-local-")
    )
      continue;
    ids.add(badge.id);
    result.push(badge);
  }
  return result;
}
