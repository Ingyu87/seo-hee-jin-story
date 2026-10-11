'use client';
import { useEffect, useRef } from 'react';
import { escort, useGame, HEROES, STORIES, STICKERS, HIDDEN, SPK, T, Tx, useTx, DWARFS } from './store';
import { Minigames } from './Minigames';
import { TouchControls, useTouchDevice, ZoomButtons } from './TouchControls';
import { useState } from 'react';
import { sfx } from './audio';
import { speak, stopSpeech } from './speech';

const BRAND = 'seo hee jin story';

const UI = {
  pickStory: T('어떤 동화 속으로 들어가 볼까?', 'Which fairy tale shall we jump into?'),
  pickHero: T('동화 속으로 들어갈 친구를 골라 줘!', 'Pick who goes into the story!'),
  enter: (n: Tx): Tx => T(`${n.ko === '서희' ? '서희로' : '서진이로'} 동화 속에 들어가기 ▶`, `Enter the story as ${n.en} ▶`),
  age: (a: number): Tx => T(`${a}살`, `${a} yrs`),
  soon: T('준비 중', 'Coming soon'),
  play: T('시작하기 ▶', 'Play ▶'),
  back: T('◀ 동화 고르기', '◀ Stories'),
  home: T('처음으로', 'Home'),
  guide: T('❓ 놀이 방법', '❓ How to play'),
  forest: T('🌲 숲속 길', '🌲 Forest path'),
  cottage: T('🏠 일곱 난쟁이의 오두막', "🏠 The dwarfs' cottage"),
  toCottage: T('🏠 오두막으로 바로 가기', '🏠 Go to the cottage'),
  standUp: T('일어나기', 'Stand up'),
  more: T('눌러서 계속 ▼', 'Tap to continue ▼'),
  sleeping: (_n: Tx): Tx => T('💤 백설공주가 잠들었어! 화면을 톡톡 눌러서 깨워 줘!', '💤 Snow White fell asleep! Tap the screen to wake her up!'),
  endTitle: T('🎉 해피엔딩!', '🎉 Happy ending!'),
  endSafe: (n: Tx): Tx => T(`${n.ko === '서희' ? '서희가' : '서진이가'} 백설공주에게 독 사과를 먹지 말라고 알려 줘서 모두가 안전했어요. 일곱 난쟁이와 백설공주는 신나는 파티를 열었답니다.`,
    `${n.en} warned Snow White not to eat the poison apple, so everyone stayed safe. The seven dwarfs and Snow White threw a wonderful party.`),
  endWoke: (n: Tx): Tx => T(`${n.ko === '서희' ? '서희와' : '서진이와'} 난쟁이들이 힘을 합쳐 잠든 백설공주를 깨웠어요. 모두 오래오래 행복하게 살았답니다.`,
    `${n.en} and the dwarfs worked together to wake Snow White. They all lived happily ever after.`),
  again: T('다시 하기', 'Play again'),
  change: T('캐릭터 바꾸기', 'Change character'),
  close: T('알겠어! 👍', 'Got it! 👍'),
  mute: T('소리 끄기', 'Mute'),
  unmute: T('소리 켜기', 'Unmute'),
};

/** Dialogue box: tap = next line, press & hold = fast-forward, ⏩ button / Shift = skip to the next question. */
function Dialog() {
  const s = useGame(); const tx = useTx(); const touch = useTouchDevice();
  const line = s.lines[s.lineIdx];
  const hold = useRef<{ t?: ReturnType<typeof setTimeout>; iv?: ReturnType<typeof setInterval>; fast: boolean }>({ fast: false });
  const stop = () => { clearTimeout(hold.current.t); clearInterval(hold.current.iv); };
  useEffect(() => stop, []);
  if (!line) return null;
  return (
    <div className="dialog"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        hold.current.fast = false; stop();
        hold.current.t = setTimeout(() => {
          hold.current.fast = true;
          hold.current.iv = setInterval(() => { const g = useGame.getState(); if (!g.lines.length || g.lines[g.lineIdx]?.choices) stop(); else g.next(); }, 220);
        }, 380);
      }}
      onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onClick={() => { if (hold.current.fast) { hold.current.fast = false; return; } if (!line.choices) s.next(); }}>
      <div className="speaker">{tx(line.speaker)}</div>
      {!line.choices && (
        <button className="skipbtn" aria-label={tx(T('건너뛰기', 'Skip'))}
          onClick={(e) => { e.stopPropagation(); sfx('click'); s.skip(); }}>⏩ {tx(T('건너뛰기', 'Skip'))}</button>
      )}
      <div className="text">{tx(line.text)}</div>
      {line.choices ? (
        <div className="choices">
          {line.choices.map((c) => (
            <button key={c.id} onClick={(e) => { e.stopPropagation(); s.choose(c.id); }}>{tx(c.label)}</button>
          ))}
        </div>
      ) : <div className="more">{touch ? tx(T('눌러서 계속 ▼ · 꾹 누르면 빨리 ⏩', 'Tap to continue ▼ · hold to fast-forward ⏩'))
        : tx(T('Enter 다음 ▼ · Enter 꾹 = 빨리 · Shift = 건너뛰기', 'Enter: next ▼ · hold Enter: fast · Shift: skip'))}</div>}
    </div>
  );
}

