'use client';
import { create } from 'zustand';
import * as THREE from 'three';

export type SceneId = 'select' | 'forest' | 'cottage' | 'ending';
export type HeroId = 'seohui' | 'seojin';

export const HEROES: Record<HeroId, { name: string; age: number; call: string; subj: string; obj: string; ro: string; model: string; color: string }> = {
  seohui: { name: '서희', age: 8, call: '서희야', subj: '서희가', obj: '서희를', ro: '서희로', model: '/models/seohui.glb', color: '#ff8fb8' },
  seojin: { name: '서진', age: 4, call: '서진아', subj: '서진이가', obj: '서진이를', ro: '서진이로', model: '/models/seojin.glb', color: '#7cc0ff' },
};

export const DWARFS: { node: string; ko: string; line: string }[] = [
  { node: 'Doc', ko: '박사', line: '나는 박사야! 우리 일곱 난쟁이 집에 온 걸 환영해.' },
  { node: 'Grumpy', ko: '투덜이', line: '흥… 신발은 털고 들어왔지? …그래도 반가워.' },
  { node: 'Happy', ko: '행복이', line: '하하! 오늘은 정말 즐거운 날이야!' },
  { node: 'Sleepy', ko: '졸림이', line: '하아암… 의자에 앉아서 같이 쉬자…' },
  { node: 'Bashful', ko: '수줍이', line: '아, 안녕… 만나서 반가워…' },
  { node: 'Sneezy', ko: '재채기', line: '에… 에… 에취! 꽃가루 때문이야!' },
  { node: 'Dopey', ko: '덤벙이', line: '(손을 흔들며 활짝 웃는다)' },
];

export type Choice = { id: string; label: string };
export type Line = { speaker: string; text: string; choices?: Choice[] };

/** Mutable, per-frame player state (kept outside React to avoid re-renders). */
export const player = {
  pos: new THREE.Vector3(),
  rotY: 0,
  moving: false,
};

type State = {
  scene: SceneId;
  hero: HeroId;
  lines: Line[];
  lineIdx: number;
  hint: string | null;
  toast: string | null;
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
  setHint: (h: string | null) => void;
  flash: (t: string) => void;
  reset: () => void;
};

