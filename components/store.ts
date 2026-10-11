'use client';
import { create } from 'zustand';
import * as THREE from 'three';
import { sfx, setMuted as audioSetMuted } from './audio';

export type SceneId = 'stories' | 'select' | 'forest' | 'cottage' | 'ending';
export type HeroId = 'seohui' | 'seojin';
export type Lang = 'ko' | 'en';
/** Bilingual text: every UI string and every dialogue line exists in Korean and English. */
export type Tx = { ko: string; en: string };
export const T = (ko: string, en: string): Tx => ({ ko, en });

export const HEROES: Record<HeroId, { name: Tx; age: number; call: string; subj: string; obj: string; ro: string; model: string; color: string }> = {
  seohui: { name: T('서희', 'Seohee'), age: 8, call: '서희야', subj: '서희가', obj: '서희를', ro: '서희로', model: '/models/seohui.glb', color: '#ff8fb8' },
  seojin: { name: T('서진', 'Seojin'), age: 4, call: '서진아', subj: '서진이가', obj: '서진이를', ro: '서진이로', model: '/models/seojin.glb', color: '#7cc0ff' },
};

/** Stories shown on the picker. Only Snow White is playable for now; the rest are "coming soon" slots. */
export const STORIES: { id: string; title: Tx; blurb: Tx; emoji: string; ready: boolean }[] = [
  { id: 'snow-white', title: T('백설공주와 일곱 난쟁이', 'Snow White and the Seven Dwarfs'),
    blurb: T('숲속에서 백설공주를 만나 일곱 난쟁이의 오두막으로!', 'Meet Snow White in the forest and visit the dwarfs\' cottage!'), emoji: '🍎', ready: true },
  { id: 'red-riding-hood', title: T('빨간 모자', 'Little Red Riding Hood'), blurb: T('곧 만나요!', 'Coming soon!'), emoji: '🧺', ready: false },
  { id: 'three-little-pigs', title: T('아기 돼지 삼형제', 'The Three Little Pigs'), blurb: T('곧 만나요!', 'Coming soon!'), emoji: '🐷', ready: false },
];

export const SPK = {
  story: T('이야기', 'Narrator'),
  snow: T('백설공주', 'Snow White'),
  oldWoman: T('할머니(왕비)', 'Old Woman (Queen)'),
  queen: T('왕비', 'Queen'),
};

export const DWARFS: { node: string; name: Tx; line: Tx }[] = [
  { node: 'Doc', name: T('박사', 'Doc'), line: T('나는 박사야! 우리 일곱 난쟁이 집에 온 걸 환영해.', "I'm Doc! Welcome to the home of the seven dwarfs.") },
  { node: 'Grumpy', name: T('투덜이', 'Grumpy'), line: T('흥… 신발은 털고 들어왔지? …그래도 반가워.', 'Hmph… did you wipe your shoes? …Well, nice to meet you anyway.') },
  { node: 'Happy', name: T('행복이', 'Happy'), line: T('하하! 오늘은 정말 즐거운 날이야!', 'Ha ha! Today is such a happy day!') },
  { node: 'Sleepy', name: T('졸림이', 'Sleepy'), line: T('하아암… 의자에 앉아서 같이 쉬자…', 'Yaaawn… let\'s sit down and rest together…') },
  { node: 'Bashful', name: T('수줍이', 'Bashful'), line: T('아, 안녕… 만나서 반가워…', 'Oh, h-hi… nice to meet you…') },
  { node: 'Sneezy', name: T('재채기', 'Sneezy'), line: T('에… 에… 에취! 꽃가루 때문이야!', 'Ah… ah… ACHOO! It\'s the pollen!') },
  { node: 'Dopey', name: T('덤벙이', 'Dopey'), line: T('(손을 흔들며 활짝 웃는다)', '(waves and gives a big smile)') },
];
const dw = (node: string) => DWARFS.find((d) => d.node === node)!.name;

