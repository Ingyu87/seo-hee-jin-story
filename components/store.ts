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
/** Doc asks the player for help: three dwarfs went to play hide-and-seek in the forest and haven't come back. */
export const SEEK_ASK = (call: string, en: string): Line => ({ speaker: dw('Doc'), text: T(`그런데 큰일이야, ${call}! 덤벙이·수줍이·재채기가 숲에서 숨바꼭질하다가 아직 안 돌아왔어. 숲에 가서 찾아 줄래?`, `But we have a problem, ${en}! Dopey, Bashful and Sneezy went to play hide-and-seek in the forest and haven't come back. Will you go and find them?`),
  choices: [{ id: 'seek-help', label: T('도와줄게! 🔍', "I'll help! 🔍") }, { id: 'no', label: T('나중에', 'Later') }] });

export type MiniId = 'rps' | 'dodge' | 'flowers';
/** Sticker book entries (persisted in localStorage). */
export const STICKERS: { id: string; icon: string; name: Tx; how: Tx }[] = [
  { id: 'end-safe', icon: '🎉', name: T('파티 엔딩', 'Party ending'), how: T('백설공주가 독 사과를 먹지 않게 도와주기', 'Stop Snow White from eating the poison apple') },
  { id: 'end-woke', icon: '🌟', name: T('깨어나기 엔딩', 'Wake-up ending'), how: T('잠든 백설공주를 깨워 주기', 'Wake the sleeping Snow White') },
  { id: 'flowers', icon: '🌸', name: T('꽃 따기 달인', 'Flower picker'), how: T('15초 안에 꽃 10송이', '10 flowers in 15 seconds') },
  { id: 'rps', icon: '✌️', name: T('가위바위보 챔피언', 'RPS champion'), how: T('투덜이를 이기기', 'Beat Grumpy') },
  { id: 'dodge', icon: '🍎', name: T('사과 피하기 선수', 'Apple dodger'), how: T('떨어지는 사과 피하기', 'Dodge the falling apples') },
  { id: 'hide', icon: '🔍', name: T('숨바꼭질 탐정', 'Hide-and-seek detective'), how: T('숲에 숨은 난쟁이 3명 찾기', 'Find the 3 hidden dwarfs in the forest') },
  { id: 'seohui', icon: '🎀', name: T('서희와 모험', 'Adventure with Seohee'), how: T('서희로 끝까지 하기', 'Finish as Seohee') },
  { id: 'seojin', icon: '🌼', name: T('서진과 모험', 'Adventure with Seojin'), how: T('서진으로 끝까지 하기', 'Finish as Seojin') },
];
export const HIDDEN = ['Dopey', 'Bashful', 'Sneezy'];


/**
 * The Snow White story, told beat-by-beat by the characters. Each time you talk to someone (tap them or
 * press the action button / E nearby) they tell the next part, so kids learn the fairy tale as they play.
 */
