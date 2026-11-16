/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
export const imageUrl = (hash: string) => `https://cdn.discordapp.com/badge-icons/${hash}.png`;

type StaticBadge = { key: string; title: string; hash: string };
export const staticBadges: StaticBadge[] = [
    { key: "staff", title: "Discord Staff", hash: "5e74e9b61934fc1f67c65515d1f7e60d" },
    { key: "partner", title: "Partnered Server Owner", hash: "3f9748e53446a137a052f3454e2de41e" },
    { key: "hypesquadEvents", title: "HypeSquad Events", hash: "bf01d1073931f921909045f3a39fd264" },
    { key: "bravery", title: "HypeSquad Bravery", hash: "8a88d63823d8a71cd5e390baa45efa02" },
    { key: "brilliance", title: "HypeSquad Brilliance", hash: "011940fd013da3f7fb926e4a1cd2e618" },
    { key: "balance", title: "HypeSquad Balance", hash: "3aa41de486fa12454c3761e8e223442e" },
    { key: "bugHunter", title: "Bug Hunter Level 1", hash: "2717692c7dca7289b35297368a940dd0" },
    { key: "goldenBugHunter", title: "Bug Hunter Level 2", hash: "848f79194d4be5ff5f81505cbd0ce1e6" },
    { key: "moderator", title: "Moderator Programs Alumni", hash: "fee1624003e2fee35cb398e125dc479b" },
    { key: "earlyDeveloper", title: "Early Verified Bot Developer", hash: "6df5892e0f35b051f8b61eace34f4967" },
    { key: "activeDeveloper", title: "Active Developer", hash: "6bdc42827a38498929a4920da12695d9" },
    { key: "earlySupporter", title: "Early Supporter", hash: "7060786766c9c840eb3019e725d2b358" }
];

export const nitroLevels = [
    { id: "basic", title: "Standard", hash: "2ba85e8026a8614b640c2837bcdfe21b" },
    { id: "bronze", title: "Bronze · 1 month", hash: "4f33c4a9c64ce221936bd256c356f91f" },
    { id: "silver", title: "Silver · 3 months", hash: "4514fab914bdbfb4ad2fa23df76121a6" },
    { id: "gold", title: "Gold · 6 months", hash: "2895086c18d5531d499862e41d1155a6" },
    { id: "platinum", title: "Platinum · 12 months", hash: "0334688279c8359120922938dcb1d6f8" },
    { id: "diamond", title: "Diamond · 24 months", hash: "0d61871f72bb9a33a7ae568c1fb4f20a" },
    { id: "emerald", title: "Emerald · 36 months", hash: "11e2d339068b55d3a506cff34d3780f3" },
    { id: "ruby", title: "Ruby · 60 months", hash: "cd5e2cfd9d7f27a8cdcd3e8a8d5dc9f4" },
    { id: "opal", title: "Opal · 72+ months", hash: "5b154df19c53dce2af92c9b61e6be5e2" }
];

export const boostLevels = [
    { id: "1m", title: "1 month", hash: "51040c70d4f20a921ad6674ff86fc95c" },
    { id: "2m", title: "2 months", hash: "0e4080d1d333bc7ad29ef6528b6f2fb7" },
    { id: "3m", title: "3 months", hash: "72bed924410c304dbe3d00a6e593ff59" },
    { id: "6m", title: "6 months", hash: "df199d2050d3ed4ebf84d64ae83989f8" },
    { id: "9m", title: "9 months", hash: "996b3e870e8a22ce519b3a50e6bdd52f" },
    { id: "12m", title: "12 months", hash: "991c9f39ee33d7537d9f408c3e53141e" },
    { id: "15m", title: "15 months", hash: "cb3ae83c15e970e8f3d410bc62cb8b99" },
    { id: "18m", title: "18 months", hash: "7142225d31238f6387d9f09efaa02759" },
    { id: "24m", title: "24 months", hash: "ec92202290b48d0879b7413d2dde3bab" }
];

export function currentBadge(levels: typeof nitroLevels, id: string) {
    return levels.find(b => b.id === id) ?? levels[0];
}

