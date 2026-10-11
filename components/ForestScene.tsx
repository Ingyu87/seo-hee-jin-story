'use client';
import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { escort, useGame, player, HIDDEN, DWARFS, HEROES, SPK, useTx, npcPos, walkNpc, npcGoal, SW_HIDE_AT } from './store';
import { cozyExterior } from './cozy';
import { sfx } from './audio';
import { Html } from '@react-three/drei';
import { useModel, useModelPart, MODELS } from './models';
import { Player, Npc, World, groundY, Separation, bodies } from './Player';
import { Lights, FollowCam } from './common';
import { useAct } from './touch';
import { rigArms, poseArms } from './rig';
import { T } from './store';

/** Queen's story beat starts when she arrives — waits politely if another line is still on screen. */
function queenTalks() {
  const g = useGame.getState();
  if (g.lines.length) { setTimeout(queenTalks, 300); return; }
  g.interact('Queen');
}

/** After the Queen's mirror scene: Snow White is scared — off to the cottage, fast! (starts the run) */
function afterQueen() {
  const g = useGame.getState();
  if (g.lines.length) { setTimeout(afterQueen, 300); return; }
  const h = HEROES[g.hero]; const n = h.name;
  useGame.setState({ talker: 'SnowWhite' });
  g.say([
    { speaker: n, text: T("큰일 났다… 독 사과라니! 백설공주야, 걱정 마. 내가 지켜 줄게!", "Uh-oh… a poison apple?! Don't worry, Snow White. I'll protect you!") },
    { speaker: SPK.snow, text: T("무서워… 왕비가 돌아오기 전에 얼른 오두막까지 뛰어가자!", "I'm scared… let's run to the cottage before the Queen comes back!"),
      choices: [{ id: 'sw-go', label: T('같이 달리자! 🏃', "Let's run! 🏃") }] },
  ]);
}

/** At the end of the path: light up the 🏠 action button instead of popping a dialogue on its own. */
function gateHint() {
  useGame.setState({ hint: T('🏠 오두막에 도착! 버튼을 눌러 들어가 보자.', '🏠 The cottage! Press the button to go in.') });
}

const S = 0.9; // character scale used in the Blender forest render
/** Blender path centre: x = 0.9 sin(0.11 y); glTF z = -y. */
export const pathX = (z: number) => 0.9 * Math.sin(-z * 0.11);

function useForest() {
  const forest = useModel(MODELS.forest);
  const grounds = useRef<THREE.Object3D[]>([]);
  useMemo(() => {
    cozyExterior(forest);
    grounds.current = ['Ground', 'Path'].map((n) => forest.getObjectByName(n)).filter(Boolean) as THREE.Object3D[];
    forest.traverse((o) => {
      if (/^Butterfly/.test(o.name)) o.userData.flutter = true;
      if (/^(Bushes|FlowerStems|Petals|FlowerCenters|PathStones|Path$|Ground$)/.test(o.name)) o.traverse((m) => ((m as THREE.Mesh).castShadow = false));
    });
  }, [forest]);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    forest.children.forEach((o) => {
      if (o.userData.flutter) {
        if (o.userData.base === undefined) o.userData.base = o.position.y;
        o.position.y = o.userData.base + Math.sin(t * 2 + o.position.z) * 0.15;
        o.rotation.z = Math.sin(t * 14 + (o.name.endsWith('-1') ? Math.PI : 0)) * 0.5;
      }
    });
  });
  return { forest, grounds };
}

export function ForestBackdrop() {
  const { forest } = useForest();
  return <primitive object={forest} />;
}

/**
 * Run-escort obstacles on the forest path (matches the approved mockup): purple thorn bushes and big rocks
 * block the way (steer ←→ around them), blue puddles go "splash!" and slow you down for a moment.
 * Kid-friendly: nothing hurts, you never lose — Snow White runs beside you and hops over things by herself.
 * [kind, dx from path centre, z, radius]
 */
