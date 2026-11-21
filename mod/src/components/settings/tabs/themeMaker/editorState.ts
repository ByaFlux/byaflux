/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Haru
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import type { ThemeChoices } from "@shared/themeMaker";

export interface EditorSnapshot {
    choices: ThemeChoices;
    name: string;
}
export interface EditorHistory {
    present: EditorSnapshot;
    past: EditorSnapshot[];
    future: EditorSnapshot[];
    baseline: string;
}
export type EditorAction =
    | { type: "change"; update(snapshot: EditorSnapshot): EditorSnapshot }
    | { type: "undo" }
    | { type: "redo" }
    | { type: "load"; snapshot: EditorSnapshot }
    | { type: "saved"; snapshot: EditorSnapshot };
export const snapshotKey = (snapshot: EditorSnapshot) => JSON.stringify(snapshot);
export function createHistory(snapshot: EditorSnapshot): EditorHistory {
    return { present: snapshot, past: [], future: [], baseline: snapshotKey(snapshot) };
}
export function editorHistory(state: EditorHistory, action: EditorAction): EditorHistory {
    if (action.type === "load") return createHistory(action.snapshot);
    if (action.type === "saved")
        return { ...state, present: action.snapshot, baseline: snapshotKey(action.snapshot), future: [] };
    if (action.type === "undo") {
        if (!state.past.length) return state;
        return {
            ...state,
            present: state.past[state.past.length - 1],
            past: state.past.slice(0, -1),
            future: [state.present, ...state.future]
        };
    }
    if (action.type === "redo") {
        if (!state.future.length) return state;
        return {
            ...state,
            present: state.future[0],
            past: [...state.past, state.present],
            future: state.future.slice(1)
        };
    }
    const present = action.update(state.present);
    if (snapshotKey(present) === snapshotKey(state.present)) return state;
    return { ...state, present, past: [...state.past, state.present].slice(-80), future: [] };
}
function luminance(hex: string): number {
    const rgb = [1, 3, 5]
        .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
export function contrastRatio(foreground: string, background: string): number | undefined {
    if (![foreground, background].every(value => /^#[a-f\d]{6}$/i.test(value))) return;
    const a = luminance(foreground),
        b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