const BEATS: Record<string, Line[][]> = {
  SnowWhite: [ // used after the first meeting, while walking to the cottage
    [{ speaker: SPK.snow, text: T('우리 아빠는 왕이셨어. 엄마가 하늘나라에 가신 뒤에 새 왕비님이 오셨지.', 'My father was the King. After my mother passed away, a new Queen came to the castle.') },
     { speaker: SPK.snow, text: T('새 왕비님은 마법 거울을 가지고 있었어. 매일 거울에게 “누가 제일 예쁘니?” 하고 물었대.', 'The new Queen had a magic mirror. Every day she asked it, "Who is the fairest of them all?"') }],
    [{ speaker: SPK.snow, text: T('어느 날 거울이 “백설공주가 제일 예뻐요” 하고 대답했어. 왕비님은 너무너무 화가 났지.', 'One day the mirror answered, "Snow White is the fairest." The Queen became very, very angry.') },
     { speaker: SPK.snow, text: T('왕비님은 사냥꾼에게 나를 숲속 깊이 데려가라고 했어. 하지만 착한 사냥꾼이 “어서 도망가세요!” 하고 나를 보내 줬어.', 'She told a huntsman to take me deep into the forest. But the kind huntsman said, "Run away, quickly!" and let me go.') }],
    [{ speaker: SPK.snow, text: T('깜깜한 숲이 무서워서 엉엉 울었는데, 토끼랑 새랑 다람쥐가 와서 길을 알려 줬어.', 'The dark forest was scary and I cried, but rabbits, birds and squirrels came and showed me the way.') },
     { speaker: SPK.snow, text: T('동물 친구들이 그러는데, 길 끝에 아주 작은 오두막이 있대. 거기까지 같이 가자!', 'My animal friends say there is a tiny cottage at the end of the path. Let\'s go there together!') }],
  ],
  SnowWhiteHome: [
    [{ speaker: SPK.snow, text: T('난쟁이들이 나를 여기서 지내게 해 줬어. 나는 청소도 하고 맛있는 수프도 끓여 줄 거야.', 'The dwarfs said I can stay here. I\'ll tidy up and cook them a yummy soup.') }],
    [{ speaker: SPK.snow, text: T('난쟁이들이 그랬어. “우리가 일하러 간 동안 모르는 사람에게 문을 열어 주면 안 돼!”', 'The dwarfs told me, "While we\'re at work, never open the door to strangers!"') },
     { speaker: SPK.snow, text: T('왕비님이 내가 여기 있는 걸 알면 어떡하지… 너도 조심해야 해!', 'What if the Queen finds out I\'m here… You be careful too!') }],
  ],
  Queen: [
    [{ speaker: SPK.queen, text: T('거울아 거울아, 이 세상에서 누가 제일 예쁘니?', 'Mirror, mirror on the wall, who is the fairest of them all?') },
     { speaker: T('마법 거울', 'Magic Mirror'), text: T('왕비님도 예쁘지만… 숲속 일곱 난쟁이의 오두막으로 가는 백설공주가 훨씬 더 예뻐요.', 'You are fair, my Queen… but Snow White, on her way to the seven dwarfs\' cottage, is fairer still.') },
     { speaker: SPK.queen, text: T('뭐라고?! 사냥꾼이 나를 속였구나! 두고 보자!', 'What?! The huntsman tricked me! Just you wait!') },
     { speaker: T('나', 'Me'), text: T('(나무 뒤에 숨어서 다 들었어!) 큰일이다… 내가 백설공주를 꼭 지켜 줘야지!', '(I heard everything from behind a tree!) Oh no… I have to protect Snow White!') }],
    [{ speaker: SPK.queen, text: T('흐흐흐… 좋은 생각이 났다. 마법으로 꼬부랑 할머니로 변장해야지.', 'Heh heh heh… I have an idea. I\'ll use magic to disguise myself as an old woman.') },
     { speaker: SPK.queen, text: T('그리고 한 입만 먹어도 깊이 잠드는 빨간 독 사과를 만들 거야!', 'And I\'ll make a shiny red poison apple — one bite and you fall into a deep sleep!') },
     { speaker: SPK.story, text: T('큰일이에요! 왕비가 무서운 계획을 세웠어요. 왕비는 펑! 하고 사라졌어요.', 'Oh no! The Queen has a wicked plan. Then she vanished with a POOF!') },
     { speaker: SPK.story, text: T('백설공주를 도와줄 수 있는 건 바로 너야! 빨간 사과를 꼭 기억해 줘.', 'You are the one who can help Snow White! Remember the red apple.') }],
  ],
  Doc: [
    [{ speaker: T('박사', 'Doc'), text: T('나는 박사야! 우리 일곱 난쟁이는 매일 광산에 가서 반짝반짝 보석을 캐. 하이호~ 하이호~', 'I\'m Doc! We seven dwarfs go to the mine every day to dig sparkly jewels. Heigh-ho, heigh-ho~') }],
    [{ speaker: T('박사', 'Doc'), text: T('일 끝나고 집에 오니까 집이 깨끗하고, 우리 침대 일곱 개에 백설공주가 쿨쿨 자고 있었지 뭐야!', 'When we came home from work, the house was spotless — and Snow White was fast asleep across our seven little beds!') }],
  ],
  Grumpy: [[{ speaker: T('투덜이', 'Grumpy'), text: T('흥, 처음엔 공주가 우리 집에 사는 게 싫었어. …근데 공주가 만든 수프는 정말 맛있더라.', 'Hmph, at first I didn\'t want a princess living here. …But her soup is really tasty.') }]],
  Happy: [[{ speaker: T('행복이', 'Happy'), text: T('밤마다 백설공주랑 노래하고 춤춰! 우리 집이 이렇게 즐거운 건 처음이야!', 'Every night we sing and dance with Snow White! Our home has never been this much fun!') }]],
  Sleepy: [[{ speaker: T('졸림이', 'Sleepy'), text: T('하아암… 백설공주가 우리 침대에서 자고 있어서 나는 의자에서 잤어… 그래도 괜찮아…', 'Yaaawn… Snow White was asleep in our beds, so I slept on a chair… that\'s okay though…') }]],
  Bashful: [[{ speaker: T('수줍이', 'Bashful'), text: T('배, 백설공주는 정말 친절해… 우리한테 손 씻는 법도 알려 줬어…', 'S-Snow White is so kind… she even taught us to wash our hands…') }]],
  Sneezy: [[{ speaker: T('재채기', 'Sneezy'), text: T('에취! 우리가 광산에 가면 공주 혼자 집에 있어. 낯선 사람이 오면 절대 문 열어 주면 안 돼! 에취!', 'ACHOO! When we go to the mine, the princess stays home alone. Never open the door to a stranger! ACHOO!') }]],
  Dopey: [[{ speaker: T('덤벙이', 'Dopey'), text: T('(덤벙이는 말을 못 하지만, 빨간 사과를 가리키며 고개를 절레절레 흔든다. “먹으면 안 돼!”)', '(Dopey can\'t talk, but he points at a red apple and shakes his head: "Don\'t eat it!")') }]],
};
/** Next story beat for a character (null when they've told everything; then they repeat the last one). */
function beat(name: string, beats: Record<string, number>): Line[] | null {
  const list = BEATS[name]; if (!list) return null;
  const i = beats[name] ?? 0;
  return list[Math.min(i, list.length - 1)];
}

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
  jumpY: 0, // hop height above the ground
  vy: 0,
};

