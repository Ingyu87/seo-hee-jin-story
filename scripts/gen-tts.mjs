#!/usr/bin/env node
/**
 * Pre-generates every story line as an MP3 with Microsoft Edge "Read aloud" neural voices (free, no key,
 * via the `edge-tts` Python CLI), one distinct voice per character, Korean + English.
 * Output: public/tts/<key>.mp3 + public/tts/manifest.json. Only new lines are synthesized.
 *
 *   python3 -m venv .venv-tts && .venv-tts/bin/pip install edge-tts
 *   EDGE_TTS=.venv-tts/bin/edge-tts node scripts/gen-tts.mjs
 */
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'public/tts');
const EDGE = process.env.EDGE_TTS || 'edge-tts';
const DRY = process.argv.includes('--dry');

// load the shared key functions from TS
const keySrc = ts.transpileModule(fs.readFileSync(path.join(ROOT, 'components/ttsKey.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const keyMod = { exports: {} }; new Function('module', 'exports', keySrc)(keyMod, keyMod.exports);
const { ttsKey, cleanLine } = keyMod.exports;

// voice cast: [voice, rate, pitch]
const CAST = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/tts-cast.json'), 'utf8'));

const HEROES = {
  seohui: { name: { ko: '서희', en: 'Seohee' }, age: 8, call: '서희야', subj: '서희가', obj: '서희를', ro: '서희로' },
  seojin: { name: { ko: '서진', en: 'Seojin' }, age: 4, call: '서진아', subj: '서진이가', obj: '서진이를', ro: '서진이로' },
};
const DWARF_KO = { 박사: 'Doc', 투덜이: 'Grumpy', 행복이: 'Happy', 졸림이: 'Sleepy', 수줍이: 'Bashful', 재채기: 'Sneezy', 덤벙이: 'Dopey' };
const ALL_DWARFS = Object.values(DWARF_KO);

/** Evaluate a string / template literal expression for one hero (and optional score). */
function evalStr(node, sf, hero, score) {
  const src = node.getText(sf);
  const h = HEROES[hero];
  const scope = { h, n: h.name, call: h.call, en: h.name.en, HEROES, get: () => ({ hero }), score,
    found: { length: 1 }, HIDDEN: { length: 3 } };
  try { return new Function(...Object.keys(scope), `return (${src});`)(...Object.values(scope)); } catch { return null; }
}
function tCalls(node) { // every T(ko, en) inside an expression
  const out = [];
  const walk = (n) => { if (ts.isCallExpression(n) && n.expression.getText() === 'T' && n.arguments.length === 2) out.push(n); else ts.forEachChild(n, walk); };
  walk(node); return out;
}
function speakers(expr, sf) {
  const s = expr.getText(sf);
  const out = new Set();
  if (/SPK\.story/.test(s)) out.add('narrator');
  if (/SPK\.snow/.test(s)) out.add('snow');
  if (/SPK\.queen/.test(s)) out.add('queen');
  if (/SPK\.oldWoman/.test(s)) out.add('oldwoman');
  for (const m of s.matchAll(/dw\('(\w+)'\)/g)) out.add(m[1]);
  for (const m of s.matchAll(/T\('([^']+)'/g)) { if (m[1] === '마법 거울') out.add('mirror'); else if (m[1] === '나') out.add('hero'); else if (DWARF_KO[m[1]]) out.add(DWARF_KO[m[1]]); }
  if (/^(n|h\.name)$/.test(s.trim())) out.add('hero');
  if (/\bd\.name\b/.test(s)) ALL_DWARFS.forEach((d) => out.add(d));
  if (!out.size) console.warn('?? speaker', s, 'in', sf.fileName);
  return [...out];
}

const items = new Map(); // key -> { who, lang, text }
function add(who, lang, text) {
  if (!text) return;
  const clean = cleanLine(text); if (!clean) return;
  const key = ttsKey(who, lang, text);
  if (!items.has(key)) items.set(key, { who, lang, text: clean });
}
function addT(call, sf, whos) {
  const usesScore = /\$\{score\}/.test(call.getText(sf));
  const scores = usesScore ? Array.from({ length: 31 }, (_, i) => i) : [undefined];
  for (const hero of Object.keys(HEROES)) for (const score of scores) for (const w of whos) {
    const who = w === 'hero' ? hero : w;
    if ((who === 'seohui' || who === 'seojin') && who !== hero && w === 'hero') continue;
    add(who, 'ko', evalStr(call.arguments[0], sf, hero, score));
    add(who, 'en', evalStr(call.arguments[1], sf, hero, score));
  }
}

const dir = path.join(ROOT, 'components');
for (const f of fs.readdirSync(dir).filter((x) => /\.tsx?$/.test(x))) {
  const sf = ts.createSourceFile(f, fs.readFileSync(path.join(dir, f), 'utf8'), ts.ScriptTarget.Latest, true);
  const visit = (n) => {
    if (ts.isObjectLiteralExpression(n)) {
      const prop = (k) => n.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(sf) === k);
      const sp = prop('speaker'), tx = prop('text'), node = prop('node'), line = prop('line');
      if (sp && tx) { const whos = speakers(sp.initializer, sf); for (const c of tCalls(tx.initializer)) addT(c, sf, whos); }
      if (node && line) { const who = node.initializer.text; for (const c of tCalls(line.initializer)) addT(c, sf, [who]); }
    }
    if (ts.isPropertyAssignment(n) && /^(endSafe|endWoke)$/.test(n.name.getText(sf))) {
      for (const c of tCalls(n.initializer)) for (const hero of Object.keys(HEROES)) {
        const nm = HEROES[hero].name;
        const src = (a) => { try { return new Function('n', `return (${a.getText(sf)});`)(nm); } catch { return null; } };
        add('narrator', 'ko', src(c.arguments[0])); add('narrator', 'en', src(c.arguments[1]));
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

fs.mkdirSync(OUT, { recursive: true });
const keys = [...items.keys()];
console.log(`${keys.length} lines`);
const byWho = {}; for (const v of items.values()) byWho[v.who + ':' + v.lang] = (byWho[v.who + ':' + v.lang] || 0) + 1;
console.log(byWho);
if (DRY) { for (const [k, v] of items) console.log(k, v.who, v.lang, v.text); process.exit(0); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-'));
let made = 0, failed = 0;
// a changed cast entry invalidates that speaker's clips
let oldCast = {}; try { oldCast = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8')).cast || {}; } catch {}
const castChanged = (lang, who) => JSON.stringify((oldCast[lang] || {})[who]) !== JSON.stringify((CAST[lang] || {})[who] || CAST[lang].narrator);
const jobs = keys.filter((k) => !fs.existsSync(path.join(OUT, k + '.mp3')) || process.argv.includes('--force') || castChanged(items.get(k).lang, items.get(k).who));
async function one(k) {
  const { who, lang, text } = items.get(k);
  const c = CAST[lang][who] || CAST[lang].narrator;
  const { voice, fx } = c;
  // per-line expression: exclamations lift + speed up, questions lift, trailing "..." slows down
  const t = text.trim();
  let dr = 0, dp = 0;
  if (/[!！]+[^\w가-힣]*$/.test(t)) { dr += 6; dp += 10; }
  else if (/[?？]+[^\w가-힣]*$/.test(t)) { dp += 6; }
  if (/(\.\.\.|…)[^\w가-힣]*$/.test(t)) { dr -= 8; dp -= 4; }
  const pct = (v) => (v >= 0 ? '+' : '') + v;
  const rate = pct(parseInt(c.rate, 10) + dr) + '%';
  const pitch = pct(parseInt(c.pitch, 10) + dp) + 'Hz';
  const volume = c.volume || '+0%';
  const raw = path.join(tmp, k + '.raw.mp3');
  const spoken = text.replace(/[()]/g, ', ').replace(/~/g, '');
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await new Promise((res, rej) => {
        import('node:child_process').then(({ execFile }) => execFile(EDGE, ['-v', voice, `--rate=${rate}`, `--pitch=${pitch}`, '-t', spoken, '--write-media', raw], { timeout: 60000 }, (e) => (e ? rej(e) : res())));
      });
      // 32 kbps mono keeps the whole cast small enough for the free Vercel tier
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-af', [fx, 'loudnorm=I=-19:TP=-1.5:LRA=11', `volume=${(1 + parseInt(volume, 10) / 100).toFixed(2)}`, 'alimiter=limit=0.95'].filter(Boolean).join(','), '-ac', '1', '-ar', '24000', '-b:a', '32k', path.join(OUT, k + '.mp3')]);
      made++; return;
    } catch (e) { await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); }
  }
  failed++; console.warn('FAILED', k, who, lang, text);
}
const POOL = 6; let i = 0;
await Promise.all(Array.from({ length: POOL }, async () => { while (i < jobs.length) { const k = jobs[i++]; await one(k); if ((made + failed) % 50 === 0) console.log(`${made + failed}/${jobs.length}`); } }));

// prune clips no longer used, write manifest
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.mp3') && !items.has(f.slice(0, -4))) fs.unlinkSync(path.join(OUT, f));
const present = keys.filter((k) => fs.existsSync(path.join(OUT, k + '.mp3'))).sort();
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ engine: 'edge-tts', cast: CAST, keys: present }));
console.log(`made ${made}, failed ${failed}, total ${present.length}`);
