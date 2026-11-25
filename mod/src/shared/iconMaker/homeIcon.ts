/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";

export const PROJECT_KEY = "ByaFlux.IconMaker.v1";
export const HOME_ICON_KEY = "ByaFlux.IconMaker.HomeIcon.v1";
const STYLE_ID = "byaflux-iconmaker-home";
let imageUrl: string | undefined;
let revision = 0;

function validateImage(value: unknown): asserts value is Blob {
  if (
    !(value instanceof Blob) ||
    !["image/png", "image/gif"].includes(value.type) ||
    !value.size ||
    value.size > 8 * 1024 * 1024
  )
    throw Error("O ícone deve ser um PNG ou GIF de até 8 MB.");
}

function display(image?: Blob) {
  const previous = imageUrl;
  document.getElementById(STYLE_ID)?.remove();
  imageUrl = image ? URL.createObjectURL(image) : undefined;
  if (imageUrl) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    const home = '[data-list-item-id="guildsnav___home"]';
    style.textContent = `
            ${home}, ${home} [class*="childWrapper"] {
                background-image: url("${imageUrl}") !important;
                background-size: cover !important;
                background-position: center !important;
                background-repeat: no-repeat !important;
            }
            ${home} svg { visibility: hidden !important; }
        `;
    (document.head ?? document.documentElement).appendChild(style);
  }
  if (previous) URL.revokeObjectURL(previous);
}

export async function restoreHomeIcon() {
  const current = revision;
  const image = await DataStore.get(HOME_ICON_KEY);
  if (!image || current !== revision) return;
  validateImage(image);
  display(image);
}

export async function saveHomeIcon(image: Blob, project: unknown) {
  validateImage(image);
  const current = ++revision;
  await DataStore.setMany([
    [PROJECT_KEY, project],
    [HOME_ICON_KEY, image],
  ]);
  if (current === revision) display(image);
}

export async function resetHomeIcon() {
  const current = ++revision;
  await DataStore.del(HOME_ICON_KEY);
  if (current === revision) display();
}