/** Live world positions of NPCs (they wander). Used by the action button and the conversation camera. */
export const npcPos: Record<string, THREE.Vector3> = {};

/**
 * Scripted movement for story beats: an NPC walks a path of waypoints ('player' = walk up to the player),
 * then `done` fires (e.g. start a conversation). While a goal is set the NPC ignores its idle wandering.
 */
export type NpcGoal = { path: ([number, number] | 'player')[]; speed?: number; done?: () => void; i?: number };
export const npcGoal: Record<string, NpcGoal | undefined> = {};
export function walkNpc(name: string, path: NpcGoal['path'], done?: () => void, speed = 1.6) { npcGoal[name] = { path, done, speed, i: 0 }; }

/** Run-escort helper: "skip" = auto-run straight through (obstacles ignored, faster) for little ones. */
export const escort = { skip: false };

/** Hop! (jump button / Space). Returns false if already in the air or busy. */
export function jump() {
  const g = useGame.getState();
  if (player.jumpY > 0.001 || g.sleeping || g.lines.length || g.mini) return false;
  if (g.sitting) g.standUp();
  player.vy = 5.2;
  sfx('jump');
  return true;
}

type State = {
  scene: SceneId;
  hero: HeroId;
  lang: Lang;
  muted: boolean;
  voice: boolean; // read story lines aloud (speechSynthesis)
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
  apple: 'hidden' | 'table' | 'held' | 'eaten' | 'refused';
  dwarfs: 'home' | 'leaving' | 'away' | 'returning';
  sleeping: boolean;
  taps: number;
  ending: 'safe' | 'woke' | null;
  swFollow: boolean;
  seek: 'off' | 'on' | 'done'; // hide-and-seek mission (asked for by Doc in the cottage)
  metSnowWhite: boolean;
  queenGone: boolean;
  talked: Record<string, boolean>;
  beats: Record<string, number>; // how far each character has told their part of the story
  spawnKey: number;
  talker: string | null; // NPC currently speaking (waves)
  running: boolean; // run-escort to the cottage in progress (auto-forward)

  setHero: (h: HeroId) => void;
  setLang: (l: Lang) => void;
  toggleMute: () => void;
  toggleVoice: () => void;
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
  skip: () => void;
  choose: (id: string) => void;
  moveTo: (x: number, z: number, pending?: string | null) => void;
  arrive: () => void;
  interact: (name: string) => void;
  standUp: () => void;
  dwarfsLeave: () => void;
  oldWomanArrives: () => void;
  dwarfsBack: () => void;
  tap: () => void;
  setHint: (h: Tx | null) => void;
  flash: (t: Tx) => void;
  reset: () => void;
};

