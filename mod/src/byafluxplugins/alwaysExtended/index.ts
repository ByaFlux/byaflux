/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

export default definePlugin({
    name: "AlwaysExtended",
    description: "Mantém a área de badges dos perfis expandida, mostrando todas sem agrupar em +N.",
    authors: [{ name: "Haru", id: 1227436212982251533n }],
    enabledByDefault: true,
    patches: [{
        find: "UserProfileBadgeListRows",
        replacement: {
            match: /let (\i)=\i&&!\i(?=,\i=\1\?Math\.max\()/,
            replace: "let $1=!1"
        }
    }]
});
