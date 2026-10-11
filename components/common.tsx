'use client';
import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { player, npcPos, useGame, DWARFS } from './store';
const DWARF_NODES = new Set(DWARFS.map((d) => d.node));

export function Lights({ sun = [8, 14, 6] as [number, number, number], range = 14, intensity = 2.2, ground = '#7fae6a' }) {
  const dir = useRef<THREE.DirectionalLight>(null!);
  const { scene, gl } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => { scene.environment = null; env.dispose(); pm.dispose(); };
  }, [scene, gl]);
  useFrame(() => {
    const d = dir.current;
    if (!d) return;
    d.position.set(player.pos.x + sun[0], player.pos.y + sun[1], player.pos.z + sun[2]);
    d.target.position.copy(player.pos);
    d.target.updateMatrixWorld();
  });
  return (
    <>
      <hemisphereLight args={['#fff6e8', ground, 0.75]} />
      <directionalLight ref={dir} intensity={intensity} color="#fff1dc" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03}
        shadow-camera-left={-range} shadow-camera-right={range} shadow-camera-top={range} shadow-camera-bottom={-range}
        shadow-camera-near={1} shadow-camera-far={60} />
    </>
  );
}

/** Player-controlled zoom (mouse wheel on PC / two-finger pinch on phones): 0.55 = close-up, 1.7 = wide.
 *  No free rotation — the camera direction stays automatic. Conversation shots ignore it (auto framing). */
export const camZoom = { v: 1 };
const clampZ = (v: number) => Math.min(1.8, Math.max(0.5, v));
/** zoom buttons (＋ / －) and keyboard (+ / -) step */
export function zoomBy(f: number) { camZoom.v = clampZ(camZoom.v * f); }
if (typeof window !== 'undefined') {
  // anything over the 3D view counts (the canvas itself or R3F's wrapper divs), but not buttons / dialogue / joystick
  const onView = (t: EventTarget | null) => {
    const el = t as HTMLElement | null;
    if (!el?.closest) return false;
    if (el.closest('button, .dialog, .joy, .guide, .toolbar, .topbar')) return false;
    return !!el.closest('.game');
  };
  window.addEventListener('wheel', (e) => {
    if (!onView(e.target)) return;
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY; // Firefox reports lines
    camZoom.v = clampZ(camZoom.v * Math.exp(Math.sign(dy) * Math.min(Math.abs(dy), 150) * 0.0015));
  }, { passive: false });
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null; if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
    if (e.key === '+' || e.key === '=') zoomBy(0.88);
    if (e.key === '-' || e.key === '_') zoomBy(1 / 0.88);
  });
  // two-finger pinch: Touch events (most reliable on iOS Safari + Android Chrome)
  let d0 = 0, z0 = 1;
  const spread = (tl: TouchList) => Math.hypot(tl[0].clientX - tl[1].clientX, tl[0].clientY - tl[1].clientY);
  window.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2 && onView(e.touches[0].target) && onView(e.touches[1].target)) { d0 = spread(e.touches); z0 = camZoom.v; }
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && d0 > 20) { e.preventDefault(); camZoom.v = clampZ(z0 * d0 / Math.max(20, spread(e.touches))); }
  }, { passive: false });
  window.addEventListener('touchend', (e) => { if (e.touches.length < 2) d0 = 0; });
  window.addEventListener('touchcancel', () => { d0 = 0; });
  // iOS Safari: stop the page itself from pinch-zooming over the game
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  (window as unknown as { __snow?: Record<string, unknown> }).__snow = Object.assign((window as unknown as { __snow?: Record<string, unknown> }).__snow || {}, { camZoom });
}

const _mid = new THREE.Vector3(), _dir = new THREE.Vector3(), _up = new THREE.Vector3();
const _ray = new THREE.Raycaster(), _tgt = new THREE.Vector3();
const OCCLUDER = /^(Tree\d|FrameL|FrameR|Mush\d|Rocks)/;