type ObKind = 'thorn' | 'rock' | 'puddle';
export const OBSTACLES: [ObKind, number, number, number][] = [
  // one obstacle per row, rows ~3.6 m apart, right in the running lane but always ≥2 m of free path beside it
  ['rock', 0.1, -0.6, 0.5], ['thorn', -1.1, -4.2, 0.55], ['thorn', 0.9, -7.8, 0.55], ['puddle', -0.3, -11.4, 0.7],
  ['rock', 1.2, -15.0, 0.5], ['thorn', -0.9, -18.6, 0.55], ['rock', 0.3, -22.2, 0.5], ['thorn', 1.0, -25.8, 0.55],
  ['puddle', -0.6, -29.2, 0.7],
]
const bumpAt = { t: 0 };
const slowUntil = { t: 0 };
const obPos = OBSTACLES.map(([kind, dx, z, r]) => ({ kind, x: pathX(z) + dx, z, r }));
/** Run-escort helper: which way to sidestep the solid obstacle just ahead (-1 left, +1 right, 0 = none). */
function steerAround(x: number, z: number) {
  const ob = obPos.find((t) => t.kind !== 'puddle' && t.z < z + 0.4 && t.z > z - 1.8 && Math.abs(x - t.x) < t.r + 0.6);
  if (!ob) return 0;
  let dir = x >= ob.x ? 1 : -1;
  if (Math.abs(x + dir * 1.2 - pathX(z)) > 3.1) dir = -dir; // don't steer off the path
  return dir;
}
export function inObstacle(x: number, z: number, pad = 0, solidOnly = true) {
  return obPos.some((t) => (!solidOnly || t.kind !== 'puddle') && Math.hypot(x - t.x, z - t.z) < t.r + pad);
}
const thornGeo = new THREE.ConeGeometry(0.08, 0.5, 5);
const thornMat = new THREE.MeshStandardMaterial({ color: '#8e4fc9', roughness: 0.6 });
const bramMat = new THREE.MeshStandardMaterial({ color: '#6a32a8', roughness: 0.75 });
const rockMat = new THREE.MeshStandardMaterial({ color: '#8a6a52', roughness: 0.95, flatShading: true });
const mossMat = new THREE.MeshStandardMaterial({ color: '#5f9a3a', roughness: 0.9 });
const waterMat = new THREE.MeshStandardMaterial({ color: '#4fb6ff', roughness: 0.08, metalness: 0.1, emissive: new THREE.Color('#1f79c9'), emissiveIntensity: 0.25 });
const rimMat = new THREE.MeshStandardMaterial({ color: '#9a8a7a', roughness: 0.9 });
const blobGeo = new THREE.IcosahedronGeometry(1, 1);
const rockGeo = new THREE.DodecahedronGeometry(1, 0);
const discGeo = new THREE.CircleGeometry(1, 28);
function Obstacle({ kind, x, z, r, grounds }: { kind: ObKind; x: number; z: number; r: number; grounds: React.MutableRefObject<THREE.Object3D[]> }) {
  const ref = useRef<THREE.Group>(null!);
  const parts = useMemo(() => {
    const spikes: { p: [number, number, number]; rot: [number, number, number] }[] = [];
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.3;
      const d = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
      const eu = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d));
      spikes.push({ p: [d.x * r * 0.9, 0.32 + d.y * r * 0.7, d.z * r * 0.9], rot: [eu.x, eu.y, eu.z] });
    }
    const pebbles = Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * 6.28; return [Math.cos(a) * r * 1.02, 0.02, Math.sin(a) * r * 0.78, 0.07 + Math.random() * 0.05] as [number, number, number, number]; });
    return { spikes, pebbles };
  }, [r]);
  const t0 = useMemo(() => Math.random() * 6, []);
  useFrame((st) => {
    const g = ref.current; if (!g) return;
    g.position.y = groundY(grounds.current, x, z, 0);
    // never clutter a conversation shot: obstacles near the talking pair step out of view while they talk
    const gs = useGame.getState();
    g.visible = !(gs.lines.length && Math.hypot(player.pos.x - x, player.pos.z - z) < 4);
    if (kind === 'thorn') g.rotation.y = Math.sin(st.clock.elapsedTime * 0.8 + t0) * 0.08; // gentle sway
  });
  return (
    <group ref={ref} position={[x, 0, z]} name={`Ob-${kind}`}>
      {kind === 'thorn' && <>
        <mesh geometry={blobGeo} material={bramMat} position={[0, 0.34, 0]} scale={[r * 0.9, r * 0.68, r * 0.9]} castShadow receiveShadow />
        {parts.spikes.map((sp, i) => <mesh key={i} geometry={thornGeo} material={thornMat} position={sp.p} rotation={sp.rot} castShadow />)}
      </>}
      {kind === 'rock' && <>
        <mesh geometry={rockGeo} material={rockMat} position={[0, r * 0.62, 0]} rotation={[0.3, t0, 0.2]} scale={[r * 1.05, r * 0.95, r * 0.95]} castShadow receiveShadow />
        <mesh geometry={rockGeo} material={rockMat} position={[r * 0.55, r * 0.3, r * 0.2]} rotation={[0.5, t0 * 2, 0]} scale={r * 0.45} castShadow receiveShadow />
        <mesh geometry={blobGeo} material={mossMat} position={[-r * 0.55, 0.08, r * 0.45]} scale={[r * 0.35, r * 0.18, r * 0.3]} />
        <mesh geometry={blobGeo} material={mossMat} position={[r * 0.2, 0.06, r * 0.75]} scale={[r * 0.28, r * 0.14, r * 0.22]} />
      </>}
      {kind === 'puddle' && <>
        <mesh geometry={discGeo} material={waterMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]} scale={[r, r * 0.75, 1]} receiveShadow />
        {parts.pebbles.map(([px, py, pz, ps], i) => <mesh key={i} geometry={blobGeo} material={rimMat} position={[px, py, pz]} scale={[ps, ps * 0.6, ps]} />)}
      </>}
    </group>
  );
}

