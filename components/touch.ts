'use client';
import { useEffect } from 'react';
import { useGame, player, T, Tx } from './store';

/**
 * Shared movement + action input.
 * The on-screen joystick writes an analog vector here (x: right, z: down-screen / towards camera),
 * exactly the same axes the keyboard (arrows / WASD) feeds into Player.
 */
export const stick = { x: 0, z: 0, active: false };

/** Things the action button (or E / Enter on desktop) can use when the player stands close to them. */
export type Act = {
  icon: string;
  label?: Tx; // prompt shown next to the action button, e.g. "Talk to Snow White"
  pos: () => [number, number] | null; // null = currently unavailable
  r: number; // reach radius (world units)
  run: () => void;
};
export const acts = new Map<string, Act>();

export function useAct(id: string, act: Act) {
  useEffect(() => {
    acts.set(id, act);
    return () => { if (acts.get(id) === act) acts.delete(id); };
  });
}

export function nearestAct(): (Act & { id: string }) | null {
  let best: (Act & { id: string }) | null = null; let bd = Infinity;
  acts.forEach((a, id) => {
    const p = a.pos(); if (!p) return;
    const d = Math.hypot(player.pos.x - p[0], player.pos.z - p[1]);
    if (d < a.r && d / a.r < bd) { bd = d / a.r; best = { ...a, id }; }
  });
  return best;
}

/** What the action button does right now (null = nothing to do). */
export function currentAction(): { icon: string; label?: Tx; run: () => void } | null {
  const g = useGame.getState();
  if (g.mini || g.guideOpen || g.bookOpen) return null;
  if (g.scene !== 'forest' && g.scene !== 'cottage') return null;
  const line = g.lines[g.lineIdx];
  if (line) return line.choices ? null : { icon: '▶', label: T('다음', 'Next'), run: () => g.next() };
  if (g.sleeping) return { icon: '👆', label: T('깨우기', 'Wake up'), run: () => g.tap() };
  if (g.sitting) return { icon: '🧍', label: T('일어나기', 'Stand up'), run: () => g.standUp() };
  const a = nearestAct();
  return a ? { icon: a.icon, label: a.label, run: () => { useGame.setState({ target: null, pending: null }); a.run(); } } : null;
}

export function doAction() {
  const a = currentAction();
  if (a) a.run();
  return !!a;
}

// keyboard equivalent of the action button (desktop)
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    // desktop: Enter = next line / confirm, E = interact (Space is jump, see Player)
    const t = e.target as HTMLElement | null;
    if (/^[1-3]$/.test(k) && !(t && /^(INPUT|TEXTAREA)$/.test(t.tagName))) { // pick dialogue choice 1/2/3
      const g = useGame.getState(); const c = g.lines[g.lineIdx]?.choices?.[+k - 1];
      if (c) { g.choose(c.id); e.preventDefault(); }
      return;
    }
    if (k !== 'e' && k !== 'enter') return;
    if (t && (t.tagName === 'BUTTON' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (doAction()) e.preventDefault();
  });
  const w = window as unknown as { __snow?: Record<string, unknown> };
  w.__snow = Object.assign(w.__snow || {}, { stick, nearestAct, currentAction, doAction });
}