/** Trees / mushrooms standing between the camera and the player (or the NPC being talked to) are hidden
 *  so the characters are never blocked from view; they pop back as soon as the line of sight is clear. */
function useOccluderFade(re: RegExp = OCCLUDER) {
  const { scene } = useThree();
  const list = useRef<THREE.Object3D[]>([]);
  const hidden = useRef(new Set<THREE.Object3D>());
  const n = useRef(0);
  return (cam: THREE.Vector3, targets: THREE.Vector3[], keep?: string | null) => {
    if (!list.current.length && n.current++ % 30 === 0) {
      scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) { let a: THREE.Object3D | null = o; while (a && !(a.name && re.test(a.name))) a = a.parent; if (a) { o.userData.occRoot = a.name; list.current.push(o); } } });
    }
    if (!list.current.length) return;
    const now = new Set<THREE.Object3D>();
    list.current.forEach((m) => (m.visible = true)); // test against everything, then re-hide
    for (const t of targets) {
      const d = _tgt.copy(t).sub(cam); const len = d.length(); if (len < 0.01) continue;
      _ray.set(cam, d.normalize()); _ray.far = len - 0.3;
      for (const h of _ray.intersectObjects(list.current, false)) if (h.object.userData.occRoot !== keep) now.add(h.object);
    }
    const roots = new Set([...now].map((m) => m.userData.occRoot as string));
    list.current.forEach((m) => (m.visible = !roots.has(m.userData.occRoot))); // the whole tree / chair, not just one piece
    hidden.current = now;
  };
}

/** Smooth follow camera: world-space offset from the player, looking slightly ahead. */
/** NPCs (not the speaker) currently standing in the conversation shot's line of sight — hidden while the line plays. */
export const convoHidden = new Set<string>();