const GUIDE: { icon: string; title: Tx; body: Tx }[] = [
  { icon: '🧒', title: T('너는 백설공주의 친구!', "You are Snow White's friend!"), body: T('서희·서진이는 동화 속에 들어가 백설공주를 도와주는 친구예요. 백설공주를 만나고, 오두막까지 데려다주고, 나쁜 왕비의 독 사과로부터 지켜 줘요.', "Seohee and Seojin jump into the fairy tale as Snow White's helpers: meet her, walk her to the cottage and protect her from the wicked Queen's poison apple.") },
  { icon: '💬', title: T('대화하기', 'Talk'), body: T('백설공주, 난쟁이, 할머니를 누르면 다가가서 말을 걸어요. 말풍선을 누르면 다음 대사, 꾹 누르면 빨리 넘어가고 ⏩ 건너뛰기로 바로 질문까지 가요. 노란 버튼으로 대답을 골라요. (PC: Enter 다음 · Shift 건너뛰기)', 'Tap Snow White, a dwarf or the old woman to walk over and talk. Tap the speech box for the next line, hold it to fast-forward, or press ⏩ Skip to jump to the next question. Pick answers with the yellow buttons. (PC: Enter next · Shift skip)') },
  { icon: '🚪', title: T('문 열기', 'Open the door'), body: T('오두막 문을 누르면 끼이익~ 열려요. 한 번 더 누르면 닫혀요.', 'Tap the cottage door and it creaks open. Tap again to close it.') },
  { icon: '🪑', title: T('의자에 앉기', 'Sit on a chair'), body: T('의자를 누르면 걸어가서 앉아요. 땅을 누르거나 “일어나기”를 누르면 일어나요.', 'Tap a chair to walk over and sit. Tap the floor or "Stand up" to get up.') },
  { icon: '🍎', title: T('백설공주 지키기', 'Protect Snow White'), body: T('너는 백설공주를 돕는 친구예요! 난쟁이들이 일하러 가면 수상한 할머니가 찾아와 사과를 줘요. “먹지 마!”라고 알려 주거나 식탁 위 사과를 치우면 파티 엔딩, 지켜보기만 하면 백설공주가 잠들어서 화면을 5번 톡톡 눌러 깨워야 해요.', "You are Snow White's helper! When the dwarfs leave for work, a strange old woman brings an apple. Warn Snow White or take the apple away for the party ending; if you just watch, she falls asleep and you tap 5 times to wake her.") },
];
GUIDE.push(
  { icon: '🎮', title: T('미니게임', 'Mini-games'), body: T('백설공주에게 꽃 따 주기(15초), 투덜이와 가위바위보, 박사와 사과 피하기! 하고 싶을 때 골라서 놀아요.', 'Pick flowers for Snow White (15 s), rock-paper-scissors with Grumpy, and apple dodge with Doc! Play them whenever you like.') },
  { icon: '🔍', title: T('숨바꼭질', 'Hide-and-seek'), body: T('오두막에서 박사가 “숲에서 숨바꼭질하던 친구 3명이 안 돌아왔어!” 하고 도움을 청하면 “도와줄게!”를 골라요. 숲 나무 옆에 숨은 난쟁이에게 가까이 가서 🔍 버튼을 눌러요!', 'In the cottage Doc asks for help: three friends playing hide-and-seek in the forest haven\'t come back. Choose "I\'ll help!", then get close to the dwarfs hiding by the trees and press 🔍!') },
);
const CONTENTS: Tx[] = [
  T('숲속 길에서 백설공주 만나기', 'Meet Snow White on the forest path'),
  T('함께 일곱 난쟁이의 오두막으로 가기', "Walk together to the dwarfs' cottage"),
  T('문 열고 들어가 난쟁이들과 인사하기', 'Open the door and say hi to the dwarfs'),
  T('의자에 앉아 쉬고 난쟁이들 이야기 듣기', 'Sit down and hear the dwarfs\' stories'),
  T('난쟁이들이 광산으로 출발! 백설공주 지켜 주기', 'The dwarfs leave for the mine — guard Snow White'),
  T('변장한 왕비의 독 사과: 백설공주를 도와줘!', "The disguised Queen's poison apple: help Snow White!"),
  T('해피엔딩 (2가지)', 'Happy ending (2 kinds)'),
];

