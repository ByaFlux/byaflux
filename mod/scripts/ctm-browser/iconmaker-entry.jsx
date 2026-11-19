/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import React from "react";
import { createRoot } from "react-dom/client";

import { IconMakerEditor } from "../../src/components/settings/tabs/iconMaker";
window.setImmediate = callback => setTimeout(callback, 0);
createRoot(document.getElementById("root")).render(<IconMakerEditor />);