export function FollowCam({ offset, look, lerp = 0.08, fixed, room, charH = 1.6, occluders }: {
  offset: [number, number, number]; look: [number, number, number]; lerp?: number;
  fixed?: (p: THREE.Vector3) => { pos: THREE.Vector3; look: THREE.Vector3 };
  /** dollhouse room (front wall cut away at +z): conversation shots stay in front of it, never inside a wall */
  room?: { x: [number, number]; frontZ: number; maxY: number };
  /** on-screen character height (metres, at the scene's character scale) used to frame conversation shots */
  charH?: number;
  /** dollhouse: furniture that may be tucked away while it blocks a conversation shot */
  occluders?: RegExp;
}) {
  const { camera } = useThree();
  const lookAt = useRef(new THREE.Vector3());
  const first = useRef(true);
  const fade = useOccluderFade(occluders);
  const convo = useRef<{ zoom?: number; lines: unknown; talker: string | null; sign: number; pPos: THREE.Vector3 | null; nPos: THREE.Vector3 | null; pos: THREE.Vector3; look: THREE.Vector3 }>(
    { lines: null, talker: null, sign: 1, pPos: null, nPos: null, pos: new THREE.Vector3(), look: new THREE.Vector3() });
  useFrame(() => {
    let pos: THREE.Vector3, lk: THREE.Vector3;
    if (fixed) ({ pos, look: lk } = fixed(player.pos));
    else {
      pos = player.pos.clone().add(new THREE.Vector3(...offset));
      lk = player.pos.clone().add(new THREE.Vector3(...look));
      if (useGame.getState().running) { pos.y += 1.1; pos.z += 0.8; lk.z -= 3.5; lk.y -= 0.3; } // run-escort: see the obstacles coming
    }
    // conversation shot: while someone is talking, frame the player + that character a bit closer
    const g = useGame.getState();
    const npc = g.talker ? npcPos[g.talker] : null;
    let a = first.current ? 1 : lerp;
    if (g.lines.length && npc && npc.distanceTo(player.pos) < 7) {
      // Conversation two-shot. The shot is LOCKED when the conversation starts (no orbiting while lines play)
      // and only re-framed if someone actually walks somewhere (e.g. the old woman coming in).
      const c = convo.current;
      const moved = !c.pPos || c.pPos.distanceTo(player.pos) > 0.8 || c.nPos!.distanceTo(npc) > 0.8;
      const zoomed = c.zoom !== camZoom.v; c.zoom = camZoom.v; // +/- or pinch during a chat re-frames the shot
      if (c.lines !== g.lines || c.talker !== g.talker || moved || zoomed) {
        const fresh = c.lines !== g.lines || c.talker !== g.talker;
        const fresh0 = fresh && c.talker !== g.talker;
        c.lines = g.lines; c.talker = g.talker; c.pPos = player.pos.clone(); c.nPos = npc.clone();
        const mid = _mid.copy(player.pos).add(npc).multiplyScalar(0.5);
        const portrait = typeof window !== 'undefined' && window.innerWidth < window.innerHeight;
        const axis = _dir.set(npc.x - player.pos.x, 0, npc.z - player.pos.z);
        let sep = Math.max(0.6, axis.length()); axis.normalize();
        if (fresh0 && !room && sep < 1.5 && axis.lengthSq() > 0.5) {
          // too close together (one would hide the other): the other character takes a step back
          npc.addScaledVector(axis, 1.5 - sep); sep = 1.5;
          mid.copy(player.pos).add(npc).multiplyScalar(0.5);
        }
        const backXZ = _up.copy(pos).sub(lk).setY(0).normalize();
        const side = new THREE.Vector3(-axis.z, 0, axis.x);
        if (side.dot(backXZ) < 0) side.negate();
        if (fresh) {
          // pick the side where no bystander (e.g. Snow White walking beside you) blocks the view
          const score = (sg: number) => {
            const cdir = side.clone().multiplyScalar(sg);
            const cp = mid.clone().addScaledVector(cdir, 7); let bad = 0;
            for (const [name, v] of Object.entries(npcPos)) {
              if (name === g.talker || v.distanceTo(mid) > 6) continue;
              for (const t of [player.pos, npc]) {
                const seg = t.clone().sub(cp).setY(0); const l2 = seg.lengthSq();
                const k = THREE.MathUtils.clamp(v.clone().sub(cp).setY(0).dot(seg) / l2, 0, 1);
                if (k < 0.97 && cp.clone().addScaledVector(seg, k).setY(0).distanceTo(v.clone().setY(0)) < 0.9) bad++;
              }
            }
            return bad;
          };
          c.sign = score(-1) < score(1) ? -1 : 1;
        }
        side.multiplyScalar(c.sign);
        // perpendicular to player→NPC (both seen side-on / 3/4, never one behind the other); dollhouse cottage
        // stays in front of the cut-away wall with only a slight turn
        // perpendicular to player→NPC (both seen side-on / 3/4, never one behind the other)
        const cam = camera as THREE.PerspectiveCamera;
        const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6;
        const vHalf = THREE.MathUtils.degToRad((cam.fov ?? 42) / 2);
        const hHalf = Math.atan(Math.tan(vHalf) * aspect);
        const margin = portrait ? 0.75 : 0.9;
        let hdir = side.clone().addScaledVector(backXZ, 0.15).normalize(); // clean side two-shot: both side by side
        if (!room) {
          // far apart (e.g. the Queen up the path) on a narrow phone screen: swing round behind the player
          // (over-the-shoulder) until both fit without the camera flying miles away
          for (const w of [0, 0.3, 0.5, 0.65, 0.78, 0.88]) {
            const h = side.clone().multiplyScalar(1 - w).addScaledVector(axis, -w).addScaledVector(backXZ, 0.15).normalize();
            const ss = sep * Math.sqrt(Math.max(0.15, 1 - Math.pow(h.dot(axis), 2)));
            hdir = h;
            if (((ss / 2 + margin) / Math.tan(hHalf)) * camZoom.v <= 10.5) break;
          }
        }
        if (room) { // dollhouse: look in through the open front — a 3/4 two-shot, faces towards the camera
          hdir.copy(side).multiplyScalar(portrait ? 0.4 : 0.55).add(new THREE.Vector3(0, 0, 1)).normalize();
        }
        // apparent (screen-plane) separation of the two characters from this angle
        const screenSep = sep * Math.sqrt(Math.max(0.15, 1 - Math.pow(hdir.dot(axis), 2)));
        const fitW = (screenSep / 2 + margin) / Math.tan(hHalf);  // both bodies + a small margin across the screen
        // FULL BODY two-shot: head-to-toe above the dialogue box (~bottom 32% on phones)
        const fitH = (charH * 1.2) / ((portrait ? 0.95 : 1.15) * Math.tan(vHalf));
        const dist = THREE.MathUtils.clamp(Math.max(fitW, fitH) * camZoom.v, charH * 3.4, 18);
        const el = THREE.MathUtils.degToRad(portrait ? 18 : 14);
        // aim BELOW the pair so both full bodies sit in the upper part of the screen, clear of the dialogue box
        c.look.copy(mid); c.look.y += charH * 0.5 - (portrait ? 0.16 : 0.12) * dist * Math.tan(vHalf);
        c.pos.copy(c.look).addScaledVector(hdir, dist * Math.cos(el)); c.pos.y += dist * Math.sin(el);
        if (room) { // keep the lens out of the walls / roof: in front of the open side, between the side walls
          c.pos.x = THREE.MathUtils.clamp(c.pos.x, room.x[0], room.x[1]);
          c.pos.z = Math.max(c.pos.z, room.frontZ + (dist - 4) * 0.8);
          c.pos.y = Math.min(c.pos.y, room.maxY + (c.pos.z - room.frontZ) * 0.35);
        }
      }
      pos = c.pos; lk = c.look;
      a = Math.min(a, 0.12);
      // anyone else standing between the lens and the two speakers is tucked away until the line is over
      convoHidden.clear();
      for (const [name, v] of Object.entries(npcPos)) {
        if (name === g.talker) continue;
        // story characters stay in shot for their scenes (old woman always; Snow White once the apple arrives)
        if (!DWARF_NODES.has(name) && (name !== 'SnowWhiteHome' || g.apple === 'table' || g.apple === 'held' || g.sleeping)) continue;
        for (const t of [player.pos, npc]) {
          const seg = _tgt.copy(t).sub(camera.position).setY(0); const l2 = seg.lengthSq(); if (l2 < 0.01) continue;
          const rx = v.x - camera.position.x, rz = v.z - camera.position.z;
          const k = (rx * seg.x + rz * seg.z) / l2;
          if (k <= 0 || k >= 0.92) continue; // only in front of the speaker, not behind them
          if (Math.hypot(rx - seg.x * k, rz - seg.z * k) < 0.75) { convoHidden.add(name); break; }
        }
      }
    } else { convo.current.lines = null; convoHidden.clear(); }
    if (!(g.lines.length && npc && npc.distanceTo(player.pos) < 7)) pos = lk.clone().add(pos.clone().sub(lk).multiplyScalar(camZoom.v));
    first.current = false;
    camera.position.lerp(pos, a);
    lookAt.current.lerp(lk, a);
    camera.lookAt(lookAt.current);
    if (!fixed) { // keep both the player and whoever is talking in clear view
      const tg = [player.pos.clone().setY(player.pos.y + 1.0), player.pos.clone().setY(player.pos.y + 0.3)];
      if (g.lines.length && npc) tg.push(npc.clone().setY(npc.y + 1.0));
      fade(camera.position, tg);
    } else if (occluders) { // dollhouse: during a chat, a chair in front of a speaker steps aside (never the one you sit on)
      const ch = charH * 0.6;
      const tg = g.lines.length && npc ? [player.pos.clone().setY(player.pos.y + ch), player.pos.clone().setY(player.pos.y + ch * 0.4), npc.clone().setY(npc.y + 0.75), npc.clone().setY(npc.y + 0.4), npc.clone().setY(npc.y + 0.15)] : [];
      fade(camera.position, tg, g.sitting);
    }
  });
  return null;
}
