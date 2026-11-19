/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from "react";
import { createRoot } from "react-dom/client";

import { ThemeMakerEditor } from "../../src/components/settings/tabs/themeMaker";
async function api(path, body) {
    const response = await fetch(path, {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error);
    return data;
}
const state = await api("/settings");
document.getElementById("client-theme").textContent = await (await fetch("/active-css")).text();
const settings = new Proxy(state, {
    set(target, key, value) {
        target[key] = value;
        void api("/settings", target).then(async () => {
            document.getElementById("client-theme").textContent = await (await fetch("/active-css")).text();
        });
        return true;
    }
});
const adapter = {
    getCtmThemes: () => api("/ctm-themes"),
    saveCtmTheme: request => api("/ctm-save", request)
};
createRoot(document.getElementById("root")).render(<ThemeMakerEditor adapter={adapter} themeSettings={settings} />);