function Toolbar() {
  const lang = useGame((s) => s.lang); const muted = useGame((s) => s.muted); const voice = useGame((s) => s.voice);
  const g = useGame.getState(); const tx = useTx();
  return (
    <div className="toolbar">
      <div className="langs" role="group" aria-label="language">
        <button className={lang === 'ko' ? 'on' : ''} onClick={() => { sfx('click'); g.setLang('ko'); }}><span className="long">한국어</span><span className="short">한</span></button>
        <button className={lang === 'en' ? 'on' : ''} onClick={() => { sfx('click'); g.setLang('en'); }}><span className="long">English</span><span className="short">EN</span></button>
      </div>
      <button className="iconbtn" aria-label={tx(muted ? UI.unmute : UI.mute)} title={tx(muted ? UI.unmute : UI.mute)}
        onClick={() => { if (!muted) stopSpeech(); g.toggleMute(); sfx('click'); }}>{muted ? '🔇' : '🔊'}</button>
      <button className={`iconbtn ${voice ? '' : 'off'}`} aria-label={tx(voice ? T('읽어주기 끄기', 'Turn narration off') : T('읽어주기 켜기', 'Turn narration on'))}
        title={tx(voice ? T('읽어주기 끄기', 'Turn narration off') : T('읽어주기 켜기', 'Turn narration on'))}
        onClick={() => { g.toggleVoice(); sfx('click'); if (voice) stopSpeech(); }}>{voice ? '🗣️' : '🤐'}</button>
      <button className="iconbtn" aria-label={tx(UI.guide)} title={tx(UI.guide)} onClick={() => { sfx('click'); g.setGuide(true); }}>❓</button>
    </div>
  );
}

