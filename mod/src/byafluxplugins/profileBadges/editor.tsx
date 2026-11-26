/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { getBadgeRevision, subscribeToBadgeUpdates } from "@api/Badges";
import { Paragraph } from "@components/Paragraph";
import { classes } from "@utils/misc";
import { Checkbox, React } from "@webpack/common";

import { BadgeLevel, currentBadge, imageUrl, staticBadges, tieredBadges } from "./badges";
import {
  badgeOrder,
  BadgeRect,
  BadgeSelection,
  dragOffset,
  dragTarget,
  emptySelection,
  moveBadge,
} from "./local";

interface EditorProps {
  selection: BadgeSelection;
  save(change: Partial<BadgeSelection>): void;
}

interface DragSession {
  key: string;
  from: number;
  to: number;
  rects: BadgeRect[];
  startY: number;
  startScroll: number;
  pointerY: number;
  settling: boolean;
}

interface DragState {
  key: string;
  to: number;
  offset: number;
  settling: boolean;
}

export function LevelPicker({
  levels,
  value,
  onChange,
}: {
  levels: readonly BadgeLevel[];
  value: string;
  onChange(value: string): void;
}) {
  return (
    <div className="vc-profilebadges-levels" role="group" aria-label="Nível da badge">
      {levels.map((level) => (
        <Button
          key={level.id}
          type="button"
          variant="secondary"
          size="small"
          className={classes(
            "vc-profilebadges-level",
            level.id === value && "vc-profilebadges-level-selected",
          )}
          aria-pressed={level.id === value}
          onClick={() => onChange(level.id)}
        >
          <img src={imageUrl(level.hash)} alt="" />
          <span>{level.title}</span>
        </Button>
      ))}
    </div>
  );
}

