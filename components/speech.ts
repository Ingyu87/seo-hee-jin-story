'use client';
/**
 * Story narration with the browser's built-in Web Speech API (speechSynthesis) — free, offline-capable,
 * no audio files. Lines are read in the selected language (ko-KR / en-US).
 */
let voices: SpeechSynthesisVoice[] = [];
const synth = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);
if (synth()) {
  const load = () => { voices = synth()!.getVoices(); };
  load();
  synth()!.addEventListener?.('voiceschanged', load);
}

type Profile = { pitch: number; rate: number; sex: 'f' | 'm'; alt?: number; prefer?: RegExp };
/**
 * Per-character voices. Most phones only have one or two Korean voices, so the real difference comes from
 * strongly separated pitch / speed. When the device does have character voices (iOS 17+: Grandma, Grandpa,
 * Eddy, Flo, Reed, Sandy, Shelley… / Windows: Heami, SunHi, InJoon / Android Google voices) we pick them by name.
 */
export const VOICES: Record<string, Profile> = {
  narrator: { pitch: 1.0, rate: 0.86, sex: 'f', alt: 1, prefer: /Shelley|Sandy|Yuna|SunHi|Samantha|Moira/i },  // warm, unhurried storyteller
  seohui: { pitch: 1.55, rate: 1.1, sex: 'f', prefer: /Flo|Sora|Heami|Jenny|Karen/i },                       // 8 y/o: bright, quick
  seojin: { pitch: 2.0, rate: 0.9, sex: 'f', alt: 1, prefer: /Flo|Yuna|Ava/i },                                  // 4 y/o: highest, a bit slower
  snow: { pitch: 1.3, rate: 0.93, sex: 'f', alt: 2, prefer: /Shelley|Yuna|SunHi|Samantha/i },                   // gentle princess
  queen: { pitch: 0.35, rate: 0.78, sex: 'f', alt: 3, prefer: /Sandy|Heami|Karen|Moira/i },                   // deep, cold, slow
  oldwoman: { pitch: 0.2, rate: 0.68, sex: 'f', alt: 3, prefer: /Grandma|Sandy/i },                             // creaky, sly granny
  mirror: { pitch: 0.1, rate: 0.66, sex: 'm', prefer: /Grandpa|Reed|InJoon|Daniel/i },                           // very deep, echoey
  Doc: { pitch: 0.8, rate: 0.95, sex: 'm', prefer: /Grandpa|Reed|InJoon|Minsu|Daniel/i },
  Grumpy: { pitch: 0.35, rate: 0.88, sex: 'm', alt: 1, prefer: /Reed|Minsu|InJoon|Fred/i },
  Happy: { pitch: 1.45, rate: 1.25, sex: 'm', alt: 2, prefer: /Eddy|Rocko|Alex/i },
  Sleepy: { pitch: 0.55, rate: 0.6, sex: 'm', alt: 1, prefer: /Grandpa|Reed/i },
  Bashful: { pitch: 1.65, rate: 0.8, sex: 'm', alt: 2, prefer: /Eddy/i },
  Sneezy: { pitch: 1.05, rate: 1.22, sex: 'm', prefer: /Reed|Eddy/i },
  Dopey: { pitch: 1.9, rate: 1.1, sex: 'm', alt: 2, prefer: /Eddy|Rocko/i },
};

const MALE = /(\bmale\b|남성|InJoon|Minsu|Jinho|Daniel|Alex|Fred|Aaron|Guy|David|Mark|Ryan|Tom|Eddy|Reed|Rocko|Grandpa|x-ko[cd]|x-iom|x-iol|x-tpd)/i;
const FEMALE = /(female|여성|Yuna|Sora|Heami|SunHi|Samantha|Aria|Jenny|Karen|Moira|Zira|Ava|Allison|Susan|Flo|Sandy|Shelley|Grandma)/i;
// macOS / iOS joke voices that sound like sound effects, not people
const NOVELTY = /Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox/i;

/**
 * Give every character its OWN voice when the device has several for the language: characters pick in
 * story-importance order, each taking its preferred named voice if still free, else an unused voice of the
 * right sex, else any unused voice. Only when there are fewer voices than characters do voices get shared
 * (then the pitch / speed differences keep them apart).
 */