function SnowWhite({ grounds }: { grounds: React.MutableRefObject<THREE.Object3D[]> }) {
  const obj = useModelPart(MODELS.snowwhite, 'SnowWhite');
  const ref = useRef<THREE.Group>(null!);
  const follow = useGame((s) => s.swFollow);
  const start = useMemo(() => new THREE.Vector3(pathX(1) + 1.3, 0, 1), []);
  const side = useRef(0); // run-escort: 0 = right of the player, 1 = left, 2 = behind
  const pos = useRef(start.clone());
  const t = useRef(0);
  const arms = useMemo(() => rigArms(obj), [obj]);
  const roam = useRef({ target: null as THREE.Vector3 | null, wait: 2, idle: 0, hinted: false });
  const hop = useRef(0);
  const hopV = useRef(0);
  useEffect(() => { npcPos.SnowWhite = pos.current; bodies.SnowWhite = { r: 0.4, solid: true, fixed: true }; return () => { delete bodies.SnowWhite; }; }, []);
  useAct('SnowWhite', { icon: '💬', label: T('백설공주와 이야기하기', 'Talk to Snow White'), r: 2.6, pos: () => [pos.current.x, pos.current.z], run: () => useGame.getState().interact('SnowWhite') });
  useFrame((_, dt) => {
    const g = ref.current; if (!g) return;
    t.current += dt;
    const p = pos.current;
    let moving = false;
    if (follow && useGame.getState().lines.length) {
      // stand still while talking (otherwise she circles the player as the player turns to face her)
      const w = Math.atan2(player.pos.x - p.x, player.pos.z - p.z);
      g.rotation.y += Math.atan2(Math.sin(w - g.rotation.y), Math.cos(w - g.rotation.y)) * 0.1;
    } else if (follow) {
      // walk beside the player (to her right, half a step behind)
      const fwd = new THREE.Vector3(Math.sin(player.rotY), 0, Math.cos(player.rotY));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x).multiplyScalar(-1);
      const want = player.pos.clone().addScaledVector(fwd, -0.4).addScaledVector(right, 1.5);
      const d = want.clone().sub(p).setY(0);
      const running = useGame.getState().running;
      if (running) {
        // run-escort: she runs beside you — right, left or just behind, whichever spot is clear of obstacles
        const OFF: [number, number][] = [[1.25, 0.15], [-1.25, 0.15], [0, 1.2]];
        const clear = (k: number) => !inObstacle(player.pos.x + OFF[k][0], player.pos.z + OFF[k][1], 0.5, false) && Math.abs(player.pos.x + OFF[k][0] - pathX(player.pos.z)) < 3.6;
        if (!clear(side.current)) { const k = [0, 1, 2].find(clear); if (k !== undefined) side.current = k; }
        else if (side.current !== 0 && clear(0)) side.current = 0;
        const spot = new THREE.Vector3(player.pos.x + OFF[side.current][0], 0, player.pos.z + OFF[side.current][1]);
        const dd = spot.sub(p).setY(0);
        if (dd.length() > 0.02) { moving = true; p.add(dd.clampLength(0, dt * 4.5)); g.rotation.y = Math.PI; }
        // never stand inside a rock / thorn bush: slide out sideways
        const ob = obPos.find((t) => t.kind !== 'puddle' && Math.hypot(p.x - t.x, p.z - t.z) < t.r + 0.35);
        if (ob) { const away = new THREE.Vector3(p.x - ob.x, 0, p.z - ob.z); if (away.lengthSq() < 1e-4) away.set(1, 0, 0); p.addScaledVector(away.normalize(), dt * 3); }
      } else if (d.length() > 0.3) {
        moving = true;
        p.add(d.normalize().multiplyScalar(Math.min(dt * 3.4, d.length())));
        g.rotation.y = Math.atan2(d.x, d.z);
      }
    } else {
      // before she follows you: picks flowers / wanders a little around her spot, turns to you when you come near.
      // Story beat: a few seconds after the intro she notices you and comes running over to talk.
      const gs0 = useGame.getState(); const r = roam.current;
      const dist = p.distanceTo(player.pos);
      if (gs0.talked['hide']) {
        // hiding with you behind the big tree while the Queen talks to her mirror
        const d = new THREE.Vector3(SW_HIDE_AT[0] - p.x, 0, SW_HIDE_AT[1] - p.z);
        if (d.length() > 0.06) { moving = true; p.add(d.clampLength(0, dt * 2.2)); g.rotation.y = Math.atan2(d.x, d.z); }
        else { const q = npcPos.Queen; const want = q && gs0.talked['q1'] ? Math.atan2(q.x - p.x, q.z - p.z) : Math.PI;
          g.rotation.y += Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)) * 0.1; }
      } else if (!gs0.metSnowWhite && !gs0.lines.length) {
        r.idle = (r.idle ?? 0) + dt;
        // she notices you and comes over — but the chat only starts when the player presses 💬 Talk (or E / Enter)
        if (dist < 1.7) {
          if (!r.hinted) { r.hinted = true; useGame.setState({ hint: T('💬 말하기 버튼을 눌러서 백설공주에게 인사해 봐!', '💬 Press the Talk button to say hello to Snow White!') }); }
        } else if (r.idle > 4) {
          const d = player.pos.clone().sub(p).setY(0);
          moving = true; p.add(d.normalize().multiplyScalar(dt * 1.9));
          g.rotation.y = Math.atan2(d.x, d.z);
        }
      } else if (gs0.lines.length) r.idle = 0;
      const near = moving || dist < 3.2 || gs0.lines.length > 0 || !!gs0.talked['hide'];
      if (!near) {
        if (!r.target) { r.wait -= dt; if (r.wait <= 0) { const a = Math.random() * 6.28; r.target = start.clone().add(new THREE.Vector3(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9)); r.wait = 2 + Math.random() * 3; } }
        else {
          const d = r.target.clone().sub(p).setY(0);
          if (d.length() < 0.05) r.target = null;
          else { moving = true; p.add(d.normalize().multiplyScalar(Math.min(dt * 0.8, d.length()))); const want = Math.atan2(d.x, d.z); g.rotation.y += Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)) * 0.12; }
        }
      }
      if (!moving && !gs0.talked['hide']) {
        const want = near ? Math.atan2(player.pos.x - p.x, player.pos.z - p.z) : g.rotation.y;
        g.rotation.y += Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)) * 0.08;
      }
    }
    p.y = groundY(grounds.current, p.x, p.z, 0);
    g.position.copy(p);
    const gs = useGame.getState();
    const speaking = gs.lines.length > 0 && gs.talker === 'SnowWhite';
    const near = p.distanceTo(player.pos) < 3;
    poseArms(arms, moving ? 'walk' : speaking ? (gs.lineIdx === 0 ? 'wave' : 'talk') : near && !gs.metSnowWhite ? 'wave' : 'idle', t.current, 0.2);
    if (hop.current > 0) { hopV.current -= 12 * dt; hop.current = Math.max(0, hop.current + hopV.current * dt); }
    g.children[0].position.y = hop.current + (moving ? Math.abs(Math.sin(t.current * 11)) * 0.07 : Math.abs(Math.sin(t.current * 1.6)) * 0.02);
  });
  return (
    <group ref={ref} onClick={(e) => {
      e.stopPropagation();
      const p = pos.current; const dir = player.pos.clone().sub(p).setY(0).normalize();
      useGame.getState().moveTo(p.x + dir.x * 1.3, p.z + dir.z * 1.3, 'SnowWhite');
    }}>
      <group scale={S * 1.02}><primitive object={obj} /></group>
    </group>
  );
}