/** Picture help: real screenshots of each control with kid-friendly KO/EN explanations. */
const HELP_PHONE: { img: string; w: number; title: Tx; body: Tx }[] = [
  { img: '/help/joystick.webp', w: 76, title: T('조이스틱 = 걷기', 'Joystick = walk'), body: T('왼쪽 아래 분홍 공을 손가락으로 꾹 누르고 끌어 봐요. 위·아래·왼쪽·오른쪽, 끄는 쪽으로 걸어가요. 손을 떼면 멈춰요.', 'Press the pink ball (bottom-left) and drag it. You walk the way you drag: up, down, left or right. Let go to stop.') },
  { img: '/help/jump.webp', w: 60, title: T('파란 버튼 = 점프', 'Blue button = jump'), body: T('누르면 깡충! 걸으면서 같이 눌러도 돼요.', 'Press it to hop! You can press it while walking, too.') },
  { img: '/help/talk.webp', w: 64, title: T('노란 버튼 = 말하기 / 하기', 'Yellow button = talk / do'), body: T('친구나 물건 가까이 가면 버튼이 노랗게 반짝이고 위에 할 일이 나와요. 누르면 말 걸기, 문 열기, 의자 앉기, 사과 치우기, 숨은 난쟁이 찾기!', 'Walk close to a friend or a thing: the button glows yellow and shows what you can do. Press it to talk, open the door, sit, take the apple or find a hidden dwarf!') },
  { img: '/help/dialog.webp', w: 220, title: T('이야기 상자', 'Story box'), body: T('이야기 상자를 톡 누르면 다음 이야기가 나와요. 노란 대답 버튼이 나오면 하나를 골라요. 이야기는 소리 내어 읽어 줘요!', 'Tap the story box for the next line. When yellow answer buttons appear, pick one. The story is read aloud to you!') },
  { img: '/help/toolbar.webp', w: 220, title: T('위쪽 버튼들', 'Top buttons'), body: T('한/EN: 한국어·영어 바꾸기 · 🔊 음악과 소리 · 🗣️ 이야기 읽어 주기 켜기/끄기 · ❓ 이 도움말', 'KO/EN: switch language · 🔊 music & sound · 🗣️ read-aloud on/off · ❓ this help') },
];
const HELP_PC: { keys: string[]; title: Tx; body: Tx; img?: string }[] = [
  { keys: ['↑', '↓', '←', '→'], title: T('걷기', 'Walk'), body: T('방향키나 W A S D 로 걸어요. 마우스로 땅을 눌러도 돼요.', 'Arrow keys or W A S D. You can also click the ground.') },
  { keys: ['Space'], title: T('점프', 'Jump'), body: T('스페이스 바를 누르면 깡충!', 'Press the space bar to hop!') },
  { keys: ['E'], title: T('말하기 / 하기', 'Talk / do'), body: T('가까이 가면 화면 아래에 “E …”가 나와요. E 를 누르면 말 걸기, 문 열기, 의자 앉기!', 'Get close and an "E …" hint appears at the bottom. Press E to talk, open the door or sit!'), img: '/help/desk-prompt.webp' },
  { keys: ['Enter'], title: T('다음 이야기', 'Next line'), body: T('엔터를 누르면 다음 대사로 넘어가요. (가까이 있으면 E 처럼 행동도 해요)', 'Press Enter for the next line. (Near something, it works like E too.)') },
  { keys: ['1', '2', '3'], title: T('대답 고르기', 'Pick an answer'), body: T('노란 대답 버튼이 나오면 숫자로 골라요. 마우스로 눌러도 돼요.', 'When answer buttons appear, press a number — or just click.') },
];

function Guide() {
  const open = useGame((s) => s.guideOpen); const tx = useTx();
  const touch = useTouchDevice();
  const [tab, setTab] = useState<'phone' | 'pc' | null>(null);
  if (!open) return null;
  const t = tab ?? (touch ? 'phone' : 'pc');
  return (
    <div className="guide-wrap" onClick={() => useGame.getState().setGuide(false)}>
      <div className="guide" onClick={(e) => e.stopPropagation()}>
        <h2>{tx(UI.guide)}</h2>
        <div className="help-tabs" role="tablist">
          <button role="tab" className={t === 'phone' ? 'on' : ''} onClick={() => { sfx('click'); setTab('phone'); }}>📱 {tx(T('폰·태블릿', 'Phone / tablet'))}</button>
          <button role="tab" className={t === 'pc' ? 'on' : ''} onClick={() => { sfx('click'); setTab('pc'); }}>💻 {tx(T('컴퓨터', 'Computer'))}</button>
        </div>
        {t === 'phone' ? (
          <ul className="help-list">
            {HELP_PHONE.map((h) => (
              <li key={h.img}><img src={h.img} alt="" style={{ width: h.w }} /><div><b>{tx(h.title)}</b><p>{tx(h.body)}</p></div></li>
            ))}
          </ul>
        ) : (
          <ul className="help-list">
            {HELP_PC.map((h) => (
              <li key={h.keys.join()}><span className="keys">{h.keys.map((k) => <kbd key={k}>{k}</kbd>)}</span>
                <div><b>{tx(h.title)}</b><p>{tx(h.body)}</p>{h.img && <img src={h.img} alt="" className="help-shot" />}</div></li>
            ))}
          </ul>
        )}
        <h3>{tx(T('🧚 어떻게 놀까?', '🧚 How to play'))}</h3>
        <ul className="howto">
          {GUIDE.map((g) => (<li key={g.icon}><span className="ico">{g.icon}</span><div><b>{tx(g.title)}</b><p>{tx(g.body)}</p></div></li>))}
        </ul>
        <h3>{tx(T('📖 이야기 순서', '📖 Story contents'))}</h3>
        <ol className="contents">{CONTENTS.map((c, i) => <li key={i}>{tx(c)}</li>)}</ol>
        <button className="start" onClick={() => { sfx('click'); useGame.getState().setGuide(false); }}>{tx(UI.close)}</button>
      </div>
    </div>
  );
}

