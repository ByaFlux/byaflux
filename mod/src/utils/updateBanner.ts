/*
 * ByaFlux, a Discord client mod
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./updateBanner.css";

let disposeCurrent: (() => void) | undefined;

/** A top notice that does not depend on Discord's private NoticeStore queue. */
export function showUpdateBanner(onUpdate: () => Promise<void>, doc: Document = document) {
    disposeCurrent?.();
    const win = doc.defaultView;
    if (!win) throw new Error("A janela do Discord não está disponível.");
    const view = win;
    const bar = doc.createElement("section");
    bar.id = "byaflux-update-banner";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Atualização do ByaFlux");
    const text = doc.createElement("span");
    text.setAttribute("role", "status");
    text.textContent = "Uma nova versão do ByaFlux está disponível.";
    const update = doc.createElement("button");
    update.type = "button";
    update.className = "byaflux-update-action";
    update.textContent = "Atualizar e reiniciar";
    const close = doc.createElement("button");
    close.type = "button";
    close.className = "byaflux-update-close";
    close.textContent = "×";
    close.setAttribute("aria-label", "Dispensar aviso de atualização");
    bar.append(text, update, close);

    let busy = false;
    let disposed = false;
    let frame = 0;
    let host: HTMLElement | undefined;
    let mode = "";
    const margins = new Map<HTMLElement, { value: string; priority: string; pixels: number; }>();
    let padding: { element: HTMLElement; value: string; priority: string; pixels: number; } | undefined;

    function restoreLayout() {
        for (const [element, previous] of margins) {
            element.style.setProperty("margin-block-start", previous.value, previous.priority);
        }
        margins.clear();
        if (padding) padding.element.style.setProperty("padding-block-start", padding.value, padding.priority);
        padding = undefined;
    }

    function layout() {
        frame = 0;
        if (disposed) return;
        const mount = doc.getElementById("app-mount") ?? doc.body;
        const candidates = [mount, ...mount.querySelectorAll<HTMLElement>('[data-fullscreen], [class*="base_"], [class*="app_"]')];
        const grid = candidates.map(element => ({ element, style: view.getComputedStyle(element) }))
            .find(({ style }) => style.display === "grid" && /\b(?:notice|notices)\b/.test(style.gridTemplateAreas));
        const area = grid?.style.gridTemplateAreas.match(/\b(?:notice|notices)\b/)?.[0];
        const fallback = candidates.find(element => element !== mount && element.matches('[data-fullscreen], [class*="base_"]'));
        const nextHost = grid?.element ?? fallback ?? mount;
        const nextMode = grid && area ? "grid" : "fixed";
        if (host !== nextHost || mode !== nextMode) {
            restoreLayout();
            host = nextHost;
            mode = nextMode;
        }
        if (bar.parentElement !== host) host.append(bar);
        bar.dataset.layout = mode;
        if (mode === "grid" && area) {
            bar.style.gridArea = area;
            bar.style.removeProperty("top");
            // Stack above another native notice instead of covering it.
            const height = bar.getBoundingClientRect().height || 32;
            for (const child of host.children) {
                if (child === bar || !(child instanceof view.HTMLElement)) continue;
                const style = view.getComputedStyle(child);
                if (style.gridArea.split(" /")[0] !== area && style.gridRowStart !== area) continue;
                if (!margins.has(child)) margins.set(child, {
                    value: child.style.getPropertyValue("margin-block-start"),
                    priority: child.style.getPropertyPriority("margin-block-start"),
                    pixels: parseFloat(style.marginBlockStart) || 0
                });
                child.style.setProperty("margin-block-start", `${margins.get(child)!.pixels + height}px`);
            }
        } else {
            bar.style.removeProperty("grid-area");
            const titleBar = doc.querySelector<HTMLElement>('[data-window-chrome="true"], [class*="typeWindows_"]');
            const title = titleBar?.getBoundingClientRect();
            const chromeBottom = title && title.top < 64 && title.bottom < 96 ? title.bottom : 0;
            bar.style.top = `${Math.max(chromeBottom, host.getBoundingClientRect().top)}px`;
            if (host !== mount) {
                padding ??= {
                    element: host,
                    value: host.style.getPropertyValue("padding-block-start"),
                    priority: host.style.getPropertyPriority("padding-block-start"),
                    pixels: parseFloat(view.getComputedStyle(host).paddingBlockStart) || 0
                };
                host.style.setProperty("padding-block-start", `${padding.pixels + (bar.getBoundingClientRect().height || 32)}px`);
            }
        }
    }

    function schedule() {
        if (!disposed && !frame) frame = view.requestAnimationFrame(layout);
    }
    const observer = new view.MutationObserver(schedule);
    observer.observe(doc.getElementById("app-mount") ?? doc.body, { childList: true, subtree: true });
    const resize = new view.ResizeObserver(schedule);
    resize.observe(bar);
    view.addEventListener("resize", schedule);

    function dispose() {
        if (disposed) return;
        disposed = true;
        observer.disconnect();
        resize.disconnect();
        view.cancelAnimationFrame(frame);
        view.removeEventListener("resize", schedule);
        restoreLayout();
        bar.remove();
        if (disposeCurrent === dispose) disposeCurrent = undefined;
    }
    close.onclick = dispose;
    update.onclick = async () => {
        if (busy || disposed) return;
        busy = true;
        update.disabled = close.disabled = true;
        update.setAttribute("aria-busy", "true");
        update.textContent = "Baixando atualização…";
        text.textContent = "O Discord será reiniciado após concluir a atualização.";
        bar.dataset.state = "downloading";
        try {
            await onUpdate();
            if (!disposed) {
                text.textContent = "Atualização concluída. Reiniciando o Discord…";
                update.textContent = "Reiniciando…";
            }
        } catch {
            if (!disposed) {
                busy = false;
                update.disabled = close.disabled = false;
                update.removeAttribute("aria-busy");
                text.textContent = "Não foi possível atualizar o ByaFlux. Tente novamente ou abra ByaFlux → Updater.";
                update.textContent = "Tentar novamente";
                bar.dataset.state = "error";
            }
        }
    };
    disposeCurrent = dispose;
    layout();
    return dispose;
}