/**
 * Hide-and-seek: three dwarfs crouch behind a leafy bush next to a tree beside the path. Their hat tips
 * poke out above the leaves, the bush rustles, and each one gives a sound clue when you are nearby
 * (Sneezy: "ACHOO!", Bashful: a giggle, Dopey: humming). Spots are picked at random from three zones
 * along the path every time the mission starts. Found only up close (🔍 button lights within reach).
 * Spot = [x, z, rotY] (absolute glTF coords, each just behind a tree trunk).
 */
type Spot = [number, number, number];
// [side (+1 right / -1 left of the path), z]: the bush sits on the path verge, the dwarf crouches just behind it,
// so a peeking hat can be spotted from further up the path even on a narrow phone screen
const ZONES: [number, number][][] = [
  [[1, -9.0], [-1, -10.8], [1, -13.0]],
  [[-1, -17.0], [1, -20.6], [-1, -24.2]],
  [[1, -27.6], [-1, -29.4], [1, -31.2]],
];
const spotAt = ([side, z]: [number, number]): Spot => [pathX(z) + side * 3.25, z, side > 0 ? -0.7 : 0.7];
function pickSpots(): Record<string, Spot> {
  const names = [...HIDDEN].sort(() => Math.random() - 0.5);
  const out: Record<string, Spot> = {};
  names.forEach((n, i) => { const z = ZONES[i]; out[n] = spotAt(z[Math.floor(Math.random() * z.length)]); });
  return out;
}
const CUE: Record<string, { tx: ReturnType<typeof T>; sfx: 'sneeze' | 'giggle' | 'sparkle' }> = {
  Sneezy: { tx: T('에… 에취!', 'Ah… ACHOO!'), sfx: 'sneeze' },
  Bashful: { tx: T('히히…', 'Hee hee…'), sfx: 'giggle' },
  Dopey: { tx: T('♪ 흥얼흥얼~', '♪ hum-hum~'), sfx: 'sparkle' },
};
const FIND_R = 2.4;
const bushMat = new THREE.MeshStandardMaterial({ color: '#3f8f3a', roughness: 0.9 });
const bushMat2 = new THREE.MeshStandardMaterial({ color: '#58a845', roughness: 0.9 });
const bushGeo = new THREE.IcosahedronGeometry(1, 2);
function HideBush({ x, z, grounds, rustle }: { x: number; z: number; grounds: React.MutableRefObject<THREE.Object3D[]>; rustle: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Group>(null!);
  useFrame((st) => {
    const g = ref.current; if (!g) return;
    g.position.y = groundY(grounds.current, x, z, 0);
    // rustle now and then (a clue for little seekers), and hard while the dwarf inside makes a sound
    const c = (st.clock.elapsedTime + z) % 5; let k = c > 3.4 ? Math.sin((c - 3.4) * 18) * 0.06 * Math.sin(((c - 3.4) / 1.6) * Math.PI) : 0;
    if (rustle.current > 0) k = Math.sin(st.clock.elapsedTime * 30) * 0.08 * Math.min(1, rustle.current);
    g.rotation.z = k; g.scale.setScalar(1 + Math.abs(k) * 0.6);
  });
  const blobs: [number, number, number, number, THREE.Material][] = [
    [0, 0.42, 0, 0.55, bushMat], [-0.45, 0.32, 0.12, 0.42, bushMat2], [0.45, 0.3, 0.05, 0.45, bushMat2], [0.1, 0.62, -0.1, 0.34, bushMat2], [-0.2, 0.25, 0.4, 0.33, bushMat],
  ];
  return (
    <group ref={ref} position={[x, 0, z]} name="HideBush">
      {blobs.map(([bx, by, bz, r, m], i) => <mesh key={i} geometry={bushGeo} material={m} position={[bx, by, bz]} scale={[r, r * 0.85, r]} castShadow receiveShadow />)}
    </group>
  );
}
function HiddenDwarf({ node, spot, grounds }: { node: string; spot: Spot; grounds: React.MutableRefObject<THREE.Object3D[]> }) {
  const obj = useModelPart(MODELS.dwarfs, node);
  const found = useGame((s) => s.found.includes(node));
  const tx = useTx();
  const ref = useRef<THREE.Group>(null!);
  const arms = useMemo(() => rigArms(obj), [obj]);
  const [hx, hz, ry] = spot;
  const hide = useMemo(() => new THREE.Vector3(hx, 0, hz), [hx, hz]);
  const toPath = Math.sign(pathX(hz) - hx);
  const bush = useMemo<[number, number]>(() => [hx + toPath * 0.6, hz + 0.45], [hx, hz, toPath]);
  const out = useMemo(() => new THREE.Vector3(pathX(hz) - toPath * 1.6, 0, hz + 0.9), [hz, toPath]); // hops out onto the path edge
  const pos = useMemo(() => hide.clone(), [hide]);
  const rustle = useRef(0);
  const cueAt = useRef(2 + Math.random() * 3);
  const [cue, setCue] = useState(false);
  useEffect(() => { npcPos[node] = pos; return () => { delete npcPos[node]; }; }, [node, pos]);
  useAct(`hide-${node}`, { icon: '🔍', label: T('찾았다! 누르기', 'Found you! Press'), r: FIND_R, pos: () => (found ? null : [hide.x, hide.z]), run: () => useGame.getState().findHidden(node) });
  useFrame((st, dt) => {
    const g = ref.current; if (!g) return;
    const t = st.clock.elapsedTime;
    if (found) pos.lerp(out, 0.3); else pos.copy(hide);
    g.position.set(pos.x, groundY(grounds.current, pos.x, pos.z, 0), pos.z);
    const body = g.children[0];
    rustle.current = Math.max(0, rustle.current - dt);
    if (!found) {
      // sound clue every few seconds while the player is within earshot
      const near = Math.hypot(player.pos.x - hide.x, player.pos.z - hide.z) < 9;
      cueAt.current -= dt;
      if (cueAt.current <= 0) {
        cueAt.current = 4 + Math.random() * 2;
        if (near && !useGame.getState().lines.length) { sfx(CUE[node].sfx); rustle.current = 1.1; setCue(true); setTimeout(() => setCue(false), 1300); }
      }
    }
    if (found) { // jump for joy
      body.position.y = Math.abs(Math.sin(t * 6)) * 0.25; body.rotation.z = 0; body.position.x = 0;
      const want = Math.atan2(player.pos.x - pos.x, player.pos.z - pos.z);
      g.rotation.y += Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)) * 0.1;
    } else {
      // crouched behind the bush with the hat tip poking out; peeks up + sideways now and then (a clue!)
      const cyc = (t + hz) % 5; const peek = Math.max(cyc > 3.6 ? Math.sin(((cyc - 3.6) / 1.4) * Math.PI) : 0, rustle.current > 0 ? 0.6 : 0);
      body.position.y = 0.05 + peek * 0.2 + Math.sin(t * 2.2 + hz) * 0.03;
      body.position.x = peek * 0.22 * toPath;
      body.rotation.z = -peek * 0.25 * toPath;
      g.rotation.y = ry;
    }
    poseArms(arms, found ? 'cheer' : 'idle', t, 0.2, hz);
  });
  const name = DWARFS.find((d) => d.node === node)!.name;
  const tryFind = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const g = useGame.getState();
    if (Math.hypot(player.pos.x - hide.x, player.pos.z - hide.z) <= FIND_R + 0.4) g.findHidden(node);
    else { g.flash(T('저기 뭔가 있는 것 같아… 더 가까이 가 봐! 👀', 'Something is there… go closer! 👀')); g.moveTo(pathX(hz) - toPath * 2.6, hz + 0.6); }
  };
  return (
    <>
      {!found && <HideBush x={bush[0]} z={bush[1]} grounds={grounds} rustle={rustle} />}
      <group ref={ref} rotation={[0, ry, 0]} onClick={tryFind}
        onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
        <group scale={S * 0.62}><primitive object={obj} /></group>
        {found && <Html position={[0, 1.4, 0]} center style={{ pointerEvents: 'none' }}><div className="nametag">✨ {tx(name)}</div></Html>}
        {!found && cue && <Html position={[0, 1.6, 0]} center style={{ pointerEvents: 'none' }}><div className="bubble cue">{tx(CUE[node].tx)}</div></Html>}
      </group>
    </>
  );
}