function Book() {
  const open = useGame((s) => s.bookOpen); const book = useGame((s) => s.book); const tx = useTx();
  if (!open) return null;
  return (
    <div className="guide-wrap" onClick={() => useGame.getState().setBook(false)}>
      <div className="guide" onClick={(e) => e.stopPropagation()}>
        <h2>📖 {tx(T('스티커 북', 'Sticker book'))} <small>{book.filter((b) => STICKERS.some((x) => x.id === b)).length}/{STICKERS.length}</small></h2>
        <div className="stickers">
          {STICKERS.map((st) => {
            const got = book.includes(st.id);
            return (
              <div key={st.id} className={`sticker ${got ? 'got' : ''}`}>
                <span className="ico">{got ? st.icon : '❔'}</span>
                <b>{got ? tx(st.name) : '???'}</b>
                <small>{tx(st.how)}</small>
              </div>
            );
          })}
        </div>
        <button className="start" onClick={() => { sfx('click'); useGame.getState().setBook(false); }}>{tx(UI.close)}</button>
      </div>
    </div>
  );
}

const STAR_ROWS: { id: string; label: Tx }[] = [
  { id: 'ending', label: T('엔딩 도착', 'Reached an ending') },
  { id: 'flowers', label: T('꽃 따기', 'Flower picking') },
  { id: 'hide', label: T('숨바꼭질', 'Hide-and-seek') },
  { id: 'rps', label: T('가위바위보', 'Rock-paper-scissors') },
  { id: 'dodge', label: T('사과 피하기', 'Apple dodge') },
];

/**
 * Story goal (what to do next, in story order): forest meet → overhear the Queen → walk to the cottage →
 * greet the dwarfs → help Doc (hide-and-seek) → dwarfs leave → protect Snow White from the apple → ending.
 */
type GoalState = ReturnType<typeof useGame.getState>;
function storyGoal(s: GoalState): { step: number; text: Tx } | null {
  if (s.scene === 'forest') {
    if (s.seek === 'on') return { step: 5, text: T(`🔍 숨은 난쟁이 찾기 (${s.found.length}/3) — 덤불 뒤를 살펴봐!`, `🔍 Find the hidden dwarfs (${s.found.length}/3) — look behind the bushes!`) };
    if (s.seek === 'done') return { step: 6, text: T('🏠 난쟁이들과 오두막으로 돌아가기', '🏠 Go back to the cottage with the dwarfs') };
    if (!s.metSnowWhite) return { step: 1, text: T('💬 숲속 백설공주에게 말 걸기', '💬 Talk to Snow White in the forest') };
    if (!s.swFollow) return { step: 2, text: T('🤝 백설공주를 도와 같이 가기', '🤝 Help Snow White — walk with her') };
    if (!s.talked['qGone']) return { step: 3, text: T('👂 가시를 피해 숲길을 가며 왕비의 비밀 엿듣기', '👂 Lead Snow White around the thorns — and overhear the Queen') };
    return { step: 4, text: T('🌿 가시덤불을 피해 백설공주를 오두막까지 안내하기', '🌿 Guide Snow White around the thorns to the cottage') };
  }
  if (s.scene !== 'cottage') return null;
  if (s.sleeping) return { step: 10, text: T(`👆 화면을 톡톡! 백설공주 깨우기 (${s.taps}/5)`, `👆 Tap tap! Wake Snow White (${s.taps}/5)`) };
  if (s.apple === 'table' || s.apple === 'held') return { step: 9, text: T('🍎 수상한 사과! 백설공주를 지켜 줘', '🍎 A suspicious apple! Protect Snow White') };
  if (s.dwarfs === 'leaving' || s.dwarfs === 'away') return { step: 8, text: T('🛡️ 난쟁이들이 없는 동안 백설공주 지키기', '🛡️ Look after Snow White while the dwarfs are away') };
  if (!s.talked['welcome']) return { step: 4, text: s.doorOpen ? T('💬 난쟁이에게 인사하기', '💬 Say hello to a dwarf') : T('🚪 오두막 문 열기', '🚪 Open the cottage door') };
  if (s.seek === 'off') return { step: 5, text: T('🙋 박사의 부탁 들어주기 (박사에게 말 걸기)', '🙋 Help Doc (talk to Doc)') };
  const chats = DWARFS.filter((d) => s.talked[d.node]).length;
  return { step: 7, text: T(`🪑 의자에 앉고 난쟁이들과 이야기하기 (${chats}/7)`, `🪑 Sit down and chat with the dwarfs (${chats}/7)`) };
}

