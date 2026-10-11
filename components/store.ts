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
  { node: 'Doc', name: T('박사', 'Doc'), line: T("어서 와! 나는 박사란다. 우리 일곱 난쟁이 집에 잘 왔어!", "Hello there! I'm Doc. Welcome to the seven dwarfs' house!") },
  { node: 'Grumpy', name: T('투덜이', 'Grumpy'), line: T("흥, 신발 흙은 털고 들어왔지? …뭐, 반갑긴 하다.", "Hmph. You wiped your feet, right? …Well. Nice to see you, I guess.") },
  { node: 'Happy', name: T('행복이', 'Happy'), line: T("헤헤, 안녕! 오늘 진짜 신나는 날이다!", "Hee hee, hi there! Today is the best day ever!") },
  { node: 'Sleepy', name: T('졸림이', 'Sleepy'), line: T("하아암… 졸려… 여기 의자에 앉아서 같이 쉴래?", "Yaaawn… so sleepy… wanna sit and rest with me?") },
  { node: 'Bashful', name: T('수줍이', 'Bashful'), line: T("어, 어… 안녕… 와 줘서 고마워…", "Oh! Um… hi… thanks for coming…") },
  { node: 'Sneezy', name: T('재채기', 'Sneezy'), line: T("에… 에… 에취! 미안, 꽃가루 때문에 코가 간질간질해!", "Ah… ah… ACHOO! Sorry, the pollen makes my nose tickle!") },
  { node: 'Dopey', name: T('덤벙이', 'Dopey'), line: T('(손을 흔들며 활짝 웃는다)', '(waves and gives a big smile)') },
];
const dw = (node: string) => DWARFS.find((d) => d.node === node)!.name;
/** Doc asks the player for help: three dwarfs went to play hide-and-seek in the forest and haven't come back. */
export const SEEK_ASK = (call: string, en: string): Line => ({ speaker: dw('Doc'), text: T(`그런데 ${call}, 큰일 났어! 덤벙이랑 수줍이, 재채기가 숲에서 숨바꼭질하다가 아직 안 왔어. 우리 대신 좀 찾아 줄래?`, `Oh dear, ${en}, we have a problem! Dopey, Bashful and Sneezy were playing hide-and-seek in the forest, and they're not back yet. Could you go find them for us?`),
  choices: [{ id: 'seek-help', label: T('도와줄게! 🔍', "I'll help! 🔍") }, { id: 'no', label: T('나중에', 'Later') }] });

export const HIDDEN = ['Dopey', 'Bashful', 'Sneezy'];
/** Forest: where the player hides behind the big oak (Tree3) while the Queen talks to her mirror. */
export const HIDE_AT: [number, number] = [2.8, 4.7];
export const SW_HIDE_AT: [number, number] = [3.45, 5.55];


/**
 * The Snow White story, told beat-by-beat by the characters. Each time you talk to someone (tap them or
 * press the action button / E nearby) they tell the next part, so kids learn the fairy tale as they play.
 */