export function BadgeEditor({ selection, save }: EditorProps) {
  React.useSyncExternalStore(subscribeToBadgeUpdates, getBadgeRevision, getBadgeRevision);
  const order = badgeOrder(selection.order);
  const list = React.useRef<HTMLDivElement>(null);
  const rows = React.useRef(new Map<string, HTMLDivElement>());
  const session = React.useRef<DragSession | null>(null);
  const settleTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const [notice, setNotice] = React.useState("");

  function updateDrag(clientY: number) {
    const current = session.current;
    if (!current || current.settling) return;
    current.pointerY = clientY;
    const offset = clientY - current.startY + (list.current?.scrollTop ?? 0) - current.startScroll;
    const origin = current.rects[current.from];
    current.to = dragTarget(current.rects, origin.top + origin.height / 2 + offset);
    setDrag({ key: current.key, to: current.to, offset, settling: false });
  }

  function startDrag(key: string, event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || session.current) return;
    const rects = order.map((id) => rows.current.get(id)?.getBoundingClientRect());
    if (rects.some((rect) => !rect)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const from = order.indexOf(key);
    session.current = {
      key,
      from,
      to: from,
      rects: rects.filter((rect): rect is DOMRect => rect !== undefined),
      startY: event.clientY,
      pointerY: event.clientY,
      startScroll: list.current?.scrollTop ?? 0,
      settling: false,
    };
    setDrag({ key, to: from, offset: 0, settling: false });
  }

  function finishDrag(cancel = false) {
    const current = session.current;
    if (!current || current.settling) return;
    current.settling = true;
    const to = cancel ? current.from : current.to;
    setDrag({
      key: current.key,
      to,
      offset: dragOffset(current.rects, current.from, to, current.from),
      settling: true,
    });
    settleTimer.current = setTimeout(() => {
      if (!cancel && to !== current.from) save({ order: moveBadge(order, current.from, to) });
      setNotice(cancel ? "Movimento cancelado." : `Badge movida para a posição ${to + 1}.`);
      session.current = null;
      setDrag(null);
    }, 200);
  }

  React.useEffect(() => () => clearTimeout(settleTimer.current), []);
  const dragging = drag !== null && !drag.settling;
  React.useEffect(() => {
    if (!dragging) return;
    const timer = setInterval(() => {
      const current = session.current;
      const element = list.current;
      if (!current || current.settling || !element) return;
      const bounds = element.getBoundingClientRect();
      const direction =
        current.pointerY < bounds.top + 36 ? -1 : current.pointerY > bounds.bottom - 36 ? 1 : 0;
      if (direction) element.scrollBy({ top: direction * 10, behavior: "instant" });
    }, 16);
    return () => clearInterval(timer);
  }, [dragging]);

  function toggle(key: string, enabled: boolean) {
    save({
      selectedBadges: enabled
        ? [...new Set([...selection.selectedBadges, key])]
        : selection.selectedBadges.filter((item) => item !== key),
    });
  }

  return (
    <div className="vc-profilebadges-content">
      <Paragraph>
        Somente você vê estas alterações. Elas não concedem Nitro, benefícios ou badges reais.
      </Paragraph>
      <Paragraph>
        Segure ⋮⋮ e arraste para mudar a ordem no perfil. As alterações são salvas automaticamente.
      </Paragraph>
      <div
        ref={list}
        className={classes(
          "vc-profilebadges-list",
          drag !== null && "vc-profilebadges-list-dragging",
        )}
        onScroll={() => {
          if (session.current) updateDrag(session.current.pointerY);
        }}
      >
        {order.map((key, index) => {
          const group = tieredBadges.find((group) => group.key === key);
          const levels = group?.levels;
          const level = group ? currentBadge(group.levels, selection[group.field]).id : "";
          const badge = staticBadges.find((badge) => badge.key === key);
          const title = badge?.title ?? group?.title ?? key;
          const hash = badge?.hash ?? (levels ? currentBadge(levels, level).hash : "");
          const selected = selection.selectedBadges.includes(key);
          const moving = drag?.key === key;
          const offset =
            drag && session.current
              ? moving
                ? drag.offset
                : dragOffset(session.current.rects, session.current.from, drag.to, index)
              : 0;
          return (
            <div
              key={key}
              ref={(element) => {
                if (element) rows.current.set(key, element);
                else rows.current.delete(key);
              }}
              className={classes(
                "vc-profilebadges-sortable",
                moving && "vc-profilebadges-lifted",
                moving && !drag?.settling && "vc-profilebadges-following",
              )}
              style={{
                transform: `translate3d(0, ${offset}px, 0)${moving && !drag?.settling ? " scale(1.015)" : ""}`,
              }}
            >
              <div className="vc-profilebadges-row">
                <Button
                  type="button"
                  variant="none"
                  size="iconOnly"
                  className="vc-profilebadges-handle"
                  aria-label={`Mover ${title}. Arraste ou use as setas para cima e para baixo.`}
                  onPointerDown={(event) => startDrag(key, event)}
                  onPointerMove={(event) => {
                    if (session.current?.key === key) updateDrag(event.clientY);
                  }}
                  onPointerUp={() => finishDrag()}
                  onPointerCancel={() => finishDrag(true)}
                  onLostPointerCapture={() => finishDrag(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      finishDrag(true);
                      return;
                    }
                    if (session.current || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
                    event.preventDefault();
                    const to = Math.max(
                      0,
                      Math.min(order.length - 1, index + (event.key === "ArrowUp" ? -1 : 1)),
                    );
                    save({ order: moveBadge(order, index, to) });
                    setNotice(`${title}: posição ${to + 1}.`);
                  }}
                >
                  <span className="vc-profilebadges-grip" aria-hidden="true">
                    {[0, 1, 2, 3].map((dot) => (
                      <span key={dot} />
                    ))}
                  </span>
                </Button>
                <div className="vc-profilebadges-row-content">
                  <Checkbox value={selected} onChange={() => toggle(key, !selected)}>
                    <span className="vc-profilebadges-option">
                      <img src={imageUrl(hash)} alt="" />
                      {title}
                    </span>
                  </Checkbox>
                  {levels && selected && (
                    <LevelPicker
                      levels={levels}
                      value={level}
                      onChange={(value) => save({ [group!.field]: value })}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <span className="vc-profilebadges-announcement" role="status">
        {notice}
      </span>
      <Button
        type="button"
        variant="secondary"
        disabled={drag !== null}
        onClick={() => save({ ...emptySelection, selectedBadges: [], order: badgeOrder() })}
      >
        Restaurar badges reais
      </Button>
    </div>
  );
}
