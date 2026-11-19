/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from "react";
export const wrapTab = component => component;
export function SettingsTab(props) {
    return <section>{props.children}</section>;
}
