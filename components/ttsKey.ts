/**
 * Shared by the browser (components/speech.ts) and the build-time generator (scripts/gen-tts.mjs):
 * how a spoken line is cleaned and turned into the file name of its pre-generated voice clip.
 */
export function cleanLine(text: string) {
  return text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{FE0F}]/gu, '').replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();
}
/** FNV-1a (32-bit, two seeds) → 16 hex chars. */
export function ttsKey(who: string, lang: string, text: string) {
  const s = `${who}|${lang}|${cleanLine(text)}`;
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x01000193 + 2) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}