const fresh = {
  lines: [] as Line[], lineIdx: 0, hint: null, toast: null, target: null, pending: null, sitting: null,
  doorOpen: false, apple: 'hidden' as 'hidden' | 'table' | 'held' | 'eaten' | 'refused', dwarfs: 'home' as 'home' | 'leaving' | 'away' | 'returning', sleeping: false, taps: 0, ending: null, swFollow: false,
  metSnowWhite: false, queenGone: false, seek: 'off' as 'off' | 'on' | 'done', talked: {}, beats: {} as Record<string, number>, talker: null as string | null, running: false, mini: null, stars: {}, found: [] as string[],
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useGame = create<State>((set, get) => ({
  scene: 'stories',
  hero: 'seohui',
  lang: initialLang,
  muted: initialMuted,
  voice: LS?.getItem('shj-voice') !== '0',
  guideOpen: false,
  bookOpen: false,
  story: 'snow-white',
  book: initialBook,
  spawnKey: 0,
  ...fresh,

  setHero: (h) => { sfx('click'); set({ hero: h }); },
  setLang: (lang) => { LS?.setItem('shj-lang', lang); set({ lang }); if (typeof document !== 'undefined') document.documentElement.lang = lang; },
  toggleMute: () => { const muted = !get().muted; LS?.setItem('shj-muted', muted ? '1' : '0'); audioSetMuted(muted); set({ muted }); },
  toggleVoice: () => { const voice = !get().voice; LS?.setItem('shj-voice', voice ? '1' : '0'); set({ voice }); },
  setGuide: (guideOpen) => set({ guideOpen }),
  setBook: (bookOpen) => set({ bookOpen }),
  unlock: (id) => {
    if (get().book.includes(id)) return;
    const book = [...get().book, id]; LS?.setItem('shj-book', JSON.stringify(book)); set({ book });
  },
  endMini: (id, ok, score) => {
    const n = HEROES[get().hero].name;
    set({ mini: null, talker: id === 'rps' ? 'Grumpy' : id === 'dodge' ? 'Doc' : 'SnowWhite' });
    if (ok) { set({ stars: { ...get().stars, [id]: true } }); get().unlock(id); sfx('wake'); }
    if (id === 'flowers') {
      get().say([
        { speaker: n, text: T(`꽃을 ${score}송이 땄어! 이 꽃 너 줄게! 예쁘지?`, `I picked ${score} flowers! These are for you! Aren't they pretty?`) },
        { speaker: SPK.snow, text: ok ? T('와, 이렇게 많이! 꽃향기 정말 좋다~ 이제 오두막으로 같이 가 줄래?', 'Wow, so many! They smell lovely~ Will you come with me to the cottage now?')
          : T('와, 정말 예쁘다! 이제 오두막으로 같이 가 줄래?', "Oh, they're lovely! Will you come with me to the cottage now?"), choices: [{ id: 'sw-go', label: T('같이 가자!', "Let's go!") }] },
      ]);
    }
    if (id === 'rps') get().say([{ speaker: dw('Grumpy'), text: ok ? T('흥… 졌다! 너 꽤 하는구나. …다음엔 안 질 거야!', "Hmph… I lost! You're pretty good. …I'll win next time!") : T('헤헷, 내가 이겼지! 다음에 또 하자.', 'Heh, I win! Let\'s play again sometime.') }]);
    if (id === 'dodge') get().say([{ speaker: dw('Doc'), text: ok ? T(`대단해! 사과를 ${score}번밖에 안 맞았어. 날쌘돌이구나!`, `Amazing! Only ${score} hits. You're so quick!`) : T(`어이쿠, ${score}번이나 맞았네! 다시 해 볼래?`, `Oops, ${score} hits! Want to try again?`) }]);
  },
  findHidden: (name) => {
    const g = get();
    if (g.found.includes(name) || g.lines.length || g.mini) return;
    const found = [...g.found, name];
    sfx('sparkle');
    set({ found, talker: name });
    const d = DWARFS.find((x) => x.node === name)!;
    g.flash(T(`찾았다! ${d.name.ko} (${found.length}/${HIDDEN.length})`, `Found ${d.name.en}! (${found.length}/${HIDDEN.length})`));
    if (found.length === HIDDEN.length) {
      set({ stars: { ...get().stars, hide: true }, seek: 'done' }); get().unlock('hide');
      setTimeout(() => sfx('wake'), 300);
      g.say([{ speaker: d.name, text: T('들켰다! 숨바꼭질은 네가 이겼어. 박사가 걱정하겠다, 얼른 가자!', 'You found us all! You win hide-and-seek. Doc must be worried — let\'s go!') },
        { speaker: SPK.story, text: T('미션 성공! 난쟁이 3명을 모두 찾았어요. 다 같이 오두막으로 돌아가요!', 'Mission complete! You found all 3 dwarfs. Let\'s all go back to the cottage!'),
          choices: [{ id: 'seek-home', label: T('오두막으로 돌아가기 🏠', 'Back to the cottage 🏠') }] }]);
    } else g.say([{ speaker: d.name, text: T('앗, 들켰다! 박사가 찾는다고? 알았어, 먼저 오두막에 가 있을게! 다른 친구들도 숲 어딘가에 숨어 있어!', 'Oops, you found me! Doc is looking for us? Okay, I\'ll head home! My friends are still hiding somewhere in the forest!') }]);
  },
  pickStory: (id) => { const st = STORIES.find((x) => x.id === id); if (!st?.ready) return; set({ story: id, scene: 'select' }); },
  home: () => set({ ...fresh, scene: 'stories', spawnKey: get().spawnKey + 1 }),
  start: () => { set({ ...fresh }); get().goto('forest'); },
  goto: (s) => {
    escort.skip = false;
    const n = HEROES[get().hero].name;
    set({ scene: s, target: null, pending: null, sitting: null, lines: [], lineIdx: 0, spawnKey: get().spawnKey + 1 });
    if (s === 'forest' && get().seek === 'on') {
      const h = HEROES[get().hero];
      set({ hint: T('🔍 숨은 난쟁이 3명을 찾아라! 길가 덤불 뒤를 잘 살펴봐.', '🔍 Find the 3 hidden dwarfs! Check behind the bushes by the path.') });
      get().say([
        { speaker: SPK.story, text: T(`${h.subj} 난쟁이들을 찾으러 다시 숲으로 왔어요. 어디선가 “에… 에취!” 소리가 들려요!`, `${n.en} went back to the forest to look for the dwarfs. Somewhere nearby: "Ah… ah… ACHOO!"`) },
        { speaker: n, text: T('재채기 소리다! 나무 뒤에 숨어 있나 봐. 내가 꼭 찾아 줄게!', "That's a sneeze! Someone's hiding behind a tree. I'll find them!") },
        { speaker: SPK.story, text: T('🔍 미션: 숨은 난쟁이 3명 찾기! 덤불이 흔들리거나 모자가 살짝 보이면 가까이 가 봐! 버튼이 🔍 로 반짝여요. 그때 누르면 “찾았다!” 3명 다 찾아서 오두막에 데려다주자!',
          '🔍 Mission: find the 3 hidden dwarfs! If a bush wiggles or a hat peeks out, get close — the button glows 🔍 — press it to shout "Found you!" Find all 3 and bring them home!') },
      ]);
    } else if (s === 'forest') {
      set({ hint: T('숲길을 따라 걸어가 보자! 땅을 누르면 그쪽으로 걸어가.', 'Follow the forest path! Tap the ground to walk there.') });
      get().say([
        { speaker: SPK.story, text: T('옛날 옛적, 눈처럼 하얀 얼굴의 예쁜 공주님이 살았어요. 이름은 백설공주였지요.', 'Once upon a time there lived a lovely princess with skin as white as snow. Her name was Snow White.') },
        { speaker: SPK.story, text: T('그런데 새 왕비는 마법 거울이 “백설공주가 제일 예뻐요”라고 하자 화가 나서, 백설공주를 깊은 숲으로 쫓아냈어요.', 'But when the Queen\'s magic mirror said "Snow White is the fairest," the jealous Queen sent Snow White away into the deep forest.') },
        { speaker: SPK.story, text: T(`바로 그 숲속으로 ${HEROES[get().hero].subj} 동화 속에 들어왔어요!`, `And into that very forest, ${n.en} stepped into the fairy tale!`) },
        { speaker: n, text: T('와, 여기가 백설공주 숲이구나! 저기 누가 있다! 가까이 가서 말을 걸어 보자.', "Wow, this is Snow White's forest! Someone's over there! Let's go and say hello.") },
      ]);
    }
    if (s === 'cottage') {
      set({ hint: T('오두막 문을 눌러서 열어 봐!', 'Tap the cottage door to open it!'), doorOpen: false });
      if (get().seek === 'done' && !get().talked['seekThanks']) {
        set({ talked: { ...get().talked, seekThanks: true }, talker: 'Doc' });
        get().say([{ speaker: dw('Doc'), text: T(`${HEROES[get().hero].call}, 덤벙이·수줍이·재채기를 다 찾아 줘서 고마워! 이제 일곱 명 모두 모였어. 문 열고 들어와!`, `${n.en}, thank you for finding Dopey, Bashful and Sneezy! All seven of us are home. Open the door and come in!`) }]);
      } else get().say([{ speaker: SPK.snow, text: T('여기가 일곱 난쟁이의 오두막이야. 문을 열고 들어가 보자!', "This is the seven dwarfs' cottage. Let's open the door and go in!") }]);
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
  /** Fast-forward: jump straight to the next question in this conversation (or close it if there is none). */
  skip: () => {
    const { lines, lineIdx } = get();
    if (!lines.length || lines[lineIdx]?.choices) return;
    const q = lines.findIndex((l, i) => i >= lineIdx && !!l.choices);
    if (q >= 0) set({ lineIdx: q }); else set({ lines: [], lineIdx: 0 });
  },
  choose: (id) => {
    const h = HEROES[get().hero]; const n = h.name;
    sfx('click');
    set({ lines: [], lineIdx: 0 });
    switch (id) {
      case 'sw-go':
        set({ swFollow: true, hint: T('🏃 저절로 앞으로 걸어가요! ◀ ▶ (밀기/조이스틱)로 가시덤불을 피하고, 점프로 넘어가! 백설공주가 뒤따라와요.', '🏃 You walk forward by yourself! Steer ◀ ▶ (swipe / stick) around the thorns, or jump over! Snow White follows you.') });
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
      case 'seek-help': // Doc asked for help → hide-and-seek mission in the forest
        set({ seek: 'on', found: [] });
        get().goto('forest');
        break;
      case 'seek-home':
        get().goto('cottage');
        break;
      case 'enter-cottage':
        get().goto('cottage');
        break;
      case 'eat': // the player only watched → Snow White takes a bite
        sfx('crunch');
        set({ apple: 'eaten', sleeping: true, taps: 0, sitting: null, hint: null, talker: 'SnowWhiteHome' });
        setTimeout(() => sfx('sleep'), 500);
        setTimeout(() => sfx('poof'), 2500);
        get().say([
          { speaker: SPK.story, text: T('백설공주가 사과를 한 입 깨물자… 스르르 깊은 잠에 빠지고 말았어요.', 'Snow White took one bite of the apple… and fell into a deep, deep sleep.') },
          { speaker: SPK.oldWoman, text: T('흐흐흐! 이제 세상에서 내가 제일 예쁘다! (펑! 하고 사라졌다)', 'Heh heh heh! Now I am the fairest of them all! (vanishes with a POOF!)') },
          { speaker: SPK.story, text: T('바로 그때, 일을 마친 일곱 난쟁이가 “하이호~” 노래하며 돌아왔어요.', 'Just then, the seven dwarfs came home from work singing "Heigh-ho!"') },
          { speaker: dw('Doc'), text: T(`이런! 백설공주가 잠들었잖아! ${h.call}, 우리 같이 백설공주를 깨우자! 화면을 톡톡 눌러 줘!`, `Oh no! Snow White has fallen asleep! ${n.en}, help us wake her up! Tap the screen!`) },
        ]);
        set({ queenGone: true });
        get().dwarfsBack();
        break;
      case 'refuse': // the player warns Snow White / takes the apple away
        set({ apple: 'refused', hint: null, talker: 'SnowWhiteHome' });
        setTimeout(() => sfx('poof'), 2600);
        get().say([
          { speaker: n, text: T('백설공주야, 먹으면 안 돼! 난쟁이들이 모르는 사람이 주는 건 받지 말라고 했잖아!', "Snow White, don't eat it! The dwarfs said never to take things from strangers!") },
          { speaker: SPK.snow, text: T(`맞다! 알려 줘서 고마워, ${h.call}! 하마터면 큰일 날 뻔했어.`, `You're right! Thank you, ${n.en}! That was close.`) },
          { speaker: SPK.oldWoman, text: T('으으… 들켰구나! 저 꼬마 때문에! (펑! 하고 사라졌다)', 'Grr… foiled by that child! (vanishes with a POOF!)') },
          { speaker: SPK.story, text: T('할머니는 사실 변장한 왕비였어요! 나쁜 왕비는 멀리멀리 도망가서 다시는 돌아오지 않았답니다.', 'The old woman was really the Queen in disguise! She ran far, far away and never came back.') },
          { speaker: SPK.story, text: T('그때 일을 마친 일곱 난쟁이가 “하이호~” 노래하며 돌아왔어요.', 'Then the seven dwarfs came home from work singing "Heigh-ho!"') },
          { speaker: dw('Happy'), text: T(`${h.subj} 백설공주를 지켜 줬다고? 정말 고마워! 모두 함께 파티하자!`, `${n.en} protected Snow White? Thank you so much! Let's all have a party!`) },
          { speaker: SPK.snow, text: T('네 덕분에 우리 모두 안전해. 너는 최고의 친구야!', "Thanks to you, we're all safe. You're the best friend ever!"), choices: [{ id: 'end-safe', label: T('파티하자! 🎉', 'Party time! 🎉') }] },
        ]);
        setTimeout(() => set({ queenGone: true }), 2600);
        get().dwarfsBack();
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
    set({ talker: name });
    const told = beat(name, s.beats);
    const advance = () => set({ beats: { ...get().beats, [name]: (get().beats[name] ?? 0) + 1 } });
    if (name === 'SnowWhite' && s.metSnowWhite && told) {
      advance();
      s.say(s.swFollow ? told : [...told, { speaker: SPK.snow, text: T('저 끝 오두막까지 같이 가 줄래?', 'Will you walk with me to the cottage at the end of the path?'),
        choices: [{ id: 'sw-go', label: T('같이 가자!', "Let's go!") }, { id: 'sw-flower', label: T('꽃 따서 주기 🌸 (미니게임)', 'Pick flowers for her 🌸 (mini-game)') }] }]);
      return;
    }
    if (name === 'SnowWhiteHome' && told) { advance(); s.say(told); return; }
    if (name === 'SnowWhite') {
      set({ metSnowWhite: true });
      s.say([
        { speaker: SPK.snow, text: T('안녕! 나는 백설공주야. 너는 누구니?', "Hi! I'm Snow White. Who are you?") },
        { speaker: n, text: T(`나는 ${n.ko}! ${h.age}살이야! 왜 숲속에 혼자 있어?`, `I'm ${n.en}! I'm ${h.age} years old! Why are you all alone in the forest?`) },
        { speaker: SPK.snow, text: T('무서운 왕비님이 나를 숲으로 보냈어. 착한 사냥꾼 아저씨 덕분에 도망칠 수 있었지.', 'The wicked Queen sent me away into the forest. A kind huntsman helped me escape.') },
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
        set({ talked: { ...get().talked, sat: true }, talker: 'Sleepy' });
        s.say([
          { speaker: dw('Sleepy'), text: T('하아암… 의자 편하지? 우리가 직접 만든 거야.', 'Yaaawn… comfy chair, right? We made it ourselves.') },
        ]);
      }
      return;
    }
    if (name === 'Apple') {
      if (s.apple !== 'table') return;
      sfx('pickup');
      set({ apple: 'held', sitting: null });
      s.say([
        { speaker: n, text: T('이 사과… 아까 왕비가 말한 그 빨간 사과 같아! 내가 치워야겠다!', "This apple… it looks just like the red apple the Queen talked about! I'd better take it away!") },
        { speaker: SPK.snow, text: T('어? 그 사과 나 주려던 거 아니야?', "Huh? Wasn't that apple for me?"), choices: [{ id: 'refuse', label: T('먹으면 안 돼! 🙅', "Don't eat it! 🙅") }] },
      ]);
      return;
    }
    if (name === 'OldWoman') {
      s.say(s.apple === 'hidden' ? [
        { speaker: SPK.oldWoman, text: T('헤헤… 난 그냥 지나가던 할머니란다. 백설공주는 집에 있니~?', 'Heh heh… I\'m just a little old lady passing by. Is Snow White at home~?') },
        { speaker: SPK.story, text: T('쉿! 사실 이 할머니는 마법으로 변장한 왕비예요. 백설공주를 잘 지켜 줘요!', 'Shh! This old woman is really the Queen in disguise. Keep an eye on Snow White!') },
      ] : [{ speaker: SPK.oldWoman, text: T('흥! 저리 비켜라, 꼬마야!', 'Hmph! Out of my way, child!') }]);
      return;
    }
    if (name === 'Queen') { advance(); s.say(told!); return; }
    const d = DWARFS.find((d) => d.node === name);
    if (d && s.scene === 'cottage' && !s.talked['welcome']) {
      // first chat inside the cottage = the dwarfs' welcome (Doc speaks for everyone)
      set({ talked: { ...s.talked, welcome: true, [name]: true }, talker: name, hint: null });
      s.say([
        { speaker: name === 'Doc' ? d.name : dw('Doc'), text: T('오호! 손님이 왔구나! 일곱 난쟁이의 집에 온 걸 환영해!', 'Oho! We have a guest! Welcome to the home of the seven dwarfs!') },
        { speaker: SPK.snow, text: T('난쟁이들아, 나를 여기서 지내게 해 줄래? 청소도 하고 요리도 할게!', 'Dear dwarfs, may I stay here with you? I\'ll clean and cook for you!') },
        { speaker: dw('Doc'), text: T('물론이지! 대신 약속해. 우리가 광산에 일하러 간 동안 모르는 사람에게는 절대 문을 열어 주면 안 돼!', 'Of course! But promise us: while we\'re away at the mine, never open the door to a stranger!') },
        { speaker: SPK.snow, text: T('약속할게! 자, 의자에 앉아서 쉬자. 난쟁이들한테 말을 걸면 재미있는 이야기를 들려줄 거야.', "I promise! Now let's sit and rest. Talk to the dwarfs — they have stories to tell.") },
        ...(s.seek === 'off' ? [SEEK_ASK(h.call, n.en)] : []),
      ]);
      return;
    }
    if (d) {
      const first = !s.talked[name];
      set({ talked: { ...s.talked, [name]: true } });
      const intro: Line[] = first ? [{ speaker: d.name, text: d.line }] : [];
      if (told) advance();
      const story: Line[] = (!first || name === 'Doc') && told ? told : [];
      if (name === 'Grumpy') s.say([...intro, ...story, { speaker: d.name, text: T('심심한데… 나랑 가위바위보 할래? 3판 2선승이야!', "I'm bored… want to play rock-paper-scissors? Best of three!"),
        choices: [{ id: 'rps', label: T('가위바위보! ✌️', 'Rock-paper-scissors! ✌️') }, { id: 'no', label: T('다음에!', 'Maybe later!') }] }]);
      else if (name === 'Doc' && s.seek === 'off') s.say([...intro, SEEK_ASK(h.call, n.en)]);
      else if (name === 'Doc') s.say([...intro, ...story, { speaker: d.name, text: T('선반에서 사과가 우르르 떨어진대! 피하기 놀이 해 볼래?', 'Apples keep tumbling off the shelf! Want to play the dodge game?'),
        choices: [{ id: 'dodge', label: T('사과 피하기! 🍎', 'Dodge the apples! 🍎') }, { id: 'no', label: T('다음에!', 'Maybe later!') }] }]);
      else s.say([...intro, ...(told ? told : [])]);
    }
  },
  standUp: () => set({ sitting: null }),
  dwarfsLeave: () => {
    const h = HEROES[get().hero]; const n = h.name;
    set({ dwarfs: 'leaving', doorOpen: true, talker: 'Doc', hint: null, sitting: null });
    get().say([
      { speaker: dw('Doc'), text: T('이런, 벌써 일하러 갈 시간이야! 모두 광산으로 출발! 하이호~ 하이호~', "Oh my, it's time to go to work! Everyone, off to the mine! Heigh-ho, heigh-ho~") },
      { speaker: dw('Grumpy'), text: T(`${h.call}, 우리가 없는 동안 백설공주를 잘 지켜 줘. 모르는 사람은 절대 들이면 안 돼!`, `${n.en}, look after Snow White while we're gone. Don't let any strangers in!`) },
      { speaker: n, text: T('걱정 마! 내가 백설공주를 꼭 지킬게!', "Don't worry! I'll keep Snow White safe!") },
      { speaker: SPK.story, text: T('난쟁이들은 광산으로 일하러 떠났어요. 오두막에는 백설공주와 우리만 남았어요…', 'The dwarfs went off to work at the mine. Only Snow White and you were left in the cottage…') },
    ]);
  },
  oldWomanArrives: () => {
    const h = HEROES[get().hero]; const n = h.name;
    sfx('doorOpen');
    set({ talker: 'OldWoman', apple: 'table', sitting: null, hint: T('수상한 사과! 백설공주를 도와줘!', 'A suspicious apple! Help Snow White!') });
    get().say([
      { speaker: SPK.oldWoman, text: T('똑똑~ 착한 아가씨들, 이 할머니가 아주 맛있는 사과를 가져왔단다~', 'Knock knock~ my dears, this old granny has brought you a very tasty apple~') },
      { speaker: SPK.oldWoman, text: T('세상에서 제일 달콤한 빨간 사과야. 식탁 위에 둘 테니 백설공주가 꼭 한 입 먹어 보렴~ 흐흐…', 'It\'s the sweetest red apple in the world. I\'ll leave it on the table — Snow White, do take a bite~ heh heh…') },
      { speaker: SPK.snow, text: T('와, 반짝반짝 정말 맛있어 보인다… 한 입만 먹어 볼까?', 'Wow, it looks so shiny and delicious… shall I take just one bite?') },
      { speaker: SPK.story, text: T(`${h.subj} 백설공주를 도와줄 차례예요! 어떻게 할까요?`, `It's ${n.en}'s turn to help Snow White! What will you do?`),
        choices: [{ id: 'refuse', label: T('먹지 마! 그 사과 수상해 🙅', "Don't eat it! That apple is suspicious 🙅") }, { id: 'eat', label: T('(조용히 지켜본다…)', '(Just watch quietly…)') }] },
    ]);
  },
  dwarfsBack: () => set({ dwarfs: 'returning' }),
  tap: () => {
    const s = get();
    if (!s.sleeping || s.lines.length) return;
    const taps = s.taps + 1;
    sfx('tap');
    if (taps >= 5) {
      const h = HEROES[s.hero]; const n = h.name;
      sfx('wake');
      set({ sleeping: false, taps, queenGone: true, talker: 'SnowWhiteHome' });
      s.say([
        { speaker: SPK.snow, text: T('하암… 내가 잠들었었니? 어? 다들 왜 그렇게 쳐다봐?', 'Yawn… was I asleep? Huh? Why is everyone staring at me?') },
        { speaker: dw('Doc'), text: T(`만세! 백설공주가 깨어났다! ${h.call}, 네가 도와준 덕분이야!`, `Hooray! Snow White is awake! ${n.en}, it's all thanks to your help!`) },
        { speaker: SPK.snow, text: T(`고마워, ${h.call}! 다음엔 모르는 사람이 주는 사과는 절대 먹지 않을게. 약속!`, `Thank you, ${n.en}! I'll never eat an apple from a stranger again. Promise!`), choices: [{ id: 'end-woke', label: T('약속! 🤙', 'Promise! 🤙') }] },
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
  (window as unknown as { __snow: unknown }).__snow = { useGame, player, npcPos };
}