/** The Queen's magic mirror (gold oval frame + handle), held up in front of her face. */
function Mirror() {
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#cfe9ff', metalness: 0.9, roughness: 0.08, emissive: new THREE.Color('#7fb6ff'), emissiveIntensity: 0.35 }), []);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2c14e', metalness: 0.7, roughness: 0.3 }), []);
  const ref = useRef<THREE.Group>(null!);
  useFrame((st) => { if (ref.current) (glass.emissiveIntensity = 0.3 + Math.sin(st.clock.elapsedTime * 3) * 0.15); });
  return (
    <group ref={ref} position={[0.45, 1.55, 0.55]} rotation={[0, Math.PI + 0.5, 0]} name="MagicMirror">
      <mesh material={gold} scale={[1, 1.3, 1]}><torusGeometry args={[0.24, 0.045, 10, 32]} /></mesh>
      <mesh material={glass} scale={[1, 1.3, 1]} position={[0, 0, 0.005]}><circleGeometry args={[0.235, 32]} /></mesh>
      <mesh material={gold} position={[0, -0.47, 0]}><cylinderGeometry args={[0.035, 0.045, 0.32, 10]} /></mesh>
      <mesh material={gold} position={[0, 0.33, 0]}><sphereGeometry args={[0.05, 12, 10]} /></mesh>
    </group>
  );
}

