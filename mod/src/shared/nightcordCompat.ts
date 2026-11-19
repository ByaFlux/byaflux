/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showToast } from "@webpack/common";

export const t = (text: string) => text;
export const Toasts = {
    Type: { MESSAGE: 0, SUCCESS: 1, FAILURE: 2 },
    genId: () => crypto.randomUUID(),
    show({ message, type }: { message: string; type: number; id: string; }) {
        showToast({ text: message, ...(type === 1 ? { variant: "success" } : type === 2 ? { variant: "critical" } : {}) });
    }
};