const fresh = {
  lines: [] as Line[], lineIdx: 0, hint: null, toast: null, target: null, pending: null, sitting: null,
  doorOpen: false, apple: 'table' as const, sleeping: false, taps: 0, ending: null, swFollow: false,
  metSnowWhite: false, queenGone: false, talked: {},
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useGame = create<State>((set, get) => ({
  scene: 'select',
  hero: 'seohui',
  spawnKey: 0,
  ...fresh,

  setHero: (h) => set({ hero: h }),
  start: () => { set({ ...fresh }); get().goto('forest'); },
  goto: (s) => {
    const h = HEROES[get().hero];
    set({ scene: s, target: null, pending: null, sitting: null, lines: [], lineIdx: 0, spawnKey: get().spawnKey + 1 });
    if (s === 'forest') {
      set({ hint: '숲길을 따라 걸어가 보자! 땅을 누르면 그쪽으로 걸어가.' });
      get().say([
        { speaker: '이야기', text: `옛날 옛적, 깊은 숲속에 ${h.subj} 동화 속으로 들어왔어요.` },
        { speaker: h.name, text: '와, 여기가 백설공주 숲이구나! 저기 누가 있다!' },
      ]);
    }
    if (s === 'cottage') {
      set({ hint: '오두막 문을 눌러서 열어 봐!', doorOpen: false });
      get().say([{ speaker: '백설공주', text: '여기가 일곱 난쟁이의 오두막이야. 문을 열고 들어가 보자!' }]);
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
    const h = HEROES[get().hero];
    set({ lines: [], lineIdx: 0 });
    switch (id) {
      case 'sw-go':
        set({ swFollow: true, hint: '백설공주와 함께 길 끝 오두막까지 가 보자! (아래 버튼으로 바로 갈 수도 있어)' });
        get().say([{ speaker: '백설공주', text: `고마워, ${h.call}! 같이 가자!` }]);
        break;
      case 'sw-flower':
        get().say([
          { speaker: h.name, text: '이 꽃 너 줄게! 예쁘지?' },
          { speaker: '백설공주', text: '와, 정말 예쁘다! 이제 오두막으로 같이 가 줄래?', choices: [{ id: 'sw-go', label: '같이 가자!' }] },
        ]);
        break;
      case 'enter-cottage':
        get().goto('cottage');
        break;
      case 'eat':
        set({ apple: 'eaten', sleeping: true, taps: 0, sitting: null, hint: null });
        get().say([
          { speaker: '이야기', text: `사과를 한 입 먹자… ${h.subj} 스르르 잠이 들었어요.` },
          { speaker: '박사', text: '큰일이다! 모두 화면을 톡톡 눌러서 깨워 주자!' },
        ]);
        break;
      case 'refuse':
        set({ apple: 'refused', queenGone: true, hint: null });
        get().say([
          { speaker: h.name, text: '모르는 사람이 주는 음식은 먹으면 안 된다고 했어요!' },
          { speaker: '할머니(왕비)', text: '으으… 들켰구나! (펑! 하고 사라졌다)' },
          { speaker: '행복이', text: `${h.call}, 정말 똑똑하구나! 모두 함께 파티하자!` },
          { speaker: '백설공주', text: '네 덕분에 우리 모두 안전해. 고마워!', choices: [{ id: 'end-safe', label: '파티하자! 🎉' }] },
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
    if (get().sleeping || get().lines.length) return;
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
    const h = HEROES[s.hero];
    if (s.sleeping || s.lines.length) return;
    if (name === 'SnowWhite') {
      set({ metSnowWhite: true });
      s.say([
        { speaker: '백설공주', text: `안녕! 나는 백설공주야. 너는 누구니?` },
        { speaker: h.name, text: `나는 ${h.name}! ${h.age}살이야!` },
        { speaker: '백설공주', text: `반가워, ${h.call}! 숲에서 길을 잃었는데, 저 끝에 있는 작은 오두막까지 같이 가 줄래?`,
          choices: [{ id: 'sw-go', label: '같이 가자!' }, { id: 'sw-flower', label: '꽃 한 송이 주기 🌸' }] },
      ]);
      return;
    }
    if (name === 'CottageGate') {
      s.say([{ speaker: '백설공주', text: '저기 작은 오두막이 보여! 들어가 볼까?', choices: [{ id: 'enter-cottage', label: '들어가 보자!' }] }]);
      return;
    }
    if (name === 'Door') {
      const open = !s.doorOpen;
      set({ doorOpen: open, hint: open ? '안으로 들어가서 의자에 앉거나, 난쟁이를 눌러 말을 걸어 봐!' : '문을 다시 열려면 문을 눌러 봐.' });
      get().flash(open ? '끼이익~ 문이 열렸어!' : '문을 닫았어.');
      return;
    }
    if (/^Chair\d$/.test(name)) {
      set({ sitting: name });
      get().flash('의자에 앉았어! (땅을 누르면 일어나)');
      if (!s.talked['sat']) {
        set({ talked: { ...get().talked, sat: true }, hint: '식탁 위의 빨간 사과를 눌러 봐!' });
        s.say([
          { speaker: '졸림이', text: '하아암… 의자 편하지? 우리가 직접 만든 거야.' },
          { speaker: '할머니(왕비)', text: '(창밖에서) 똑똑~ 얘야, 식탁 위에 아주 달콤한 빨간 사과를 두고 왔단다~' },
        ]);
      }
      return;
    }
    if (name === 'Apple') {
      if (s.apple !== 'table') return;
      set({ apple: 'held', sitting: null });
      s.say([
        { speaker: '할머니(왕비)', text: `${h.call}~ 그 사과는 세상에서 제일 달콤하단다. 한 입 먹어 보렴~` },
        { speaker: '투덜이', text: '흠… 어쩐지 수상한데?', choices: [{ id: 'eat', label: '한 입 먹기 🍎' }, { id: 'refuse', label: '안 먹을래!' }] },
      ]);
      return;
    }
    if (name === 'OldWoman') {
      s.say([{ speaker: '할머니(왕비)', text: s.apple === 'table' ? '헤헤… 식탁 위 사과 맛 좀 보렴~' : '흥!' }]);
      return;
    }
    if (name === 'Queen') {
      s.say([{ speaker: '왕비', text: '거울아 거울아, 이 세상에서 누가 제일 예쁘니?' }]);
      return;
    }
    const d = DWARFS.find((d) => d.node === name);
    if (d) {
      set({ talked: { ...s.talked, [name]: true } });
      s.say([{ speaker: d.ko, text: d.line }]);
    }
  },
  standUp: () => set({ sitting: null }),
  tap: () => {
    const s = get();
    if (!s.sleeping || s.lines.length) return;
    const taps = s.taps + 1;
    if (taps >= 5) {
      const h = HEROES[s.hero];
      set({ sleeping: false, taps, queenGone: true });
      s.say([
        { speaker: h.name, text: '하암… 잘 잤다! 어? 다들 왜 그렇게 쳐다봐?' },
        { speaker: '박사', text: `만세! ${h.subj} 깨어났다! 모두가 힘을 합친 덕분이야!` },
        { speaker: '백설공주', text: '다음엔 모르는 사람이 주는 사과는 먹지 말자, 약속!', choices: [{ id: 'end-woke', label: '약속! 🤙' }] },
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

if (typeof window !== 'undefined') {
  (window as unknown as { __snow: unknown }).__snow = { useGame, player };
}
