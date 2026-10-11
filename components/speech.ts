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

type Profile = { pitch: number; rate: number; sex: 'f' | 'm'; alt?: number };
/**
 * Per-character voices: each speaker gets their own pitch / speed and, when the device has several voices
 * for the language, a different voice (female voices for the girls / Snow White / Queen, male ones for the
 * dwarfs and the mirror when available).
 */
export const VOICES: Record<string, Profile> = {
  narrator: { pitch: 1.0, rate: 0.95, sex: 'f', alt: 1 },
  seohui: { pitch: 1.35, rate: 1.02, sex: 'f' },          // 8 y/o: bright, quick
  seojin: { pitch: 1.75, rate: 0.9, sex: 'f' },           // 4 y/o: highest, a little slower
  snow: { pitch: 1.2, rate: 0.95, sex: 'f', alt: 2 },     // gentle princess
  queen: { pitch: 0.7, rate: 0.88, sex: 'f', alt: 3 },    // cold, slow
  oldwoman: { pitch: 0.5, rate: 0.78, sex: 'f', alt: 3 }, // creaky granny
  mirror: { pitch: 0.4, rate: 0.8, sex: 'm' },            // deep, echoey
  Doc: { pitch: 0.85, rate: 0.95, sex: 'm' },
  Grumpy: { pitch: 0.6, rate: 0.9, sex: 'm', alt: 1 },
  Happy: { pitch: 1.2, rate: 1.12, sex: 'm', alt: 2 },
  Sleepy: { pitch: 0.75, rate: 0.72, sex: 'm', alt: 1 },
  Bashful: { pitch: 1.1, rate: 0.85, sex: 'm', alt: 2 },
  Sneezy: { pitch: 0.95, rate: 1.05, sex: 'm' },
  Dopey: { pitch: 1.4, rate: 1.0, sex: 'm', alt: 2 },
};

const MALE = /(\bmale\b|남성|InJoon|Minsu|Jinho|Daniel|Alex|Fred|Aaron|Guy|David|Mark|Ryan|Tom|x-ko[cd]|x-iom|x-iol|x-tpd)/i;
const FEMALE = /(female|여성|Yuna|Sora|Heami|SunHi|Samantha|Aria|Jenny|Karen|Moira|Zira|Ava|Allison|Susan)/i;

function pickVoice(lang: 'ko' | 'en', p: Profile) {
  const want = lang === 'ko' ? /^ko/i : /^en/i;
  const list = voices.filter((v) => want.test(v.lang));
  if (!list.length) return null;
  const local = lang === 'en' ? list.filter((v) => /en[-_]US/i.test(v.lang)) : list;
  const pool = local.length ? local : list;
  const male = pool.filter((v) => MALE.test(v.name) && !/female/i.test(v.name));
  const female = pool.filter((v) => FEMALE.test(v.name) || !MALE.test(v.name));
  const set = (p.sex === 'm' ? male : female).length ? (p.sex === 'm' ? male : female) : pool;
  return set[(p.alt ?? 0) % set.length];
}

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
  const v = pickVoice(lang, p); if (v) u.voice = v;
  u.rate = p.rate * (lang === 'ko' ? 1 : 0.97);
  u.pitch = Math.min(2, Math.max(0, p.pitch));
  u.volume = 1;
  s.speak(u);
}

/** iOS Safari only lets speech start from a user gesture: call once from the first tap. */
export function unlockSpeech() {
  const s = synth(); if (!s) return;
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; s.speak(u); } catch {}
}
