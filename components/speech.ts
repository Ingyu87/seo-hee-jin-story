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

function pickVoice(lang: 'ko' | 'en') {
  const want = lang === 'ko' ? /^ko/i : /^en/i;
  const list = voices.filter((v) => want.test(v.lang));
  // prefer friendlier / higher-quality voices when present
  const pref = lang === 'ko' ? /(Yuna|Sora|Google 한국|Heami|SunHi|Female)/i : /(Samantha|Google US English|Aria|Jenny|Female|Karen|Moira)/i;
  return list.find((v) => pref.test(v.name)) || list.find((v) => (lang === 'en' ? /en[-_]US/i : /ko[-_]KR/i).test(v.lang)) || list[0] || null;
}

export function stopSpeech() { synth()?.cancel(); }

/** Speak one line (cancels whatever was being read). `kind` tweaks pitch so characters sound a bit different. */
export function speak(text: string, lang: 'ko' | 'en', kind: 'narrator' | 'child' | 'princess' | 'dwarf' | 'queen' = 'narrator') {
  const s = synth(); if (!s) return;
  s.cancel();
  // strip emoji / stage-direction brackets that read badly
  const clean = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{FE0F}]/gu, '').replace(/[“”"]/g, '').trim();
  if (!clean) return;
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = lang === 'ko' ? 'ko-KR' : 'en-US';
  const v = pickVoice(lang); if (v) u.voice = v;
  u.rate = lang === 'ko' ? 0.95 : 0.92;
  u.pitch = { narrator: 1.0, child: 1.45, princess: 1.25, dwarf: 0.8, queen: 0.7 }[kind];
  u.volume = 1;
  s.speak(u);
}

/** iOS Safari only lets speech start from a user gesture: call once from the first tap. */
export function unlockSpeech() {
  const s = synth(); if (!s) return;
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; s.speak(u); } catch {}
}
