'use client';
import { useEffect } from 'react';
import { useGame, HEROES, STORIES, STICKERS, HIDDEN, T, Tx, useTx } from './store';
import { Minigames } from './Minigames';
import { sfx } from './audio';

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
  sleeping: (n: Tx): Tx => T(`💤 ${n.ko === '서희' ? '서희가' : '서진이가'} 잠들었어! 화면을 톡톡 눌러서 깨워 줘!`, `💤 ${n.en} fell asleep! Tap the screen to wake her up!`),
  endTitle: T('🎉 해피엔딩!', '🎉 Happy ending!'),
  endSafe: (n: Tx): Tx => T(`${n.ko === '서희' ? '서희가' : '서진이가'} 수상한 사과를 먹지 않아서 모두가 안전했어요. 일곱 난쟁이와 백설공주는 신나는 파티를 열었답니다.`,
    `${n.en} didn't eat the strange apple, so everyone stayed safe. The seven dwarfs and Snow White threw a wonderful party.`),
  endWoke: (n: Tx): Tx => T(`모두가 힘을 합쳐 ${n.ko === '서희' ? '서희를' : '서진이를'} 깨웠어요. 난쟁이들과 백설공주는 오래오래 행복하게 살았답니다.`,
    `Everyone worked together to wake ${n.en} up. The dwarfs and Snow White lived happily ever after.`),
  again: T('다시 하기', 'Play again'),
  change: T('캐릭터 바꾸기', 'Change character'),
  close: T('알겠어! 👍', 'Got it! 👍'),
  mute: T('소리 끄기', 'Mute'),
  unmute: T('소리 켜기', 'Unmute'),
};

const GUIDE: { icon: string; title: Tx; body: Tx }[] = [
  { icon: '🚶', title: T('걷기', 'Walk'), body: T('땅을 톡 누르면 그쪽으로 걸어가요. 키보드 방향키나 WASD도 돼요.', 'Tap the ground to walk there. Arrow keys or WASD work too.') },
  { icon: '💬', title: T('대화하기', 'Talk'), body: T('백설공주, 난쟁이, 할머니를 누르면 다가가서 말을 걸어요. 말풍선을 누르면 다음 대사, 노란 버튼으로 대답을 골라요.', 'Tap Snow White, a dwarf or the old woman to walk over and talk. Tap the speech box for the next line and pick answers with the yellow buttons.') },
  { icon: '🚪', title: T('문 열기', 'Open the door'), body: T('오두막 문을 누르면 끼이익~ 열려요. 한 번 더 누르면 닫혀요.', 'Tap the cottage door and it creaks open. Tap again to close it.') },
  { icon: '🪑', title: T('의자에 앉기', 'Sit on a chair'), body: T('의자를 누르면 걸어가서 앉아요. 땅을 누르거나 “일어나기”를 누르면 일어나요.', 'Tap a chair to walk over and sit. Tap the floor or "Stand up" to get up.') },
  { icon: '🍎', title: T('사과 먹기 / 거절하기', 'Eat or refuse the apple'), body: T('식탁 위 반짝이는 사과를 누르면 집어요. “한 입 먹기”를 고르면 잠이 들어서 화면을 5번 톡톡 눌러 깨워야 하고, “안 먹을래!”를 고르면 모두 함께 파티해요.', 'Tap the sparkling apple on the table to pick it up. "Take a bite" puts you to sleep (tap 5 times to wake up); "No, thank you!" ends with a party.') },
];
GUIDE.push(
  { icon: '🎮', title: T('미니게임', 'Mini-games'), body: T('백설공주에게 꽃 따 주기(15초), 투덜이와 가위바위보, 박사와 사과 피하기! 성공하면 별 ⭐을 받아요.', 'Pick flowers for Snow White (15 s), rock-paper-scissors with Grumpy, and apple dodge with Doc! Win to earn a star ⭐.') },
  { icon: '🔍', title: T('숨바꼭질', 'Hide-and-seek'), body: T('숲속 나무 사이에 난쟁이 3명이 숨어 있어요. 찾아서 눌러 봐요!', 'Three dwarfs are hiding among the forest trees. Find them and tap them!') },
  { icon: '📖', title: T('별과 스티커 북', 'Stars & sticker book'), body: T('엔딩에서 모은 별을 확인하고, 📖 버튼에서 모은 스티커를 볼 수 있어요.', 'See your stars at the ending, and open 📖 to view the stickers you unlocked.') },
);
const CONTENTS: Tx[] = [
  T('숲속 길에서 백설공주 만나기', 'Meet Snow White on the forest path'),
  T('함께 일곱 난쟁이의 오두막으로 가기', "Walk together to the dwarfs' cottage"),
  T('문 열고 들어가 난쟁이들과 인사하기', 'Open the door and say hi to the dwarfs'),
  T('의자에 앉아 쉬기', 'Sit down and rest'),
  T('수상한 사과: 먹을까, 말까?', 'The strange apple: eat it or not?'),
  T('해피엔딩 (2가지)', 'Happy ending (2 kinds)'),
];