const QUEEN_FROM: [number, number] = [-5.0, -1.4]; // steps out of the trees on the left…
const QUEEN_AT: [number, number] = [0.2, 1.2];    // …and stops on the path to talk to her mirror

export function ForestScene() {
  const { forest, grounds } = useForest();
  const queen = useModelPart(MODELS.queen, 'Queen');
  const fired = useRef({ gate: false });
  const spawnKey = useGame((s) => s.spawnKey);
  const spots = useMemo(pickSpots, [spawnKey]); // fresh hiding places every time the mission starts
  const world = useMemo<World>(() => ({
    scale: S,
    speed: 3.6,
    spawn: [pathX(8), 0, 8],
    spawnRot: Math.PI, // face up the path (back to the camera, like a 3rd-person game: hair / ponytail visible)
    grounds,
    // obstacles are solid unless you hop over them (⤴️ jump) or a grown-up pressed ⏩ skip
    blocked: (x, z) => z > 11 || z < -37 || Math.abs(x - pathX(z)) > 3.4 || (useGame.getState().seek === 'off' && !escort.skip && player.jumpY < 0.12 && inObstacle(x, z, 0.22)),
    autoRun: () => { const g = useGame.getState(); return g.seek === 'off' && g.swFollow && player.pos.z > -31 ? (escort.skip ? 5.5 : slowUntil.t > performance.now() ? 0.7 : 1.2) : null; },
    steer: (p) => steerAround(p.x, p.z),
    onBump: () => {
      const now = performance.now(); if (now - bumpAt.t < 1800) return; bumpAt.t = now;
      sfx('doorClose');
      useGame.getState().flash(T('앗, 막혔다! ← → 로 피하거나 ⤴️ 점프!', 'Blocked! Steer ← → or ⤴️ jump!'));
    },
    onStep: (p) => {
      const g = useGame.getState();
      if (g.running) {
        const pd = obPos.find((t) => t.kind === 'puddle' && Math.hypot(p.x - t.x, p.z - t.z) < t.r);
        if (pd && !escort.skip && player.jumpY < 0.05 && slowUntil.t < performance.now()) { slowUntil.t = performance.now() + 1100; sfx('poof'); g.flash(T('첨벙! 💦 물웅덩이~', 'Splash! 💦 A puddle~')); }
      }
      if (g.seek !== 'off') { if (g.seek === 'done' && !fired.current.gate && p.z < -31 && !g.lines.length) { fired.current.gate = true; gateHint(); } return; }
      if (!fired.current.gate && g.swFollow && p.z < -31 && !g.lines.length) { fired.current.gate = true; gateHint(); }
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [grounds, spawnKey]);

  // ---- story director: hide behind the tree → the Queen talks to her mirror → POOF → run to the cottage
  useFrame(() => {
    const g = useGame.getState();
    if (g.seek !== 'off') return;
    if (g.talked['hide'] && !g.talked['q1'] && !g.target) {
      useGame.setState({ talked: { ...g.talked, q1: true } });
      const q = npcPos.Queen; if (q) q.set(QUEEN_FROM[0], q.y, QUEEN_FROM[1]);
      walkNpc('Queen', [QUEEN_AT], queenTalks, 1.3);
    }
    if (g.swFollow && g.cutscene && !g.target) useGame.setState({ cutscene: false }); // lined up on the path → the run starts
    if (g.talked['q1'] && !g.talked['qGone'] && (g.beats['Queen'] ?? 0) >= 1 && !g.lines.length) {
      sfx('poof'); useGame.setState({ talked: { ...g.talked, qGone: true } });
      afterQueen();
    }
  });
  useEffect(() => () => { npcGoal.Queen = undefined; }, []);
  const queenOn = useGame((s) => !!s.talked['q1'] && !s.talked['qGone'] && s.seek === 'off');
  const seek = useGame((s) => s.seek);
  useAct('CottageGate', { icon: '🏠', label: T('오두막에 들어가기', 'Enter the cottage'), r: 4, pos: () => { const g = useGame.getState(); return (g.swFollow && g.talked['qGone']) || g.seek === 'done' ? [pathX(-33), -33] : null; }, run: () => useGame.getState().interact('CottageGate') });

  const onGround = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    useGame.getState().moveTo(e.point.x, e.point.z);
  };

  return (
    <>
      <color attach="background" args={['#f7e9d6']} />
      <fog attach="fog" args={['#f3ead9', 18, 70]} />
      <Lights sun={[7, 12, 5]} range={12} />
      <FollowCam offset={[0, 3.1, 6.2]} look={[0, 1.2, -1.5]} charH={2.1} />
      <primitive object={forest} onClick={onGround} />
      <Player world={world} />
      {seek === 'off' && <SnowWhite grounds={grounds} />}
      {seek === 'off' && obPos.map((t, i) => <Obstacle key={i} kind={t.kind} x={t.x} z={t.z} r={t.r} grounds={grounds} />)}
      {seek === 'on' && HIDDEN.map((n) => <HiddenDwarf key={n} node={n} spot={spots[n]} grounds={grounds} />)}
      <Npc object={queen} name="Queen" position={[QUEEN_FROM[0], 0, QUEEN_FROM[1]]} rotY={0.6} scale={S} grounds={grounds} wander={0} speed={0.5} visible={queenOn}>
        <Mirror />
      </Npc>
      <Separation playerR={0.4} />
    </>
  );
}