export type MiniId = 'rps' | 'dodge' | 'flowers';
/** Sticker book entries (persisted in localStorage). */
export const STICKERS: { id: string; icon: string; name: Tx; how: Tx }[] = [
  { id: 'end-safe', icon: '🎉', name: T('파티 엔딩', 'Party ending'), how: T('사과를 거절하기', 'Refuse the apple') },
  { id: 'end-woke', icon: '🌟', name: T('깨어나기 엔딩', 'Wake-up ending'), how: T('사과를 먹고 깨어나기', 'Eat the apple and wake up') },
  { id: 'flowers', icon: '🌸', name: T('꽃 따기 달인', 'Flower picker'), how: T('15초 안에 꽃 10송이', '10 flowers in 15 seconds') },
  { id: 'rps', icon: '✌️', name: T('가위바위보 챔피언', 'RPS champion'), how: T('투덜이를 이기기', 'Beat Grumpy') },
  { id: 'dodge', icon: '🍎', name: T('사과 피하기 선수', 'Apple dodger'), how: T('떨어지는 사과 피하기', 'Dodge the falling apples') },
  { id: 'hide', icon: '🔍', name: T('숨바꼭질 탐정', 'Hide-and-seek detective'), how: T('숲에 숨은 난쟁이 3명 찾기', 'Find the 3 hidden dwarfs in the forest') },
  { id: 'seohui', icon: '🎀', name: T('서희와 모험', 'Adventure with Seohee'), how: T('서희로 끝까지 하기', 'Finish as Seohee') },
  { id: 'seojin', icon: '🌼', name: T('서진과 모험', 'Adventure with Seojin'), how: T('서진으로 끝까지 하기', 'Finish as Seojin') },
];
export const HIDDEN = ['Dopey', 'Bashful', 'Sneezy'];

export type Choice = { id: string; label: Tx };
export type Line = { speaker: Tx; text: Tx; choices?: Choice[] };

const LS = typeof window !== 'undefined' ? window.localStorage : null;
const initialLang: Lang = (LS?.getItem('shj-lang') as Lang) || 'ko';
const initialMuted = LS?.getItem('shj-muted') === '1';
const initialBook: string[] = (() => { try { return JSON.parse(LS?.getItem('shj-book') || '[]'); } catch { return []; } })();

/** Mutable, per-frame player state (kept outside React to avoid re-renders). */
export const player = {
  pos: new THREE.Vector3(),
  rotY: 0,
  moving: false,
};

type State = {
  scene: SceneId;
  hero: HeroId;
  lang: Lang;
  muted: boolean;
  guideOpen: boolean;
  bookOpen: boolean;
  story: string;
  mini: MiniId | null;
  stars: Record<string, boolean>;
  found: string[];
  book: string[];
  lines: Line[];
  lineIdx: number;
  hint: Tx | null;
  toast: Tx | null;
  target: [number, number] | null;
  pending: string | null; // interactable to use on arrival
  sitting: string | null;
  doorOpen: boolean;
  apple: 'table' | 'held' | 'eaten' | 'refused';
  sleeping: boolean;
  taps: number;
  ending: 'safe' | 'woke' | null;
  swFollow: boolean;
  metSnowWhite: boolean;
  queenGone: boolean;
  talked: Record<string, boolean>;
  spawnKey: number;

  setHero: (h: HeroId) => void;
  setLang: (l: Lang) => void;
  toggleMute: () => void;
  setGuide: (open: boolean) => void;
  setBook: (open: boolean) => void;
  unlock: (id: string) => void;
  endMini: (id: MiniId, ok: boolean, score: number) => void;
  findHidden: (name: string) => void;
  pickStory: (id: string) => void;
  home: () => void;
  start: () => void;
  goto: (s: SceneId) => void;
  say: (lines: Line[]) => void;
  next: () => void;
  choose: (id: string) => void;
  moveTo: (x: number, z: number, pending?: string | null) => void;
  arrive: () => void;
  interact: (name: string) => void;
  standUp: () => void;
  tap: () => void;
  setHint: (h: Tx | null) => void;
  flash: (t: Tx) => void;
  reset: () => void;
};