const ORDER = ['narrator', 'snow', 'queen', 'seohui', 'seojin', 'oldwoman', 'Doc', 'Grumpy', 'Happy', 'mirror', 'Sleepy', 'Bashful', 'Sneezy', 'Dopey'];
const cast = new Map<string, Map<string, SpeechSynthesisVoice>>();
function castVoices(lang: 'ko' | 'en') {
  const key = `${lang}:${voices.length}`;
  if (cast.has(key)) return cast.get(key)!;
  const want = lang === 'ko' ? /^ko/i : /^en/i;
  let list = voices.filter((v) => want.test(v.lang) && !NOVELTY.test(v.name));
  if (lang === 'en') { const us = list.filter((x) => /en[-_](US|GB)/i.test(x.lang)); if (us.length >= 2) list = us; }
  // de-duplicate identical names (some browsers list a voice twice: local + network)
  const seen = new Set<string>(); list = list.filter((v) => (seen.has(v.name) ? false : (seen.add(v.name), true)));
  const isMale = (x: SpeechSynthesisVoice) => MALE.test(x.name) && !/female/i.test(x.name);
  const m = new Map<string, SpeechSynthesisVoice>();
  const used = new Set<string>();
  for (const who of ORDER) {
    const p = VOICES[who]; if (!list.length) break;
    const free = list.filter((x) => !used.has(x.voiceURI || x.name));
    const pref = p.prefer ? free.filter((x) => p.prefer!.test(x.name)) : [];
    const sexed = free.filter((x) => (p.sex === 'm' ? isMale(x) : !isMale(x)));
    let v = pref[0] || sexed[0] || free[0];
    if (!v) { // everyone already has a voice: share, preferring the right sex / named voice
      const pr = p.prefer ? list.filter((x) => p.prefer!.test(x.name)) : [];
      const sx = list.filter((x) => (p.sex === 'm' ? isMale(x) : !isMale(x)));
      v = pr[0] || (sx.length ? sx[(p.alt ?? 0) % sx.length] : list[(p.alt ?? 0) % list.length]);
    }
    used.add(v.voiceURI || v.name); m.set(who, v);
  }
  cast.set(key, m);
  if (typeof window !== 'undefined') ((window as unknown as { __snow?: Record<string, unknown> }).__snow ??= {}).voiceCast = (l: 'ko' | 'en') => Object.fromEntries([...castVoices(l)].map(([k, v]) => [k, v.name]));
  return m;
}
function pickVoice(lang: 'ko' | 'en', who: string) {
  return castVoices(lang).get(who) ?? castVoices(lang).get('narrator') ?? null;
}
/** How many distinct voices this device offers for the language (1 = pitch/speed only). */
function voiceCount(lang: 'ko' | 'en') { return new Set([...castVoices(lang).values()].map((v) => v.name)).size; }

export function stopSpeech() { synth()?.cancel(); }

/** Speak one line (cancels whatever was being read) in the given character's voice (see VOICES). */
export function speak(text: string, lang: 'ko' | 'en', who: string = 'narrator') {
  const s = synth(); if (!s) return;
  s.cancel();
  // strip emoji / stage-direction brackets that read badly
  const clean = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{FE0F}]/gu, '').replace(/[“”"]/g, '').trim();
  if (!clean) return;
  const p = VOICES[who] ?? VOICES.narrator;
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = lang === 'ko' ? 'ko-KR' : 'en-US';
  const v = pickVoice(lang, who); if (v) { u.voice = v; u.lang = v.lang; }
  u.rate = p.rate * (lang === 'ko' ? 1 : 0.97);
  // character voices (Grandma, Eddy…) already sound distinct: only nudge their pitch
  const natural = !!(v && p.prefer && p.prefer.test(v.name) && /Grandma|Grandpa|Eddy|Flo|Reed|Sandy|Shelley|Rocko/i.test(v.name));
  const many = voiceCount(lang) >= 4;
  const pitch = natural ? 1 + (p.pitch - 1) * 0.5 : many ? 1 + (p.pitch - 1) * 0.75 : p.pitch;
  u.pitch = Math.min(2, Math.max(0, pitch));
  u.volume = 1;
  s.speak(u);
}

/** iOS Safari only lets speech start from a user gesture: call once from the first tap. */
export function unlockSpeech() {
  const s = synth(); if (!s) return;
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; s.speak(u); } catch {}
}
