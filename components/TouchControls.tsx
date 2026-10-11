'use client';
import { useEffect, useRef, useState } from 'react';
import { useGame, T, Tx, useTx, jump } from './store';
import { stick, currentAction } from './touch';
import { sfx } from './audio';
import { zoomBy } from './common';

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


function Joystick({ run = false }: { run?: boolean }) {
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
    <div className={`joy ${run ? 'joy-run' : ''}`} ref={base} aria-label="joystick"
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

/** Short, kid-obvious verb for the big action button (what pressing it will do right now). */
const VERB: Record<string, Tx> = {
  '💬': T('말 걸기', 'Talk'), '🔍': T('찾았다!', 'Found!'), '🚪': T('문 열기', 'Door'), '🪑': T('앉기', 'Sit'), '🍎': T('사과 집기', 'Take'),
  '🪞': T('엿듣기', 'Listen'), '🏠': T('들어가기', 'Go in'), '🧍': T('일어나기', 'Stand'), '👆': T('깨우기', 'Wake'), '▶': T('다음', 'Next'),
};

/** Always-visible zoom (pinch / mouse wheel / + - keys also work). Hold to keep zooming. */
export function ZoomButtons() {
  const tx = useTx();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const start = (f: number) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation(); sfx('click'); zoomBy(f);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => zoomBy(f), 90);
  };
  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  useEffect(() => stop, []);
  return (
    <div className="zoombtns">
      <button aria-label={tx(T('확대', 'Zoom in'))} onPointerDown={start(0.9)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}>＋</button>
      <button aria-label={tx(T('축소', 'Zoom out'))} onPointerDown={start(1 / 0.9)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}>－</button>
    </div>
  );
}

function ActionButtons() {
  const act = useCurrentAction();
  const tx = useTx();
  // first-time tip so kids know what the big button is for
  const [tip, setTip] = useState(false);
  useEffect(() => {
    if (localStorage.getItem('shj-tip-act')) return;
    setTip(true);
    const t = setTimeout(() => setTip(false), 15000);
    return () => clearTimeout(t);
  }, []);
  const doneTip = () => { setTip(false); try { localStorage.setItem('shj-tip-act', '1'); } catch {} };
  return (
    <>
      {act?.label && !tip && <div className="act-prompt">{act.icon} {tx(act.label)}</div>}
      {tip && (
        <div className="act-tip" onPointerDown={(e) => { e.stopPropagation(); doneTip(); }}>
          {tx(T('친구 가까이 가면 이 버튼이 노랗게 반짝여요! ✨ 그때 누르면 말을 걸거나 문을 열 수 있어요 👇',
            'When you get close to a friend this button glows yellow! ✨ Press it to talk, open doors and more 👇'))}
        </div>
      )}
      <button className="jumpbtn" aria-label={tx(T('점프', 'Jump'))}
        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); jump(); }}
        onContextMenu={(e) => e.preventDefault()}>
        <span className="act-ico">⤴️</span><small>{tx(T('점프', 'Jump'))}</small>
      </button>
      <button className={`actbtn ${act ? 'ready' : ''}`} aria-label={tx(T('말하기 / 행동', 'Talk / Action'))}
        onPointerDown={(e) => {
          e.preventDefault(); e.stopPropagation();
          const a = currentAction();
          if (a) { a.run(); doneTip(); } else sfx('click');
        }}
        onContextMenu={(e) => e.preventDefault()}>
        <span className="act-ico">{act ? act.icon : '💬'}</span>
        <small>{act ? tx(VERB[act.icon] ?? T('하기', 'Do it')) : tx(T('말하기', 'Talk'))}</small>
        {!act && <em>{tx(T('가까이 가면 켜져요', 'Get closer'))}</em>}
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
  const running = useGame((s) => s.running);
  useEffect(() => { document.body.classList.toggle('touch', touch); }, [touch]);
  const play = (scene === 'forest' || scene === 'cottage') && !hasLine && !mini && !overlay && !sleeping;
  const show = touch && play;
  const inWorld = scene === 'forest' || scene === 'cottage';
  useEffect(() => { if (!show) { stick.x = 0; stick.z = 0; stick.active = false; } }, [show]);
  // Zoom always available in world (including during dialogue). Pads only when free to move.
  if (!touch) {
    if (!inWorld || mini || overlay) return null;
    return <div className="touchpad">{!running && <KeyPrompt />}<ZoomButtons /></div>;
  }
  if (running) return <div className="touchpad run"><ZoomButtons /><Joystick run /></div>;
  if (!show) return inWorld && !mini && !overlay ? <div className="touchpad"><ZoomButtons /></div> : null;
  return (
    <div className="touchpad">
      <Joystick />
      <ActionButtons />
    </div>
  );
}