const fresh = {
  lines: [] as Line[], lineIdx: 0, hint: null, toast: null, target: null, pending: null, sitting: null,
  doorOpen: false, apple: 'table' as const, sleeping: false, taps: 0, ending: null, swFollow: false,
  metSnowWhite: false, queenGone: false, talked: {}, mini: null, stars: {}, found: [] as string[],
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useGame = create<State>((set, get) => ({
  scene: 'stories',
  hero: 'seohui',
  lang: initialLang,
  muted: initialMuted,
  guideOpen: false,
  bookOpen: false,
  story: 'snow-white',
  book: initialBook,
  spawnKey: 0,
  ...fresh,

  setHero: (h) => { sfx('click'); set({ hero: h }); },
  setLang: (lang) => { LS?.setItem('shj-lang', lang); set({ lang }); if (typeof document !== 'undefined') document.documentElement.lang = lang; },
  toggleMute: () => { const muted = !get().muted; LS?.setItem('shj-muted', muted ? '1' : '0'); audioSetMuted(muted); set({ muted }); },
  setGuide: (guideOpen) => set({ guideOpen }),
  setBook: (bookOpen) => set({ bookOpen }),
  unlock: (id) => {
    if (get().book.includes(id)) return;
    const book = [...get().book, id]; LS?.setItem('shj-book', JSON.stringify(book)); set({ book });
  },
  endMini: (id, ok, score) => {
    const n = HEROES[get().hero].name;
    set({ mini: null });
    if (ok) { set({ stars: { ...get().stars, [id]: true } }); get().unlock(id); sfx('wake'); }
    if (id === 'flowers') {
      get().say([
        { speaker: n, text: T(`꽃을 ${score}송이 땄어! 이 꽃 너 줄게! 예쁘지?`, `I picked ${score} flowers! These are for you! Aren't they pretty?`) },
        { speaker: SPK.snow, text: ok ? T('와, 이렇게 많이! 별 하나 줄게 ⭐ 이제 오두막으로 같이 가 줄래?', 'Wow, so many! Here\'s a star ⭐ Will you come with me to the cottage now?')
          : T('와, 정말 예쁘다! 이제 오두막으로 같이 가 줄래?', "Oh, they're lovely! Will you come with me to the cottage now?"), choices: [{ id: 'sw-go', label: T('같이 가자!', "Let's go!") }] },
      ]);
    }
    if (id === 'rps') get().say([{ speaker: dw('Grumpy'), text: ok ? T('흥… 졌다! 너 꽤 하는구나. 별 하나 줄게 ⭐', "Hmph… I lost! You're pretty good. Here's a star ⭐") : T('헤헷, 내가 이겼지! 다음에 또 하자.', 'Heh, I win! Let\'s play again sometime.') }]);
    if (id === 'dodge') get().say([{ speaker: dw('Doc'), text: ok ? T(`대단해! 사과를 ${score}번밖에 안 맞았어. 별 하나 줄게 ⭐`, `Amazing! Only ${score} hits. Here's a star ⭐`) : T(`어이쿠, ${score}번이나 맞았네! 다시 해 볼래?`, `Oops, ${score} hits! Want to try again?`) }]);
  },
  findHidden: (name) => {
    const g = get();
    if (g.found.includes(name) || g.lines.length || g.mini) return;
    const found = [...g.found, name];
    sfx('sparkle');
    set({ found });
    const d = DWARFS.find((x) => x.node === name)!;
    g.flash(T(`찾았다! ${d.name.ko} (${found.length}/${HIDDEN.length})`, `Found ${d.name.en}! (${found.length}/${HIDDEN.length})`));
    if (found.length === HIDDEN.length) {
      set({ stars: { ...get().stars, hide: true } }); get().unlock('hide');
      setTimeout(() => sfx('wake'), 300);
      g.say([{ speaker: d.name, text: T('들켰다! 숨바꼭질은 네가 이겼어. 별 하나 줄게 ⭐', 'You found us all! You win hide-and-seek. Here\'s a star ⭐') }]);
    } else g.say([{ speaker: d.name, text: T('앗, 들켰다! 다른 친구들도 숲 어딘가에 숨어 있어!', 'Oops, you found me! My friends are hiding somewhere in the forest too!') }]);
  },
  pickStory: (id) => { const st = STORIES.find((x) => x.id === id); if (!st?.ready) return; set({ story: id, scene: 'select' }); },
  home: () => set({ ...fresh, scene: 'stories', spawnKey: get().spawnKey + 1 }),
  start: () => { set({ ...fresh }); get().goto('forest'); },
  goto: (s) => {
    const n = HEROES[get().hero].name;
    set({ scene: s, target: null, pending: null, sitting: null, lines: [], lineIdx: 0, spawnKey: get().spawnKey + 1 });
    if (s === 'forest') {
      set({ hint: T('숲길을 따라 걸어가 보자! 땅을 누르면 그쪽으로 걸어가.', 'Follow the forest path! Tap the ground to walk there.') });
      get().say([
        { speaker: SPK.story, text: T(`옛날 옛적, 깊은 숲속에 ${HEROES[get().hero].subj} 동화 속으로 들어왔어요.`, `Once upon a time, ${n.en} stepped into a fairy tale deep in the forest.`) },
        { speaker: n, text: T('와, 여기가 백설공주 숲이구나! 저기 누가 있다!', "Wow, this is Snow White's forest! Someone's over there!") },
      ]);
    }
    if (s === 'cottage') {
      set({ hint: T('오두막 문을 눌러서 열어 봐!', 'Tap the cottage door to open it!'), doorOpen: false });
      get().say([{ speaker: SPK.snow, text: T('여기가 일곱 난쟁이의 오두막이야. 문을 열고 들어가 보자!', "This is the seven dwarfs' cottage. Let's open the door and go in!") }]);
    }
    if (s === 'ending') {
      sfx('fanfare');
      const g = get(); g.unlock(g.ending === 'safe' ? 'end-safe' : 'end-woke'); g.unlock(g.hero);
    }
  },
  say: (lines) => set({ lines, lineIdx: 0 }),
  next: () => {
    const { lines, lineIdx } = get();
    if (!lines.length) return;
    if (lines[lineIdx]?.choices) return; // must pick a choice
    if (lineIdx < lines.length - 1) set({ lineIdx: lineIdx + 1 });
    else set({ lines: [], lineIdx: 0 });
  },
  choose: (id) => {
    const h = HEROES[get().hero]; const n = h.name;
    sfx('click');
    set({ lines: [], lineIdx: 0 });
    switch (id) {
      case 'sw-go':
        set({ swFollow: true, hint: T('백설공주와 함께 길 끝 오두막까지 가 보자! (아래 버튼으로 바로 갈 수도 있어)', "Walk with Snow White to the cottage at the end of the path! (or use the button below)") });
        get().say([{ speaker: SPK.snow, text: T(`고마워, ${h.call}! 같이 가자!`, `Thank you, ${n.en}! Let's go together!`) }]);
        break;
      case 'sw-flower':
        set({ mini: 'flowers' });
        break;
      case 'rps':
        set({ mini: 'rps' });
        break;
      case 'dodge':
        set({ mini: 'dodge' });
        break;
      case 'no':
        break;
      case 'enter-cottage':
        get().goto('cottage');
        break;
      case 'eat':
        sfx('crunch');
        set({ apple: 'eaten', sleeping: true, taps: 0, sitting: null, hint: null });
        setTimeout(() => sfx('sleep'), 500);
        get().say([
          { speaker: SPK.story, text: T(`사과를 한 입 먹자… ${h.subj} 스르르 잠이 들었어요.`, `One bite of the apple… and ${n.en} fell fast asleep.`) },
          { speaker: dw('Doc'), text: T('큰일이다! 모두 화면을 톡톡 눌러서 깨워 주자!', "Oh no! Everyone, tap the screen to wake her up!") },
        ]);
        break;
      case 'refuse':
        set({ apple: 'refused', queenGone: true, hint: null });
        setTimeout(() => sfx('poof'), 900);
        get().say([
          { speaker: n, text: T('모르는 사람이 주는 음식은 먹으면 안 된다고 했어요!', "I was told never to eat food from strangers!") },
          { speaker: SPK.oldWoman, text: T('으으… 들켰구나! (펑! 하고 사라졌다)', 'Grr… you saw through me! (vanishes with a POOF!)') },
          { speaker: dw('Happy'), text: T(`${h.call}, 정말 똑똑하구나! 모두 함께 파티하자!`, `${n.en}, you're so clever! Let's all have a party!`) },
          { speaker: SPK.snow, text: T('네 덕분에 우리 모두 안전해. 고마워!', "Thanks to you, we're all safe. Thank you!"), choices: [{ id: 'end-safe', label: T('파티하자! 🎉', 'Party time! 🎉') }] },
        ]);
        break;
      case 'end-safe':
        set({ ending: 'safe' }); get().goto('ending');
        break;
      case 'end-woke':
        set({ ending: 'woke' }); get().goto('ending');
        break;
    }
  },
  moveTo: (x, z, pending = null) => {
    if (get().sleeping || get().lines.length || get().mini) return;
    if (get().sitting) set({ sitting: null });
    set({ target: [x, z], pending });
  },
  arrive: () => {
    const p = get().pending;
    set({ target: null, pending: null });
    if (p) get().interact(p);
  },
  interact: (name) => {
    const s = get();
    const h = HEROES[s.hero]; const n = h.name;
    if (s.sleeping || s.lines.length || s.mini) return;
    if (name === 'SnowWhite') {
      set({ metSnowWhite: true });
      s.say([
        { speaker: SPK.snow, text: T('안녕! 나는 백설공주야. 너는 누구니?', "Hi! I'm Snow White. Who are you?") },
        { speaker: n, text: T(`나는 ${n.ko}! ${h.age}살이야!`, `I'm ${n.en}! I'm ${h.age} years old!`) },
        { speaker: SPK.snow, text: T(`반가워, ${h.call}! 숲에서 길을 잃었는데, 저 끝에 있는 작은 오두막까지 같이 가 줄래?`, `Nice to meet you, ${n.en}! I got lost in the forest. Will you walk with me to the little cottage at the end of the path?`),
          choices: [{ id: 'sw-go', label: T('같이 가자!', "Let's go!") }, { id: 'sw-flower', label: T('꽃 따서 주기 🌸 (미니게임)', 'Pick flowers for her 🌸 (mini-game)') }] },
      ]);
      return;
    }
    if (name === 'CottageGate') {
      s.say([{ speaker: SPK.snow, text: T('저기 작은 오두막이 보여! 들어가 볼까?', 'I can see the little cottage! Shall we go in?'), choices: [{ id: 'enter-cottage', label: T('들어가 보자!', "Let's go in!") }] }]);
      return;
    }
    if (name === 'Door') {
      const open = !s.doorOpen;
      sfx(open ? 'doorOpen' : 'doorClose');
      set({ doorOpen: open, hint: open ? T('안으로 들어가서 의자에 앉거나, 난쟁이를 눌러 말을 걸어 봐!', 'Go inside! Sit on a chair or tap a dwarf to talk.') : T('문을 다시 열려면 문을 눌러 봐.', 'Tap the door to open it again.') });
      get().flash(open ? T('끼이익~ 문이 열렸어!', 'Creeeak~ the door is open!') : T('문을 닫았어.', 'You closed the door.'));
      return;
    }
    if (/^Chair\d$/.test(name)) {
      sfx('sit');
      set({ sitting: name });
      get().flash(T('의자에 앉았어! (땅을 누르면 일어나)', 'You sat down! (tap the floor to stand up)'));
      if (!s.talked['sat']) {
        set({ talked: { ...get().talked, sat: true }, hint: T('식탁 위의 빨간 사과를 눌러 봐!', 'Tap the red apple on the table!') });
        s.say([
          { speaker: dw('Sleepy'), text: T('하아암… 의자 편하지? 우리가 직접 만든 거야.', 'Yaaawn… comfy chair, right? We made it ourselves.') },
          { speaker: SPK.oldWoman, text: T('(창밖에서) 똑똑~ 얘야, 식탁 위에 아주 달콤한 빨간 사과를 두고 왔단다~', '(from the window) Knock knock~ dearie, I left a very sweet red apple on the table~') },
        ]);
      }
      return;
    }
    if (name === 'Apple') {
      if (s.apple !== 'table') return;
      sfx('pickup');
      set({ apple: 'held', sitting: null });
      s.say([
        { speaker: SPK.oldWoman, text: T(`${h.call}~ 그 사과는 세상에서 제일 달콤하단다. 한 입 먹어 보렴~`, `${n.en}~ that's the sweetest apple in the whole world. Take a bite~`) },
        { speaker: dw('Grumpy'), text: T('흠… 어쩐지 수상한데?', 'Hmm… something seems fishy…'), choices: [{ id: 'eat', label: T('한 입 먹기 🍎', 'Take a bite 🍎') }, { id: 'refuse', label: T('안 먹을래!', 'No, thank you!') }] },
      ]);
      return;
    }
    if (name === 'OldWoman') {
      s.say([{ speaker: SPK.oldWoman, text: s.apple === 'table' ? T('헤헤… 식탁 위 사과 맛 좀 보렴~', 'Heh heh… go taste the apple on the table~') : T('흥!', 'Hmph!') }]);
      return;
    }
    if (name === 'Queen') {
      s.say([{ speaker: SPK.queen, text: T('거울아 거울아, 이 세상에서 누가 제일 예쁘니?', 'Mirror, mirror on the wall, who is the fairest of them all?') }]);
      return;
    }
    const d = DWARFS.find((d) => d.node === name);
    if (d) {
      set({ talked: { ...s.talked, [name]: true } });
      if (name === 'Grumpy') s.say([{ speaker: d.name, text: d.line }, { speaker: d.name, text: T('심심한데… 나랑 가위바위보 할래? 3판 2선승이야!', "I'm bored… want to play rock-paper-scissors? Best of three!"),
        choices: [{ id: 'rps', label: T('가위바위보! ✌️', 'Rock-paper-scissors! ✌️') }, { id: 'no', label: T('다음에!', 'Maybe later!') }] }]);
      else if (name === 'Doc') s.say([{ speaker: d.name, text: d.line }, { speaker: d.name, text: T('선반에서 사과가 우르르 떨어진대! 피하기 놀이 해 볼래?', 'Apples keep tumbling off the shelf! Want to play the dodge game?'),
        choices: [{ id: 'dodge', label: T('사과 피하기! 🍎', 'Dodge the apples! 🍎') }, { id: 'no', label: T('다음에!', 'Maybe later!') }] }]);
      else s.say([{ speaker: d.name, text: d.line }]);
    }
  },
  standUp: () => set({ sitting: null }),
  tap: () => {
    const s = get();
    if (!s.sleeping || s.lines.length) return;
    const taps = s.taps + 1;
    sfx('tap');
    if (taps >= 5) {
      const h = HEROES[s.hero]; const n = h.name;
      sfx('wake');
      set({ sleeping: false, taps, queenGone: true });
      s.say([
        { speaker: n, text: T('하암… 잘 잤다! 어? 다들 왜 그렇게 쳐다봐?', 'Yawn… what a nice nap! Huh? Why is everyone staring at me?') },
        { speaker: dw('Doc'), text: T(`만세! ${h.subj} 깨어났다! 모두가 힘을 합친 덕분이야!`, `Hooray! ${n.en} is awake! We did it together!`) },
        { speaker: SPK.snow, text: T('다음엔 모르는 사람이 주는 사과는 먹지 말자, 약속!', "Next time, let's not eat apples from strangers. Promise!"), choices: [{ id: 'end-woke', label: T('약속! 🤙', 'Promise! 🤙') }] },
      ]);
    } else set({ taps });
  },
  setHint: (hint) => set({ hint }),
  flash: (t) => {
    set({ toast: t });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: null }), 1800);
  },
  reset: () => set({ ...fresh, scene: 'select', spawnKey: get().spawnKey + 1 }),
}));

/** Pick the current language from a bilingual string. */
export const useTx = () => { const lang = useGame((s) => s.lang); return (t: Tx | null | undefined) => (t ? t[lang] : ''); };

if (typeof window !== 'undefined') {
  (window as unknown as { __snow: unknown }).__snow = { useGame, player };
}