function StoryGoal() {
  const s = useGame(); const tx = useTx();
  const goal = storyGoal(s);
  const last = useRef(0);
  const [cheer, setCheer] = useState(0);
  useEffect(() => {
    if (!goal) { last.current = 0; return; }
    if (last.current && goal.step > last.current) { setCheer((c) => c + 1); sfx('sparkle'); }
    last.current = goal.step;
  }, [goal?.step]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!goal || s.mini) return null;
  return (
    <>
      <div className="goal" key={goal.step}><b>{tx(T('할 일', 'Goal'))}</b> {tx(goal.text)}</div>
      {cheer > 0 && <Cheer key={cheer} />}
    </>
  );
}

/** Run-escort overlay (approved mockup): yellow banner, ←→ tip pill, speed lines at the screen edges. */
function RunHud() {
  const tx = useTx();
  const [skip, setSkip] = useState(escort.skip);
  return (
    <>
      <div className="speedlines" aria-hidden />
      <div className="runbanner"><span className="rb-apple">🍎</span><b>{tx(T('백설공주를 오두막까지!', 'Snow White to the cottage!'))}</b><span className="rb-sign">🪧</span></div>
      <div className="runtip"><span>💗</span> <b>← →</b> {tx(T('피하기', 'Dodge'))}</div>
      {!skip && <button className="runskip" onClick={() => { sfx('click'); escort.skip = true; setSkip(true); }}>{tx(T('⏩ 건너뛰기', '⏩ Skip'))}</button>}
    </>
  );
}

/** Short "well done!" burst whenever a story step is completed. */
function Cheer() {
  const tx = useTx();
  const [on, setOn] = useState(true);
  useEffect(() => { const t = setTimeout(() => setOn(false), 1600); return () => clearTimeout(t); }, []);
  const bits = useRef(Array.from({ length: 16 }, (_, i) => ({ e: ['🌸', '✨', '🍎', '🌼', '💖'][i % 5], x: (Math.random() - 0.5) * 260, y: -80 - Math.random() * 160, r: (Math.random() - 0.5) * 540, d: Math.random() * 0.15 })));
  if (!on) return null;
  return (
    <div className="cheer" aria-hidden>
      <div className="cheer-word">{tx(T('잘했어! 🎉', 'Well done! 🎉'))}</div>
      {bits.current.map((b, i) => <span key={i} className="cheer-bit" style={{ '--x': `${b.x}px`, '--y': `${b.y}px`, '--r': `${b.r}deg`, animationDelay: `${b.d}s` } as React.CSSProperties}>{b.e}</span>)}
    </div>
  );
}

