'use client';
import { useEffect, useRef, useState } from 'react';
import { useGame, T, Tx, useTx, jump } from './store';
import { stick, currentAction } from './touch';
import { sfx } from './audio';

/** true on phones / tablets (coarse pointer or any touch input seen). */
export function useTouchDevice() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(pointer: coarse)');
    // phones/tablets only: a desktop with a mouse (even a touch-screen laptop) keeps keyboard controls until it is actually touched
    const qs = new URLSearchParams(location.search);
    const check = () => setTouch(!qs.has('desktop') && (q.matches || qs.has('touch')));
    check();
    const onPtr = (e: PointerEvent) => { if (e.pointerType === 'touch') setTouch(true); };
    q.addEventListener?.('change', check);
    window.addEventListener('pointerdown', onPtr, true);
    return () => { q.removeEventListener?.('change', check); window.removeEventListener('pointerdown', onPtr, true); };
  }, []);
  return touch;
}


function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const pid = useRef<number | null>(null);
  const center = useRef({ x: 0, y: 0 });
  const rad = useRef(46); // max knob travel (px)

  const setKnob = (x: number, y: number) => { if (knob.current) knob.current.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`; };
  const update = (cx: number, cy: number) => {
    let x = cx - center.current.x, y = cy - center.current.y;
    const d = Math.hypot(x, y), R = rad.current;
    if (d > R) { x = (x / d) * R; y = (y / d) * R; }
    setKnob(x, y);
    stick.x = x / R; stick.z = y / R; stick.active = true;
  };
  const release = () => { pid.current = null; stick.x = 0; stick.z = 0; stick.active = false; setKnob(0, 0); base.current?.classList.remove('on'); };
  useEffect(() => release, []);

  return (
    <div className="joy" ref={base} aria-label="joystick"
      onPointerDown={(e) => {
        if (pid.current !== null) return;
        e.preventDefault();
        pid.current = e.pointerId;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
        const r = e.currentTarget.getBoundingClientRect();
        center.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; rad.current = r.width * 0.36;
        base.current?.classList.add('on');
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => { if (e.pointerId === pid.current) { e.preventDefault(); update(e.clientX, e.clientY); } }}
      onPointerUp={(e) => { if (e.pointerId === pid.current) release(); }}
      onPointerCancel={(e) => { if (e.pointerId === pid.current) release(); }}
      onLostPointerCapture={(e) => { if (e.pointerId === pid.current) release(); }}
      onContextMenu={(e) => e.preventDefault()}>
      <span className="joy-arrows" aria-hidden>▲<i>◀</i><i>▶</i>▼</span>
      <div className="joy-knob" ref={knob} />
    </div>
  );
}

function useCurrentAction() {
  const [act, setAct] = useState<{ icon: string; label?: Tx } | null>(null);
  useEffect(() => {
    let last = '';
    const poll = () => {
      const a = currentAction(); const k = a ? a.icon + (a.label?.ko ?? '') : '';
      if (k !== last) { last = k; setAct(a ? { icon: a.icon, label: a.label } : null); }
    };
    let raf = 0; const loop = () => { poll(); raf = requestAnimationFrame(loop); };
    const iv = setInterval(poll, 200); // also works in frame-stepped capture mode
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); clearInterval(iv); };
  }, []);
  return act;
}

function ActionButtons() {
  const act = useCurrentAction();
  const tx = useTx();
  return (
    <>
      {act?.label && <div className="act-prompt">{act.icon} {tx(act.label)}</div>}
      <button className="jumpbtn" aria-label={tx(T('점프', 'Jump'))}
        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); jump(); }}
        onContextMenu={(e) => e.preventDefault()}>
        <span className="act-ico">⤴️</span><small>{tx(T('점프', 'Jump'))}</small>
      </button>
      <button className={`actbtn ${act ? 'ready' : ''}`} aria-label={tx(T('말하기 / 행동', 'Talk / Action'))}
        onPointerDown={(e) => {
          e.preventDefault(); e.stopPropagation();
          const a = currentAction();
          if (a) a.run(); else sfx('click');
        }}
        onContextMenu={(e) => e.preventDefault()}>
        <span className="act-ico">{act ? act.icon : '💬'}</span>
        <small>{tx(T('말하기', 'Talk'))}</small>
      </button>
    </>
  );
}

/** Desktop: small floating prompt "E: Talk to Snow White" (no on-screen pads). */
function KeyPrompt() {
  const act = useCurrentAction();
  const tx = useTx();
  const hasLine = useGame((s) => s.lines.length > 0);
  if (!act?.label || hasLine) return null;
  return <div className="act-prompt desk"><kbd>E</kbd> {act.icon} {tx(act.label)}</div>;
}

/** On-screen joystick (bottom-left) + action button (bottom-right) for phones without a keyboard. */
export function TouchControls() {
  const touch = useTouchDevice();
  const scene = useGame((s) => s.scene);
  const hasLine = useGame((s) => s.lines.length > 0);
  const mini = useGame((s) => s.mini);
  const overlay = useGame((s) => s.guideOpen || s.bookOpen);
  const sleeping = useGame((s) => s.sleeping);
  useEffect(() => { document.body.classList.toggle('touch', touch); }, [touch]);
  const play = (scene === 'forest' || scene === 'cottage') && !hasLine && !mini && !overlay && !sleeping;
  const show = touch && play;
  useEffect(() => { if (!show) { stick.x = 0; stick.z = 0; stick.active = false; } }, [show]);
  if (!touch) return play ? <div className="touchpad"><KeyPrompt /></div> : null;
  if (!show) return null;
  return (
    <div className="touchpad">
      <Joystick />
      <ActionButtons />
    </div>
  );
}