const BEATS: Record<string, Line[][]> = {
  SnowWhite: [ // used after the first meeting, while walking to the cottage
    [{ speaker: SPK.snow, text: T("우리 아빠는 임금님이야. 엄마가 하늘나라에 가시고 나서, 새 왕비님이 우리 성에 오셨어.", "My papa is the King. After my mama went to heaven, a new Queen came to live in our castle.") },
     { speaker: SPK.snow, text: T("새 왕비님한테는 말하는 마법 거울이 있어. 날마다 “누가 제일 예쁘니?” 하고 물어본대.", "The new Queen has a magic mirror that can talk. Every day she asks it, \"Who is the fairest of them all?\"") }],
    [{ speaker: SPK.snow, text: T("그런데 어느 날, 거울이 “백설공주가 제일 예뻐요.” 하고 말한 거야. 왕비님은 얼굴이 빨개질 만큼 화가 났어.", "But one day the mirror said, \"Snow White is the fairest.\" The Queen got so angry her face turned red!") },
     { speaker: SPK.snow, text: T("왕비님은 사냥꾼 아저씨한테 나를 깊은 숲에 두고 오라고 했어. 그런데 마음씨 착한 아저씨가 “공주님, 어서 도망가세요!” 하고 보내 줬어.", "She told a huntsman to leave me deep in the forest. But he was kind. He whispered, \"Run, Princess, run!\" and let me go.") }],
    [{ speaker: SPK.snow, text: T("숲이 깜깜해서 엉엉 울었는데… 토끼랑 새랑 다람쥐가 와서 날 달래 줬어.", "The forest was so dark, I cried and cried… then bunnies, birds and squirrels came to cheer me up.") },
     { speaker: SPK.snow, text: T("동물 친구들이 그러는데, 이 길 끝에 조그만 오두막이 있대. 우리 같이 가 보자!", "They told me there's a teeny-tiny cottage at the end of this path. Let's go together!") }],
  ],
  SnowWhiteHome: [
    [{ speaker: SPK.snow, text: T("난쟁이들이 여기서 같이 살자고 했어! 나는 청소도 하고, 맛있는 수프도 끓여 줄 거야.", "The dwarfs said I can live here with them! I'm going to tidy up and make them yummy soup.") }],
    [{ speaker: SPK.snow, text: T("난쟁이들이 꼭 약속하래. “우리 없을 때 모르는 사람한테 문 열어 주면 안 돼!”", "The dwarfs made me promise: \"When we're out, don't open the door to strangers!\"") },
     { speaker: SPK.snow, text: T("왕비님이 나 여기 있는 거 알면 어떡하지…? 너도 꼭 조심해!", "What if the Queen finds out I'm here…? You be careful too, okay?") }],
  ],
  Queen: [
    [{ speaker: SPK.queen, text: T('거울아 거울아, 이 세상에서 누가 제일 예쁘니?', 'Mirror, mirror on the wall, who is the fairest of them all?') },
     { speaker: T('마법 거울', 'Magic Mirror'), text: T("왕비님도 아름답지요… 하지만 일곱 난쟁이 오두막으로 가고 있는 백설공주가 훨씬 더 아름답답니다.", "You are lovely, my Queen… but Snow White, on her way to the seven dwarfs' cottage, is lovelier still.") },
     { speaker: SPK.queen, text: T("뭐, 뭐라고?! 사냥꾼이 날 속였구나! 가만두지 않겠어!", "Wh-what?! That huntsman tricked me! I won't let her get away!") },
     { speaker: SPK.queen, text: T("흐흐흐… 좋은 수가 있지. 꼬부랑 할머니로 변신해서, 한 입만 먹어도 깊이 잠드는 빨간 독 사과를 갖다주는 거야!", "Heh heh heh… I know! I'll turn into a little old granny and bring her a shiny red apple. One bite, and she'll fall fast asleep!") },
     { speaker: SPK.story, text: T("펑! 왕비는 연기처럼 사라졌어요. 나무 뒤에 숨어 있던 우리는 무서운 계획을 전부 들어 버렸어요.", "POOF! The Queen vanished like smoke. Hiding behind the tree, we heard her whole sneaky plan.") }],
  ],
  Doc: [
    [{ speaker: T('박사', 'Doc'), text: T("나는 박사! 우리는 날마다 광산에 가서 반짝반짝 보석을 캔단다. 하이호~ 하이호~", "I'm Doc! Every day we go to the mine and dig up sparkly jewels. Heigh-ho, heigh-ho~") }],
    [{ speaker: T('박사', 'Doc'), text: T("그날 일 끝나고 왔더니, 글쎄 집이 반짝반짝하고 우리 침대에서 백설공주가 쿨쿨 자고 있지 뭐야!", "One day we came home and — guess what? The house was sparkling clean, and Snow White was snoozing in our beds!") }],
  ],
  Grumpy: [[{ speaker: T('투덜이', 'Grumpy'), text: T("흥, 난 처음에 공주가 같이 사는 거 별로였어. …근데 공주가 끓인 수프는, 음, 꽤 맛있더라.", "Hmph. At first I didn't want a princess living here. …But her soup is, um… pretty tasty.") }]],
  Happy: [[{ speaker: T('행복이', 'Happy'), text: T("우린 밤마다 백설공주랑 노래하고 춤춰! 랄랄라~ 이렇게 신나는 건 처음이야!", "Every night we sing and dance with Snow White! La-la-la~ It's never been this much fun!") }]],
  Sleepy: [[{ speaker: T('졸림이', 'Sleepy'), text: T("하아암… 공주님이 내 침대에서 자서, 난 의자에서 잤어… 그래도 괜찮아…", "Yaaawn… the princess slept in my bed, so I slept in a chair… that's okay…") }]],
  Bashful: [[{ speaker: T('수줍이', 'Bashful'), text: T("배, 백설공주님은 정말 다정해… 밥 먹기 전에 손 씻는 것도 알려 줬어… 헤헤.", "S-Snow White is really nice… she showed us how to wash our hands before dinner… hehe.") }]],
  Sneezy: [[{ speaker: T('재채기', 'Sneezy'), text: T("에취! 우리가 광산에 가면 공주님 혼자 있거든. 모르는 사람이 오면 문 열어 주면 안 돼! 에… 에취!", "ACHOO! When we're at the mine, the princess is all alone. If a stranger knocks, don't open the door! Ah… ACHOO!") }]],
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
  if (player.jumpY > 0.001 || g.sleeping || g.lines.length || g.cutscene) return false;
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
  story: string;
  found: string[];
  /** story cut-scene in progress: player input is ignored, scripted walking (target) still works */
  cutscene: boolean;
  /** big centred story caption (e.g. "the dwarfs leave for the mine"), auto-hides */
  card: Tx | null;
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
  showCard: (t: Tx, ms?: number) => void;
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
  metSnowWhite: false, queenGone: false, seek: 'off' as 'off' | 'on' | 'done', talked: {}, beats: {} as Record<string, number>, talker: null as string | null, running: false, found: [] as string[], cutscene: false, card: null as Tx | null,
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;
let cardTimer: ReturnType<typeof setTimeout> | undefined;

export const useGame = create<State>((set, get) => ({
  scene: 'stories',
  hero: 'seohui',
  lang: initialLang,
  muted: initialMuted,
  voice: LS?.getItem('shj-voice') !== '0',
  guideOpen: false,
  story: 'snow-white',
  spawnKey: 0,
  ...fresh,

  setHero: (h) => { sfx('click'); set({ hero: h }); },
  setLang: (lang) => { LS?.setItem('shj-lang', lang); set({ lang }); if (typeof document !== 'undefined') document.documentElement.lang = lang; },
  toggleMute: () => { const muted = !get().muted; LS?.setItem('shj-muted', muted ? '1' : '0'); audioSetMuted(muted); set({ muted }); },
  toggleVoice: () => { const voice = !get().voice; LS?.setItem('shj-voice', voice ? '1' : '0'); set({ voice }); },
  setGuide: (guideOpen) => set({ guideOpen }),
  showCard: (card, ms = 2600) => {
    set({ card });
    if (cardTimer) clearTimeout(cardTimer);
    cardTimer = setTimeout(() => set({ card: null }), ms);
  },
  findHidden: (name) => {
    const g = get();
    if (g.found.includes(name) || g.lines.length) return;
    const found = [...g.found, name];
    sfx('sparkle');
    set({ found, talker: name });
    const d = DWARFS.find((x) => x.node === name)!;
    g.flash(T(`찾았다! ${d.name.ko} (${found.length}/${HIDDEN.length})`, `Found ${d.name.en}! (${found.length}/${HIDDEN.length})`));
    if (found.length === HIDDEN.length) {
      set({ seek: 'done' });
      g.say([{ speaker: d.name, text: T("으앗, 들켰다! 네가 이겼어! 박사가 걱정하겠다. 얼른 집에 가자!", "Eek, you found us! You win! Doc must be worried — let's hurry home!") },
        { speaker: SPK.story, text: T("해냈어요! 숨어 있던 난쟁이 셋을 모두 찾았어요. 이제 다 같이 오두막으로 돌아가요!", "You did it! You found all three hiding dwarfs. Now let's all head back to the cottage!"),
          choices: [{ id: 'seek-home', label: T('오두막으로 돌아가기 🏠', 'Back to the cottage 🏠') }] }]);
    } else g.say([{ speaker: d.name, text: T("앗, 들켰다! 박사가 찾는다고? 알았어, 먼저 집에 가 있을게. 다른 애들도 이 숲 어딘가에 숨어 있어!", "Oops, you found me! Doc's looking for us? Okay, I'll head home first. The others are still hiding somewhere around here!") }]);
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
      set({ hint: T('🔍 숨은 난쟁이 3명을 찾아라! 흔들리는 덤불, 삐죽 나온 모자, “에취!” 소리를 찾아봐.', '🔍 Find the 3 hidden dwarfs! Look for wiggling bushes, a peeking hat or an "ACHOO!"') });
      get().say([
        { speaker: SPK.story, text: T(`${h.subj} 난쟁이들을 찾으러 다시 숲에 왔어요. 그때, 어디선가 “에… 에취!” 소리가 들려요!`, `${n.en} went back into the forest to find the dwarfs. Just then, from somewhere: "Ah… ah… ACHOO!"`) },
        { speaker: n, text: T("어? 재채기 소리다! 나무 뒤에 숨었나 봐. 내가 찾아낼 거야!", "Huh? A sneeze! Someone's hiding behind a tree. I'm gonna find them!") },
        { speaker: SPK.story, text: T("숨은 난쟁이 세 명을 찾아 볼까요? 덤불 위로 삐죽 나온 모자나 “에취!” 소리 나는 곳으로 가까이 가서, 🔍 찾았다! 버튼을 눌러요. 컴퓨터는 E 키예요.", "Let's find the three hiding dwarfs! Walk up to a peeking hat or an \"ACHOO!\" sound, then press 🔍 Found you! On a computer, press E.") },
      ]);
    } else if (s === 'forest') {
      set({ hint: T('숲길을 따라 걸어가 보자! 폰은 조이스틱, 컴퓨터는 방향키로 걸어요.', 'Follow the forest path! Use the joystick (phone) or arrow keys (computer).') });
      get().say([
        { speaker: SPK.story, text: T("옛날 옛날에, 눈처럼 하얀 얼굴을 가진 예쁜 공주님이 살았어요. 이름은 백설공주였답니다.", "Once upon a time, there lived a lovely princess with skin as white as snow. Her name was Snow White.") },
        { speaker: SPK.story, text: T("그런데 마법 거울이 “백설공주가 제일 예뻐요.” 하고 말하자, 샘이 난 새 왕비는 공주를 깊은 숲으로 쫓아 버렸어요.", "But when the magic mirror said, \"Snow White is the fairest,\" the jealous Queen sent her far away into the deep, dark forest.") },
        { speaker: SPK.story, text: T(`그리고 바로 그 숲으로, ${HEROES[get().hero].subj} 퐁! 하고 동화 속에 들어왔어요!`, `And into that very forest — pop! — ${n.en} jumped right into the story!`) },
        { speaker: n, text: T("우와, 여기가 백설공주 숲이구나! 어? 저기 누가 있어! 가서 인사해 볼까?", "Wow, so this is Snow White's forest! Oh? Someone's over there! Should I go say hi?") },
      ]);
    }
    if (s === 'cottage') {
      set({ hint: T('오두막 문 앞으로 가서 🚪 버튼을 눌러 열어 봐! (컴퓨터: E)', 'Walk to the cottage door and press 🚪 to open it! (computer: E)'), doorOpen: false });
      if (get().seek === 'done' && !get().talked['seekThanks']) {
        set({ talked: { ...get().talked, seekThanks: true }, talker: 'Doc' });
        get().say([{ speaker: dw('Doc'), text: T(`${HEROES[get().hero].call}, 덤벙이랑 수줍이, 재채기까지 다 찾아 줘서 정말 고마워! 이제 일곱 명 다 모였다. 어서 들어와!`, `${n.en}, thank you so much for finding Dopey, Bashful and Sneezy! All seven of us are home now. Come on in!`) }]);
      } else get().say([{ speaker: SPK.snow, text: T("여기가 일곱 난쟁이네 오두막이야! 문 열고 살짝 들어가 볼까?", "This is the seven dwarfs' cottage! Shall we open the door and peek inside?") }]);
    }
    if (s === 'ending') {
      sfx('fanfare');
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
      case 'sw-meet': // agreed to walk with her → but first, someone is coming… hide!
        set({ talker: 'SnowWhite' });
        get().say([
          { speaker: SPK.snow, text: T("고마워! 어… 잠깐, 쉿! 저기 누가 와!", "Thank you! Oh— wait. Shh! Someone's coming!") },
          { speaker: n, text: T("왕비다! 빨리, 저 큰 나무 뒤에 숨자!", "It's the Queen! Quick, behind that big tree!"),
            choices: [{ id: 'hide', label: T('나무 뒤에 숨기 🌳', 'Hide behind the tree 🌳') }] },
        ]);
        break;
      case 'hide': // cut-scene: both tiptoe behind the tree, then the Queen steps onto the path (ForestScene directs it)
        set({ talked: { ...get().talked, hide: true }, cutscene: true, hint: null, target: [HIDE_AT[0], HIDE_AT[1]], pending: null, sitting: null });
        break;
      case 'sw-go': // after the Queen's scene: the run-escort to the cottage
        set({ swFollow: true, cutscene: true, target: [0.9 * Math.sin(-3.6 * 0.11), 3.6], pending: null, talker: 'SnowWhite', hint: T('🏃 저절로 앞으로 달려요! ◀ ▶ 로 가시덤불·바위를 피하고, ⤴️ 점프로 넘어도 돼요!', '🏃 You run forward by yourself! Steer ◀ ▶ around thorns and rocks, or ⤴️ jump over them!') });
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
          { speaker: SPK.story, text: T("백설공주가 사과를 아삭 한 입 베어 물자… 스르르, 깊은 잠에 빠지고 말았어요.", "Snow White took one crunchy bite… and slowly, slowly fell into a deep sleep.") },
          { speaker: SPK.oldWoman, text: T("흐흐흐! 이제 내가 세상에서 제일 예쁘다! (펑! 하고 사라졌다)", "Heh heh heh! Now I'm the fairest of them all! (vanishes with a POOF!)") },
          { speaker: SPK.story, text: T("바로 그때, 일곱 난쟁이가 “하이호~ 하이호~” 노래를 부르며 집에 돌아왔어요.", "Just then, the seven dwarfs came home, singing \"Heigh-ho, heigh-ho~\"") },
          { speaker: dw('Doc'), text: T(`저런, 백설공주가 잠들어 버렸어! ${h.call}, 우리 같이 깨워 보자! 화면을 톡톡 두드려 줘!`, `Oh no, Snow White is fast asleep! ${n.en}, let's wake her up together! Tap tap on the screen!`) },
        ]);
        set({ queenGone: true });
        get().dwarfsBack();
        break;
      case 'refuse': // the player warns Snow White / takes the apple away
        set({ apple: 'refused', hint: null, talker: 'SnowWhiteHome' });
        setTimeout(() => sfx('poof'), 2600);
        get().say([
          { speaker: n, text: T("안 돼, 먹지 마! 난쟁이들이 모르는 사람이 주는 건 받지 말랬잖아!", "No, don't eat it! The dwarfs said not to take things from strangers!") },
          { speaker: SPK.snow, text: T(`아, 맞다! 알려 줘서 고마워, ${h.call}. 큰일 날 뻔했네!`, `Oh, you're right! Thank you, ${n.en}. That was a close one!`) },
          { speaker: SPK.oldWoman, text: T("으으윽… 저 꼬마 때문에 다 들켰잖아! (펑! 하고 사라졌다)", "Grrr… that little kid ruined everything! (vanishes with a POOF!)") },
          { speaker: SPK.story, text: T("그 할머니는 사실 변장한 왕비였어요! 왕비는 멀리멀리 도망가서, 다시는 돌아오지 않았답니다.", "That old woman was really the Queen in disguise! She ran far, far away and never came back.") },
          { speaker: SPK.story, text: T("그때, 일곱 난쟁이가 “하이호~ 하이호~” 노래를 부르며 집에 돌아왔어요.", "Then the seven dwarfs came home, singing \"Heigh-ho, heigh-ho~\"") },
          { speaker: dw('Happy'), text: T(`와아, ${h.subj} 백설공주를 지켜 줬다고? 고마워! 우리 다 같이 파티하자!`, `Whoa, ${n.en} saved Snow White? Thank you! Let's all have a party!`) },
          { speaker: SPK.snow, text: T("네 덕분에 우리 모두 무사해. 넌 정말 최고의 친구야!", "Thanks to you, we're all safe. You're the best friend ever!"), choices: [{ id: 'end-safe', label: T('파티하자! 🎉', 'Party time! 🎉') }] },
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
    if (get().sleeping || get().lines.length || get().cutscene) return;
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
    if (s.sleeping || s.lines.length) return;
    set({ talker: name });
    const told = beat(name, s.beats);
    const advance = () => set({ beats: { ...get().beats, [name]: (get().beats[name] ?? 0) + 1 } });
    if (name === 'SnowWhiteHome' && told) { advance(); s.say(told); return; }
    if (name === 'SnowWhite') {
      // First meeting once; later talks only advance story beats — never restart the intro.
      if (s.metSnowWhite) {
        if (s.talked['hide'] && !s.swFollow) return; // hiding from the Queen: shh!
        if (!s.talked['hide']) { s.say([{ speaker: SPK.snow, text: T("저 끝에 있는 오두막까지 나랑 같이 가 줄래?", "Will you walk with me to the cottage at the end of the path?"),
          choices: [{ id: 'sw-meet', label: T('같이 가자!', "Let's go!") }] }]); return; }
        if (told) { advance(); s.say(told); }
        return;
      }
      set({ metSnowWhite: true });
      s.say([
        { speaker: SPK.snow, text: T("어머, 안녕! 나는 백설공주야. 넌 이름이 뭐야?", "Oh, hello! I'm Snow White. What's your name?") },
        { speaker: n, text: T(`나는 ${n.ko}! ${h.age}살이야. 근데 왜 숲에 혼자 있어?`, `I'm ${n.en}! I'm ${h.age}. Why are you all alone out here?`) },
        { speaker: SPK.snow, text: T("무서운 왕비님이 날 숲으로 쫓아냈어… 착한 사냥꾼 아저씨가 도와줘서 겨우 도망쳤어.", "The scary Queen sent me away into the forest… a kind huntsman helped me get away.") },
        { speaker: SPK.snow, text: T(`반가워, ${h.call}! 나 길을 잃었는데… 저 끝 작은 오두막까지 같이 가 줄래?`, `Nice to meet you, ${n.en}! I'm a little lost… will you walk with me to the little cottage down the path?`),
          choices: [{ id: 'sw-meet', label: T('같이 가자!', "Let's go!") }] },
      ]);
      return;
    }
    if (name === 'CottageGate') {
      s.say([{ speaker: SPK.snow, text: T("와, 저기 작은 오두막이 보인다! 들어가 볼까?", "Look, I can see the little cottage! Shall we go in?"), choices: [{ id: 'enter-cottage', label: T('들어가 보자!', "Let's go in!") }] }]);
      return;
    }
    if (name === 'Door') {
      const open = !s.doorOpen;
      sfx(open ? 'doorOpen' : 'doorClose');
      set({ doorOpen: open, hint: open ? T('안으로 들어가 봐! 의자 옆에서 🪑, 난쟁이 옆에서 💬 버튼을 누르면 돼.', 'Go inside! Next to a chair press 🪑, next to a dwarf press 💬.') : T('문을 다시 열려면 문을 눌러 봐.', 'Tap the door to open it again.') });
      get().flash(open ? T('끼이익~ 문이 열렸어!', 'Creeeak~ the door is open!') : T('문을 닫았어.', 'You closed the door.'));
      return;
    }
    if (/^Chair\d$/.test(name)) {
      sfx('sit');
      set({ sitting: name });
      get().flash(T('의자에 앉았어! (움직이면 일어나요)', 'You sat down! (move to stand up)'));
      if (!s.talked['sat']) {
        set({ talked: { ...get().talked, sat: true }, talker: 'Sleepy' });
        s.say([
          { speaker: dw('Sleepy'), text: T("하아암… 의자 폭신하지? 우리가 직접 만든 거야…", "Yaaawn… comfy, right? We made these chairs ourselves…") },
        ]);
      }
      return;
    }
    if (name === 'Apple') {
      if (s.apple !== 'table') return;
      sfx('pickup');
      set({ apple: 'held', sitting: null });
      s.say([
        { speaker: n, text: T("이 사과… 아까 왕비가 말한 그 빨간 사과잖아! 얼른 치워야지!", "This apple… it's the red apple the Queen talked about! I'd better put it away!") },
        { speaker: SPK.snow, text: T("어? 그 사과, 나 먹으라고 준 거 아니야?", "Huh? Wasn't that apple for me?"), choices: [{ id: 'refuse', label: T('먹으면 안 돼! 🙅', "Don't eat it! 🙅") }] },
      ]);
      return;
    }
    if (name === 'OldWoman') {
      s.say(s.apple === 'hidden' ? [
        { speaker: SPK.oldWoman, text: T("헤헤헤… 난 그냥 지나가던 할머니란다~ 혹시 백설공주 집에 있니~?", "Heh heh… I'm just a little old granny passing by~ Is Snow White home, dearie~?") },
        { speaker: SPK.story, text: T("쉿! 사실 이 할머니는 마법으로 변신한 왕비예요. 백설공주를 꼭 지켜 줘요!", "Shh! This old woman is really the Queen in disguise. Keep Snow White safe!") },
      ] : [{ speaker: SPK.oldWoman, text: T('흥! 저리 비켜라, 꼬마야!', 'Hmph! Out of my way, child!') }]);
      return;
    }
    if (name === 'Queen') { advance(); s.say(told!); return; }
    const d = DWARFS.find((d) => d.node === name);
    if (d && s.scene === 'cottage' && !s.talked['welcome']) {
      // first chat inside the cottage = the dwarfs' welcome (Doc speaks for everyone)
      set({ talked: { ...s.talked, welcome: true, [name]: true }, talker: name, hint: null });
      s.say([
        { speaker: name === 'Doc' ? d.name : dw('Doc'), text: T("오호! 손님이 왔네? 일곱 난쟁이 집에 온 걸 환영해!", "Oho! We've got guests! Welcome to the seven dwarfs' house!") },
        { speaker: SPK.snow, text: T("난쟁이 친구들, 나 여기서 같이 지내도 될까? 청소도 하고 맛있는 밥도 할게!", "Dear dwarfs, could I stay here with you? I'll clean and cook yummy food!") },
        { speaker: dw('Doc'), text: T("물론이지! 대신 하나만 약속해. 우리가 광산에 간 동안엔 모르는 사람한테 절대 문 열어 주면 안 돼!", "Of course! Just promise us one thing: while we're at the mine, never open the door to a stranger!") },
        { speaker: SPK.snow, text: T("응, 약속! 자, 우리 의자에 앉아서 좀 쉬자. 난쟁이들한테 말 걸어 봐. 재미있는 얘기 해 줄 거야!", "I promise! Now let's sit down and rest. Go say hi to the dwarfs — they've got fun stories!") },
        ...(s.seek === 'off' ? [SEEK_ASK(h.call, n.en)] : []),
      ]);
      return;
    }
    if (d) {
      const first = !s.talked[name];
      set({ talked: { ...s.talked, [name]: true } });
      const intro: Line[] = first ? [{ speaker: d.name, text: d.line }] : [];
      if (told) advance();
      if (name === 'Doc' && s.seek === 'off') s.say([...intro, SEEK_ASK(h.call, n.en)]);
      else s.say([...intro, ...(told ?? [])]);
    }
  },
  standUp: () => set({ sitting: null }),
  dwarfsLeave: () => {
    const h = HEROES[get().hero]; const n = h.name;
    set({ dwarfs: 'leaving', doorOpen: true, talker: 'Doc', hint: null, sitting: null });
    get().showCard(T('⛏️ 하이호~ 난쟁이들이 광산으로 일하러 가요!', '⛏️ Heigh-ho! The dwarfs are off to work at the mine!'), 3200);
    get().say([
      { speaker: dw('Doc'), text: T("어이쿠, 벌써 일하러 갈 시간이네! 모두 광산으로 출발! 하이호~ 하이호~", "Oh my, it's already time for work! Off to the mine, everyone! Heigh-ho, heigh-ho~") },
      { speaker: dw('Grumpy'), text: T(`${h.call}, 우리 없는 동안 공주 좀 잘 봐 줘. 모르는 사람은 절대 들이지 말고! …알았지?`, `${n.en}, keep an eye on the princess while we're gone. No strangers allowed! …Got it?`) },
      { speaker: n, text: T("걱정 마! 내가 백설공주 꼭 지킬게!", "Don't worry! I'll keep Snow White safe!") },
      { speaker: SPK.story, text: T("난쟁이들은 광산으로 떠났어요. 이제 오두막엔 백설공주랑 우리 둘만 남았어요…", "Off went the dwarfs to the mine. Now it was just you and Snow White in the cottage…") },
    ]);
  },
  oldWomanArrives: () => {
    const h = HEROES[get().hero]; const n = h.name;
    sfx('doorOpen');
    set({ talker: 'OldWoman', apple: 'table', sitting: null, hint: T('수상한 사과! 백설공주를 도와줘!', 'A suspicious apple! Help Snow White!') });
    get().say([
      { speaker: SPK.oldWoman, text: T("똑똑~ 아가씨들, 이 할머니가 아~주 맛있는 사과를 가져왔단다~", "Knock knock~ Hello, dearies! Granny brought you a ve~ry tasty apple~") },
      { speaker: SPK.oldWoman, text: T("세상에서 제일 달콤한 사과란다. 식탁에 놓고 갈 테니, 꼭 한 입 먹어 보렴~ 흐흐흐…", "It's the sweetest apple in the whole world. I'll leave it on the table — do take a bite, dearie~ heh heh heh…") },
      { speaker: SPK.snow, text: T("우와, 반짝반짝 정말 맛있겠다… 딱 한 입만 먹어 볼까?", "Ooh, it's so shiny… it looks delicious. Maybe just one tiny bite?") },
      { speaker: SPK.story, text: T(`이제 ${h.subj} 백설공주를 도와줄 차례예요! 어떻게 할까요?`, `Now it's ${n.en}'s turn to help Snow White! What will you do?`),
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
        { speaker: SPK.snow, text: T("하암… 나 잠들었었어? 어? 다들 왜 나만 쳐다봐?", "Yawn… was I asleep? Huh? Why is everyone looking at me?") },
        { speaker: dw('Doc'), text: T(`만세! 백설공주가 깨어났어! ${h.call}, 다 네 덕분이야!`, `Hooray! Snow White is awake! ${n.en}, it's all thanks to you!`) },
        { speaker: SPK.snow, text: T(`고마워, ${h.call}! 이제 모르는 사람이 주는 건 절대 안 먹을게. 약속!`, `Thank you, ${n.en}! I'll never eat anything from a stranger again. Promise!`), choices: [{ id: 'end-woke', label: T('약속! 🤙', 'Promise! 🤙') }] },
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
