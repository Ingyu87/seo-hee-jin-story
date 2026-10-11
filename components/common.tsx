'use client';
import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { player, npcPos, useGame } from './store';

export function Lights({ sun = [8, 14, 6] as [number, number, number], range = 14, intensity = 2.2 }) {
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
      <hemisphereLight args={['#fff6e8', '#7fae6a', 0.75]} />
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
if (typeof window !== 'undefined') {
  const clampZ = (v: number) => Math.min(1.7, Math.max(0.55, v));
  const onCanvas = (t: EventTarget | null) => !!(t as HTMLElement)?.closest?.('canvas');
  window.addEventListener('wheel', (e) => {
    if (!onCanvas(e.target)) return;
    e.preventDefault();
    camZoom.v = clampZ(camZoom.v * Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0012));
  }, { passive: false });
  const pts = new Map<number, { x: number; y: number }>(); let d0 = 0, z0 = 1;
  const spread = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || !onCanvas(e.target)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { d0 = spread(); z0 = camZoom.v; }
  });
  window.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && d0 > 20) camZoom.v = clampZ(z0 * d0 / Math.max(20, spread()));
  });
  const up = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size < 2) d0 = 0; };
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  // iOS Safari: stop the page itself from pinch-zooming over the game
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}

const _mid = new THREE.Vector3(), _dir = new THREE.Vector3(), _up = new THREE.Vector3();
const _ray = new THREE.Raycaster(), _tgt = new THREE.Vector3();
const OCCLUDER = /^(Tree\d|FrameL|FrameR|Mush\d|Rocks)/;

/** Trees / mushrooms standing between the camera and the player (or the NPC being talked to) are hidden
 *  so the characters are never blocked from view; they pop back as soon as the line of sight is clear. */
function useOccluderFade() {
  const { scene } = useThree();
  const list = useRef<THREE.Object3D[]>([]);
  const hidden = useRef(new Set<THREE.Object3D>());
  const n = useRef(0);
  return (cam: THREE.Vector3, targets: THREE.Vector3[]) => {
    if (!list.current.length && n.current++ % 30 === 0) {
      scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) { let a: THREE.Object3D | null = o; while (a && !(a.name && OCCLUDER.test(a.name))) a = a.parent; if (a) list.current.push(o); } });
    }
    if (!list.current.length) return;
    const now = new Set<THREE.Object3D>();
    list.current.forEach((m) => (m.visible = true)); // test against everything, then re-hide
    for (const t of targets) {
      const d = _tgt.copy(t).sub(cam); const len = d.length(); if (len < 0.01) continue;
      _ray.set(cam, d.normalize()); _ray.far = len - 0.3;
      for (const h of _ray.intersectObjects(list.current, false)) now.add(h.object);
    }
    list.current.forEach((m) => (m.visible = !now.has(m)));
    hidden.current = now;
  };
}

/** Smooth follow camera: world-space offset from the player, looking slightly ahead. */
export function FollowCam({ offset, look, lerp = 0.08, fixed, room }: {
  offset: [number, number, number]; look: [number, number, number]; lerp?: number;
  fixed?: (p: THREE.Vector3) => { pos: THREE.Vector3; look: THREE.Vector3 };
  /** dollhouse room (front wall cut away at +z): conversation shots stay in front of it, never inside a wall */
  room?: { x: [number, number]; frontZ: number; maxY: number };
}) {
  const { camera } = useThree();
  const lookAt = useRef(new THREE.Vector3());
  const first = useRef(true);
  const fade = useOccluderFade();
  const convo = useRef<{ lines: unknown; talker: string | null; sign: number; pPos: THREE.Vector3 | null; nPos: THREE.Vector3 | null; pos: THREE.Vector3; look: THREE.Vector3 }>(
    { lines: null, talker: null, sign: 1, pPos: null, nPos: null, pos: new THREE.Vector3(), look: new THREE.Vector3() });
  useFrame(() => {
    let pos: THREE.Vector3, lk: THREE.Vector3;
    if (fixed) ({ pos, look: lk } = fixed(player.pos));
    else {
      pos = player.pos.clone().add(new THREE.Vector3(...offset));
      lk = player.pos.clone().add(new THREE.Vector3(...look));
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
      if (c.lines !== g.lines || c.talker !== g.talker || moved) {
        const fresh = c.lines !== g.lines || c.talker !== g.talker;
        c.lines = g.lines; c.talker = g.talker; c.pPos = player.pos.clone(); c.nPos = npc.clone();
        const mid = _mid.copy(player.pos).add(npc).multiplyScalar(0.5);
        const portrait = typeof window !== 'undefined' && window.innerWidth < window.innerHeight;
        const axis = _dir.set(npc.x - player.pos.x, 0, npc.z - player.pos.z);
        const sep = Math.max(0.6, axis.length()); axis.normalize();
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
        const hdir = side.clone().addScaledVector(backXZ, 0.15).normalize();
        if (room) { // dollhouse: look in through the open front — a 3/4 two-shot, faces towards the camera
          hdir.copy(side).multiplyScalar(0.55).add(new THREE.Vector3(0, 0, 1)).normalize();
        }
        const cam = camera as THREE.PerspectiveCamera;
        const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6;
        const vHalf = THREE.MathUtils.degToRad((cam.fov ?? 42) / 2);
        const hHalf = Math.atan(Math.tan(vHalf) * aspect);
        const fitW = (sep / 2 + 1.0) / Math.tan(hHalf);   // both full bodies + a margin across the screen
        const fitH = 2.4 / Math.tan(vHalf);               // head-to-toe vertically (with room for the dialogue box)
        const dist = THREE.MathUtils.clamp(Math.max(fitW, fitH), 4, 22);
        const el = THREE.MathUtils.degToRad(portrait ? 22 : 16);
        c.look.copy(mid); c.look.y += portrait ? 0.15 : 0.75; // aim low so faces sit above the dialogue box on phones
        c.pos.copy(c.look).addScaledVector(hdir, dist * Math.cos(el)); c.pos.y += dist * Math.sin(el);
        if (room) { // keep the lens out of the walls / roof: in front of the open side, between the side walls
          c.pos.x = THREE.MathUtils.clamp(c.pos.x, room.x[0], room.x[1]);
          c.pos.z = Math.max(c.pos.z, room.frontZ + (dist - 4) * 0.8);
          c.pos.y = Math.min(c.pos.y, room.maxY + (c.pos.z - room.frontZ) * 0.35);
        }
      }
      pos = c.pos; lk = c.look;
      a = Math.min(a, 0.12);
    } else convo.current.lines = null;
    if (!(g.lines.length && npc && npc.distanceTo(player.pos) < 7)) pos = lk.clone().add(pos.clone().sub(lk).multiplyScalar(camZoom.v));
    first.current = false;
    camera.position.lerp(pos, a);
    lookAt.current.lerp(lk, a);
    camera.lookAt(lookAt.current);
    if (!fixed) { // keep both the player and whoever is talking in clear view
      const tg = [player.pos.clone().setY(player.pos.y + 1.0), player.pos.clone().setY(player.pos.y + 0.3)];
      if (g.lines.length && npc) tg.push(npc.clone().setY(npc.y + 1.0));
      fade(camera.position, tg);
    }
  });
  return null;
}