function Toolbar() {
  const lang = useGame((s) => s.lang); const muted = useGame((s) => s.muted);
  const g = useGame.getState(); const tx = useTx();
  return (
    <div className="toolbar">
      <div className="langs" role="group" aria-label="language">
        <button className={lang === 'ko' ? 'on' : ''} onClick={() => { sfx('click'); g.setLang('ko'); }}><span className="long">한국어</span><span className="short">한</span></button>
        <button className={lang === 'en' ? 'on' : ''} onClick={() => { sfx('click'); g.setLang('en'); }}><span className="long">English</span><span className="short">EN</span></button>
      </div>
      <button className="iconbtn" aria-label={tx(muted ? UI.unmute : UI.mute)} title={tx(muted ? UI.unmute : UI.mute)}
        onClick={() => { g.toggleMute(); sfx('click'); }}>{muted ? '🔇' : '🔊'}</button>
      <button className="iconbtn" aria-label={tx(T('스티커 북', 'Sticker book'))} title={tx(T('스티커 북', 'Sticker book'))} onClick={() => { sfx('click'); g.setBook(true); }}>📖</button>
      <button className="iconbtn" aria-label={tx(UI.guide)} title={tx(UI.guide)} onClick={() => { sfx('click'); g.setGuide(true); }}>❓</button>
    </div>
  );
}

function Guide() {
  const open = useGame((s) => s.guideOpen); const tx = useTx();
  if (!open) return null;
  return (
    <div className="guide-wrap" onClick={() => useGame.getState().setGuide(false)}>
      <div className="guide" onClick={(e) => e.stopPropagation()}>
        <h2>{tx(UI.guide)}</h2>
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

export function Hud() {
  const s = useGame();
  const tx = useTx();
  const h = HEROES[s.hero];
  const line = s.lines[s.lineIdx];

  // little "blip" whenever a new dialogue line appears
  useEffect(() => { if (line) sfx('talk'); }, [line]);
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
        {(() => {
          const got = STAR_ROWS.filter((r) => r.id === 'ending' || s.stars[r.id]);
          return (
            <div className="stars">
              <div className="star-line">{STAR_ROWS.map((r, i) => <span key={r.id} className={i < got.length ? 'on' : ''}>★</span>)}</div>
              <div className="star-list">{STAR_ROWS.map((r) => <span key={r.id} className={r.id === 'ending' || s.stars[r.id] ? 'on' : ''}>{tx(r.label)}</span>)}</div>
            </div>
          );
        })()}
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
          {s.scene === 'forest' && <span className="seek">🔍 {s.found.length}/{HIDDEN.length}</span>}
          <span className="starcount">⭐ {Object.keys(s.stars).length}</span>
          <button className="ghost" onClick={() => { sfx('click'); s.home(); }}>{tx(UI.home)}</button>
        </div>
        {s.hint && !line && !s.mini && <div className="hint">{tx(s.hint)}</div>}
        {s.toast && <div className="toast">{tx(s.toast)}</div>}
        {s.scene === 'forest' && s.swFollow && !line && (
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
        {line && (
          <div className="dialog" onClick={() => { if (!line.choices) s.next(); }}>
            <div className="speaker">{tx(line.speaker)}</div>
            <div className="text">{tx(line.text)}</div>
            {line.choices ? (
              <div className="choices">
                {line.choices.map((c) => (
                  <button key={c.id} onClick={(e) => { e.stopPropagation(); s.choose(c.id); }}>{tx(c.label)}</button>
                ))}
              </div>
            ) : <div className="more">{tx(UI.more)}</div>}
          </div>
        )}
      </>
    );
  }

  return (
    <div className={`hud scene-${s.scene}`}>
      {body}
      <Minigames />
      <Toolbar />
      <Guide />
      <Book />
    </div>
  );
}
