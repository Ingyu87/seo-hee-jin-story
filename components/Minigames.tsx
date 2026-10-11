'use client';
import { useEffect, useRef, useState } from 'react';
import { useGame, T, Tx, useTx, HEROES } from './store';
import { sfx } from './audio';

const startTx = T('시작!', 'Start!');
const doneTx = T('끝! 결과 보기', 'Done! See result');

function Shell({ title, sub, children, footer }: { title: Tx; sub: Tx; children: React.ReactNode; footer?: React.ReactNode }) {
  const tx = useTx();
  return (
    <div className="mini-wrap">
      <div className="mini">
        <div className="mini-head"><b>{tx(title)}</b><span>{tx(sub)}</span></div>
        {children}
        {footer}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 1) flower picking (timed)
const FLOWER_EMOJI = ['🌸', '🌼', '🌷', '🌺'];
function Flowers() {
  const tx = useTx();
  const [left, setLeft] = useState(15);
  const [score, setScore] = useState(0);
  const [items, setItems] = useState<{ id: number; x: number; y: number; e: string }[]>([]);
  const [over, setOver] = useState(false);
  const [started, setStarted] = useState(false); // the clock only runs after the child presses Start
  const idRef = useRef(0);
  const spawn = () => ({ id: ++idRef.current, x: 8 + Math.random() * 84, y: 10 + Math.random() * 78, e: Math.random() < 0.12 ? '🌟' : FLOWER_EMOJI[(Math.random() * 4) | 0] }); // 🌟 = golden flower, worth 2
  useEffect(() => { setItems([spawn(), spawn(), spawn()]); }, []);
  useEffect(() => {
    if (over || !started) return;
    const t = setInterval(() => setLeft((l) => { if (l <= 1) { setOver(true); return 0; } return l - 1; }), 1000);
    return () => clearInterval(t);
  }, [over, started]);
  const [pops, setPops] = useState<{ id: number; x: number; y: number; t: string }[]>([]);
  const pick = (id: number) => {
    if (over || !started) return;
    const f = items.find((i) => i.id === id); if (!f) return;
    const gold = f.e === '🌟';
    sfx(gold ? 'sparkle' : 'tap');
    setScore((s) => s + (gold ? 2 : 1));
    setPops((p) => [...p.slice(-6), { id: f.id, x: f.x, y: f.y, t: gold ? '+2 ✨' : '+1' }]);
    setItems((it) => it.filter((i) => i.id !== id).concat(spawn()));
  };
  useEffect(() => { if (over) sfx(score >= 10 ? 'fanfare' : 'wake'); }, [over]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Shell title={T('🌸 꽃 따기', '🌸 Flower picking')} sub={T(`15초 안에 꽃 10송이를 따 보자!`, 'Pick 10 flowers in 15 seconds!')}
      footer={over ? <button className="start" onClick={() => useGame.getState().endMini('flowers', score >= 10, score)}>{tx(doneTx)}</button>
        : !started ? <button className="start" onClick={() => { sfx('click'); setStarted(true); }}>{tx(startTx)}</button> : null}>
      <div className="mini-stats"><span className={started && !over && left <= 5 ? 'hurry' : ''}>⏱ {left}</span><span>🌸 {score}/10</span></div>
      <div className="field meadow">
        {pops.map((p) => <span key={p.id} className="pop-score" style={{ left: `${p.x}%`, top: `${p.y}%` }}>{p.t}</span>)}
        {started && !over && items.map((f) => (
          <button key={f.id} className="flower" style={{ left: `${f.x}%`, top: `${f.y}%` }} onPointerDown={() => pick(f.id)}>{f.e}</button>
        ))}
        {over && <div className="mini-result">{score >= 10 ? '💐' : '🌸'} {score}<small>{tx(score >= 10 ? T('예쁜 꽃다발 완성!', 'A lovely bouquet!') : T('예쁘다! 백설공주가 좋아할 거야', 'Pretty! Snow White will love them'))}</small></div>}
        {!started && <div className="mini-tip">{tx(T('🌸 꽃을 손가락으로 톡! 반짝 🌟 꽃은 2송이! 준비되면 “시작!”', '🌸 Tap the flowers! A shiny 🌟 counts as 2! Press "Start!" when ready'))}</div>}
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------- 2) rock-paper-scissors with Grumpy
const HANDS = ['✊', '✌️', '✋'] as const;
const HAND_TX = [T('바위', 'Rock'), T('가위', 'Scissors'), T('보', 'Paper')];
function Rps() {
  const tx = useTx();
  const [me, setMe] = useState(0); const [him, setHim] = useState(0);
  const [last, setLast] = useState<{ a: number; b: number; r: Tx } | null>(null);
  const done = me >= 2 || him >= 2;
  const play = (a: number) => {
    if (done) return;
    const b = (Math.random() * 3) | 0;
    // 0 rock beats 1 scissors, 1 scissors beats 2 paper, 2 paper beats 0 rock
    const win = (a === 0 && b === 1) || (a === 1 && b === 2) || (a === 2 && b === 0);
    const r = a === b ? T('비겼다! 한 번 더!', 'Draw! Again!') : win ? T('이겼다! 🎉', 'You win! 🎉') : T('졌다… 😝', 'You lose… 😝');
    sfx(a === b ? 'click' : win ? 'sparkle' : 'doorClose');
    if (a !== b) { if (win) setMe((m) => m + 1); else setHim((h) => h + 1); }
    setLast({ a, b, r });
  };
  return (
    <Shell title={T('✌️ 투덜이와 가위바위보', '✌️ Rock-paper-scissors with Grumpy')} sub={T('먼저 2번 이기면 승리!', 'First to 2 wins!')}
      footer={done && <button className="start" onClick={() => useGame.getState().endMini('rps', me >= 2, me)}>{tx(doneTx)}</button>}>
      <div className="mini-stats"><span>{tx(HEROES[useGame.getState().hero].name)} {me}</span><span>{tx(T('투덜이', 'Grumpy'))} {him}</span></div>
      <div className="rps-board">
        <div className="rps-vs">
          <span className="big">{last ? HANDS[last.a] : '❔'}</span><span>VS</span><span className="big">{last ? HANDS[last.b] : '❔'}</span>
        </div>
        <div className="rps-msg">{last ? tx(last.r) : tx(T('무엇을 낼까?', 'What will you play?'))}</div>
        <div className="rps-btns">
          {HANDS.map((h, i) => <button key={i} disabled={done} onClick={() => play(i)}><span>{h}</span><small>{tx(HAND_TX[i])}</small></button>)}
        </div>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------- 3) apple dodge
function Dodge() {
  const tx = useTx();
  const field = useRef<HTMLDivElement>(null);
  const st = useRef({ x: 50, apples: [] as { id: number; x: number; y: number; v: number }[], hits: 0, t: 0, id: 0, last: 0, over: false, keys: { l: false, r: false } });
  const [, force] = useState(0);
  const [started, setStarted] = useState(false);
  const DURATION = 20;
  useEffect(() => {
    if (!started) return;
    const s = st.current; let raf = 0; s.last = performance.now();
    const kd = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft' || e.key === 'a') s.keys.l = true; if (e.key === 'ArrowRight' || e.key === 'd') s.keys.r = true; };
    const ku = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft' || e.key === 'a') s.keys.l = false; if (e.key === 'ArrowRight' || e.key === 'd') s.keys.r = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - s.last) / 1000); s.last = now;
      if (!s.over) {
        s.t += dt;
        if (s.keys.l) s.x = Math.max(6, s.x - 70 * dt);
        if (s.keys.r) s.x = Math.min(94, s.x + 70 * dt);
        const rate = 1.2 + s.t * 0.12; // apples per second, slowly ramps up
        if (Math.random() < rate * dt) s.apples.push({ id: ++s.id, x: 5 + Math.random() * 90, y: -8, v: 32 + Math.random() * 18 + s.t * 1.5 });
        s.apples.forEach((a) => (a.y += a.v * dt));
        s.apples = s.apples.filter((a) => {
          if (a.y > 80 && a.y < 92 && Math.abs(a.x - s.x) < 8) { s.hits++; sfx('crunch'); return false; }
          return a.y < 105;
        });
        if (s.t >= DURATION) { s.over = true; sfx('fanfare'); }
      }
      force((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [started]);
  const s = st.current;
  const move = (e: React.PointerEvent) => {
    const r = field.current?.getBoundingClientRect(); if (!r) return;
    s.x = Math.min(94, Math.max(6, ((e.clientX - r.left) / r.width) * 100));
  };
  const hero = HEROES[useGame.getState().hero];
  return (
    <Shell title={T('🍎 사과 피하기', '🍎 Apple dodge')} sub={T('20초 동안 사과를 피해! (2번까지 맞아도 성공)', 'Dodge for 20 seconds! (up to 2 hits is OK)')}
      footer={s.over ? <button className="start" onClick={() => useGame.getState().endMini('dodge', s.hits <= 2, s.hits)}>{tx(doneTx)}</button>
        : !started ? <button className="start" onClick={() => { sfx('click'); setStarted(true); }}>{tx(startTx)}</button> : null}>
      <div className="mini-stats"><span>⏱ {Math.max(0, Math.ceil(DURATION - s.t))}</span><span>💥 {s.hits}</span></div>
      <div className="field shelf" ref={field} onPointerMove={move} onPointerDown={move}>
        {s.apples.map((a) => <span key={a.id} className="apple" style={{ left: `${a.x}%`, top: `${a.y}%` }}>🍎</span>)}
        <span className="dodger" style={{ left: `${s.x}%`, background: hero.color }}>{tx(hero.name)}</span>
        {!started && <div className="mini-tip">{tx(T('손가락으로 좌우로 움직여요 (키보드 ← →)', 'Drag left/right to move (or ← → keys)'))}</div>}
      </div>
    </Shell>
  );
}

export function Minigames() {
  const mini = useGame((s) => s.mini);
  if (mini === 'flowers') return <Flowers />;
  if (mini === 'rps') return <Rps />;
  if (mini === 'dodge') return <Dodge />;
  return null;
}
