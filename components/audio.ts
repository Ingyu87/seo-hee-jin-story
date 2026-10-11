'use client';
/**
 * All sound is synthesized live with the Web Audio API (no audio files, nothing to license).
 * - BGM: a gentle music-box loop (C-major pentatonic melody + soft bass).
 * - SFX: short generated tones/noise for walk, talk, door, sit, apple, UI click, etc.
 * Audio starts on the first user tap (browser autoplay rules) and respects the mute toggle.
 */
export type Sfx = 'click' | 'step' | 'talk' | 'doorOpen' | 'doorClose' | 'sit' | 'pickup' | 'crunch' | 'sleep' | 'tap' | 'wake' | 'sparkle' | 'poof' | 'fanfare' | 'jump';

let ctx: AudioContext | null = null;
let master: GainNode, music: GainNode, fx: GainNode;
let muted = typeof window !== 'undefined' && window.localStorage?.getItem('shj-muted') === '1';
let bgmTimer: ReturnType<typeof setInterval> | undefined;
let noiseBuf: AudioBuffer | null = null;

function ensure() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
    music = ctx.createGain(); music.gain.value = 0.16; music.connect(master);
    fx = ctx.createGain(); fx.gain.value = 0.55; fx.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return ctx;
}

/** Call from a user gesture: unlocks audio and starts the background music. */
export function unlockAudio() {
  const c = ensure(); if (!c) return;
  if (c.state === 'suspended') c.resume();
  if (!bgmTimer) startBgm();
}

export function setMuted(m: boolean) {
  muted = m;
  const c = ensure(); if (!c) return;
  master.gain.cancelScheduledValues(c.currentTime);
  master.gain.setTargetAtTime(m ? 0 : 0.9, c.currentTime, 0.05);
  if (!m) unlockAudio();
}

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

function tone(freq: number, t: number, dur: number, { type = 'sine' as OscillatorType, vol = 0.5, to = 0, attack = 0.005, out = fx as AudioNode } = {}) {
  const c = ctx!; const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
}

function noise(t: number, dur: number, { vol = 0.4, freq = 1200, q = 1, type = 'bandpass' as BiquadFilterType, to = 0 } = {}) {
  const c = ctx!; const s = c.createBufferSource(); s.buffer = noiseBuf;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(fx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

let stepAlt = false;
export function sfx(name: Sfx) {
  const c = ensure(); if (!c || muted) return;
  if (c.state === 'suspended') c.resume();
  const t = c.currentTime + 0.01;
  switch (name) {
    case 'click': tone(880, t, 0.08, { type: 'triangle', vol: 0.35, to: 1320 }); break;
    case 'step': stepAlt = !stepAlt; noise(t, 0.07, { vol: 0.22, freq: stepAlt ? 900 : 700, q: 0.8, type: 'lowpass' }); break;
    case 'talk': { const b = 600 + Math.random() * 200; tone(b, t, 0.05, { type: 'square', vol: 0.08 }); tone(b * 1.25, t + 0.06, 0.05, { type: 'square', vol: 0.07 }); break; }
    case 'doorOpen': tone(140, t, 0.9, { type: 'sawtooth', vol: 0.09, to: 260, attack: 0.05 }); tone(210, t + 0.1, 0.7, { type: 'sawtooth', vol: 0.05, to: 330, attack: 0.05 }); noise(t + 0.75, 0.12, { vol: 0.3, freq: 300, type: 'lowpass' }); break;
    case 'doorClose': noise(t, 0.2, { vol: 0.5, freq: 220, type: 'lowpass' }); tone(90, t, 0.18, { vol: 0.4, to: 60 }); break;
    case 'sit': tone(180, t, 0.18, { vol: 0.45, to: 90 }); noise(t, 0.1, { vol: 0.2, freq: 500, type: 'lowpass' }); break;
    case 'pickup': [76, 81, 88].forEach((m, i) => tone(hz(m), t + i * 0.07, 0.25, { type: 'triangle', vol: 0.3 })); break;
    case 'crunch': for (let i = 0; i < 4; i++) noise(t + i * 0.055, 0.05, { vol: 0.45, freq: 2500 + Math.random() * 1500, q: 2 }); break;
    case 'sleep': [72, 69, 65, 60].forEach((m, i) => tone(hz(m), t + i * 0.28, 0.5, { type: 'sine', vol: 0.25 })); break;
    case 'jump': tone(hz(67), t, 0.22, { type: 'sine', vol: 0.35, to: hz(79) }); break;
    case 'tap': tone(hz(84 + Math.floor(Math.random() * 5)), t, 0.15, { type: 'triangle', vol: 0.3 }); break;
    case 'wake': [72, 76, 79, 84, 88].forEach((m, i) => tone(hz(m), t + i * 0.08, 0.35, { type: 'triangle', vol: 0.3 })); break;
    case 'sparkle': [88, 91, 96].forEach((m, i) => tone(hz(m), t + i * 0.06, 0.3, { type: 'sine', vol: 0.2 })); break;
    case 'poof': noise(t, 0.5, { vol: 0.5, freq: 3000, to: 200, q: 0.7 }); break;
    case 'fanfare': [[72, 0], [76, 0.15], [79, 0.3], [84, 0.45], [79, 0.7], [84, 0.85]].forEach(([m, d]) => tone(hz(m), t + d, 0.4, { type: 'triangle', vol: 0.32 })); break;
  }
}

// ---------------------------------------------------------------- background music (music-box loop)
// 16 eighth-note steps per bar, 4 bars; numbers are MIDI notes (0 = rest). C major pentatonic.
const MELODY = [
  76, 0, 79, 0, 81, 0, 79, 76, 74, 0, 72, 0, 74, 76, 0, 0,
  76, 0, 79, 0, 84, 0, 81, 79, 76, 0, 79, 0, 81, 0, 0, 0,
  81, 0, 84, 81, 79, 0, 76, 0, 74, 0, 76, 79, 76, 0, 74, 0,
  72, 0, 74, 76, 79, 0, 76, 74, 72, 0, 0, 0, 67, 0, 72, 0,
];
const BASS = [48, 53, 57, 55]; // C, F, A(m), G — one per bar
const STEP = 60 / 92 / 2; // eighth note at 92 bpm

function startBgm() {
  const c = ctx!; let step = 0; let next = c.currentTime + 0.1;
  const schedule = () => {
    while (next < c.currentTime + 0.4) {
      const i = step % MELODY.length; const m = MELODY[i];
      if (m) { tone(hz(m), next, STEP * 2.6, { type: 'triangle', vol: 0.35, out: music }); tone(hz(m + 12), next, STEP * 1.5, { type: 'sine', vol: 0.08, out: music }); }
      if (i % 16 === 0) tone(hz(BASS[(i / 16) | 0]), next, STEP * 7, { type: 'sine', vol: 0.4, attack: 0.03, out: music });
      if (i % 16 === 8) tone(hz(BASS[(i / 16) | 0] + 7), next, STEP * 6, { type: 'sine', vol: 0.25, attack: 0.03, out: music });
      next += STEP; step++;
    }
  };
  schedule();
  bgmTimer = setInterval(schedule, 150);
}
