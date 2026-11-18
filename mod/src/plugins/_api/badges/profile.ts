import type { ProfileBadge } from "@api/Badges";

export const profileBadgeUpdatesPatch = {
    find: "UserProfileBadgeListRows",
    replacement: [
        {
            match: /(\(0,\i\.\i\)\(\{location:"UserProfileBadgeListRows"\}\))/,
            replace: "($self.useBadgeUpdates(),$1)"
        },
        {
            match: /(?<=,)(\i)=(\(0,\i\.\i\)\((\i),\i\))(?=,\{pendingBadgeDisplayOrder:)/,
            replace: "$1=$self.mergeProfileBadges($3,$2)"
        }
    ]
};

export function mergeProfileBadges(current: ProfileBadge[], native: ProfileBadge[]): ProfileBadge[] {
    const ids = new Set(current.map(badge => badge.id));
    return [...current, ...native.filter(badge => !ids.has(badge.id) && !badge.id.startsWith("byaflux_") && !badge.id.startsWith("byaflux-local-"))];
}