export function Hud() {
  const s = useGame();
  const tx = useTx();
  const h = HEROES[s.hero];
  const line = s.lines[s.lineIdx];

  // little "blip" whenever a new dialogue line appears
  useEffect(() => { if (line) sfx('talk'); }, [line]);
  // read each story line aloud in the chosen language (Web Speech API)
  useEffect(() => {
    if (!line) { stopSpeech(); return; }
    if (!s.voice || s.muted) return;
    const sp = line.speaker.ko;
    const dwarf = DWARFS.find((d) => d.name.ko === sp)?.node;
    const kind = sp === SPK.story.ko ? 'narrator' : sp === SPK.snow.ko ? 'snow' : sp === SPK.queen.ko ? 'queen' : sp === SPK.oldWoman.ko ? 'oldwoman'
      : sp === '마법 거울' ? 'mirror' : sp === HEROES.seohui.name.ko ? 'seohui' : sp === HEROES.seojin.name.ko ? 'seojin' : sp === '나' ? s.hero : dwarf ?? 'narrator';
    speak(line.text[s.lang], s.lang, kind);
  }, [line, s.lang, s.voice, s.muted]);
  useEffect(() => { if (s.ending && s.scene === 'ending' && s.voice && !s.muted) speak(tx(s.ending === 'safe' ? UI.endSafe(h.name) : UI.endWoke(h.name)), s.lang, 'narrator'); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.scene, s.ending]);
  useEffect(() => { document.documentElement.lang = s.lang; document.title = BRAND; }, [s.lang]);

  let body: React.ReactNode;
  if (s.scene === 'stories') {
    body = (
      <>
        <div className="title">
          <div className="brand big">{BRAND}</div>
          <p>{tx(UI.pickStory)}</p>
        </div>
        <div className="story-list">
          {STORIES.map((st) => (
            <button key={st.id} className={`story ${st.ready ? '' : 'soon'}`} disabled={!st.ready}
              onClick={() => { sfx('click'); s.pickStory(st.id); }}>
              <span className="emoji">{st.emoji}</span>
              <span className="txt"><b>{tx(st.title)}</b><small>{tx(st.blurb)}</small></span>
              <span className="tag">{st.ready ? tx(UI.play) : tx(UI.soon)}</span>
            </button>
          ))}
        </div>
      </>
    );
  } else if (s.scene === 'select') {
    body = (
      <>
        <div className="title">
          <div className="brand">{BRAND}</div>
          <h1>{tx(STORIES[0].title)}</h1>
          <p>{tx(UI.pickHero)}</p>
        </div>
        <button className="ghost back" onClick={() => { sfx('click'); s.home(); }}>{tx(UI.back)}</button>
        <div className="select-bar">
          {(['seohui', 'seojin'] as const).map((id) => (
            <button key={id} className={`card ${s.hero === id ? 'on' : ''}`} onClick={() => s.setHero(id)}
              style={{ borderColor: s.hero === id ? HEROES[id].color : undefined }}>
              <b>{tx(HEROES[id].name)}</b><span>{tx(UI.age(HEROES[id].age))}</span>
            </button>
          ))}
          <button className="start" onClick={() => { sfx('click'); s.start(); }}>{tx(UI.enter(h.name))}</button>
        </div>
      </>
    );
  } else if (s.scene === 'ending') {
    body = (
      <div className="ending">
        <div className="brand small">{BRAND}</div>
        <h2>{tx(UI.endTitle)}</h2>
        <p>{tx(s.ending === 'safe' ? UI.endSafe(h.name) : UI.endWoke(h.name))}</p>
        <div className="row">
          <button onClick={() => { sfx('click'); s.start(); }}>{tx(UI.again)}</button>
          <button onClick={() => { sfx('click'); s.reset(); }}>{tx(UI.change)}</button>
        </div>
      </div>
    );
  } else {
    body = (
      <>
        <div className="topbar">
          <span className="who" style={{ background: h.color }}>{tx(h.name)} · {tx(UI.age(h.age))}</span>
          <span className="place">{tx(s.scene === 'forest' ? UI.forest : UI.cottage)}</span>
          {s.scene === 'forest' && s.seek === 'on' && <span className="seek">🔍 {s.found.length}/{HIDDEN.length}</span>}
          <button className="ghost" onClick={() => { sfx('click'); s.home(); }}>{tx(UI.home)}</button>
        </div>
        {s.running && !line && !s.mini ? <RunHud /> : <StoryGoal />}
        {!s.mini && !s.sleeping && <ZoomButtons />}
        {s.hint && !line && !s.mini && !s.running && <div className="hint" key={s.hint.ko}>{tx(s.hint)}</div>}
        {s.toast && <div className="toast">{tx(s.toast)}</div>}
        {s.scene === 'forest' && !s.running && ((s.swFollow && !!s.talked['qGone']) || s.seek !== 'off') && !line && ( /* never skips the Queen's poison-apple scene */
          <button className="shortcut" onClick={() => { sfx('click'); s.goto('cottage'); }}>{tx(UI.toCottage)}</button>
        )}
        {s.scene === 'cottage' && s.sitting && !line && (
          <button className="shortcut" onClick={() => { sfx('click'); s.standUp(); }}>{tx(UI.standUp)}</button>
        )}
        {s.sleeping && !line && (
          <div className="tapzone" onClick={() => s.tap()}>
            <div className="tapmsg">{tx(UI.sleeping(h.name))} <b>{s.taps}/5</b></div>
          </div>
        )}
        {line && <Dialog key={s.lines.length ? 'd' : ''} />}
      </>
    );
  }

  return (
    <div className={`hud scene-${s.scene}`}>
      {body}
      <TouchControls />
      <Minigames />
      <Toolbar />
      <Guide />
      <Book />
    </div>
  );
}
