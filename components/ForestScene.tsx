'use client';
import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { escort, useGame, player, HIDDEN, DWARFS, HEROES, SPK, useTx, npcPos, walkNpc, npcGoal } from './store';
import { sfx } from './audio';
import { Html } from '@react-three/drei';
import { useModel, useModelPart, MODELS } from './models';
import { Player, Npc, World, groundY } from './Player';
import { Lights, FollowCam } from './common';
import { useAct } from './touch';
import { rigArms, poseArms } from './rig';
import { T } from './store';

/** Queen's story beat starts when she arrives — waits politely if another line is still on screen. */
function queenTalks() {
  const g = useGame.getState();
  if (g.lines.length || g.mini) { setTimeout(queenTalks, 300); return; }
  g.interact('Queen');
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
  // one obstacle per row, rows ≥3.5 m apart, always ≥2 m of free path beside it — easy for a 4-year-old
  ['thorn', -0.9, -8.0, 0.5], ['rock', 1.2, -11.6, 0.5], ['puddle', -1.0, -15.2, 0.6], ['thorn', 1.1, -19.0, 0.5],
  ['rock', -1.1, -22.6, 0.5], ['thorn', 0.9, -26.4, 0.5], ['puddle', -0.5, -29.6, 0.6],
];
const bumpAt = { t: 0 };
const slowUntil = { t: 0 };
const obPos = OBSTACLES.map(([kind, dx, z, r]) => ({ kind, x: pathX(z) + dx, z, r }));
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
  const start = useMemo(() => new THREE.Vector3(pathX(-5) + 1.3, 0, -5), []);
  const pos = useRef(start.clone());
  const t = useRef(0);
  const arms = useMemo(() => rigArms(obj), [obj]);
  const roam = useRef({ target: null as THREE.Vector3 | null, wait: 2, idle: 0, hinted: false });
  const hop = useRef(0);
  const hopV = useRef(0);
  useEffect(() => { npcPos.SnowWhite = pos.current; }, []);
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
        // run-escort: she runs right beside you (a little behind) and hops over rocks / thorns by herself
        const side = new THREE.Vector3(0.95, 0, 0.35).add(player.pos);
        const dd = side.sub(p).setY(0);
        if (dd.length() > 0.02) { moving = true; p.add(dd.clampLength(0, dt * 5.2)); g.rotation.y = Math.PI; }
        const ob = obPos.find((t) => t.kind !== 'puddle' && Math.hypot(p.x - t.x, p.z - t.z) < t.r + 0.55);
        if (ob && hop.current < 0.05) { hop.current = 0.001; hopV.current = 3.2; sfx('jump'); }
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
      if (!gs0.metSnowWhite && !gs0.lines.length && !gs0.mini) {
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
      const near = moving || dist < 3.2 || gs0.lines.length > 0;
      if (!near) {
        if (!r.target) { r.wait -= dt; if (r.wait <= 0) { const a = Math.random() * 6.28; r.target = start.clone().add(new THREE.Vector3(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9)); r.wait = 2 + Math.random() * 3; } }
        else {
          const d = r.target.clone().sub(p).setY(0);
          if (d.length() < 0.05) r.target = null;
          else { moving = true; p.add(d.normalize().multiplyScalar(Math.min(dt * 0.8, d.length()))); const want = Math.atan2(d.x, d.z); g.rotation.y += Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)) * 0.12; }
        }
      }
      if (!moving) {
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
 * Hide-and-seek: three dwarfs crouch behind a tree + a leafy bush beside the path — only the top of a hat /
 * a peeking face shows now and then. They can only be "found" up close (🔍 button lights within reach).
 * [dx from the path, z, rotY, bush dx, bush z]
 */
const HIDE_SPOTS: Record<string, [number, number, number, number, number]> = {
  Dopey: [4.0, -10.6, -0.7, 3.35, -10.05],   // behind the little fir (Tree16)
  Bashful: [-3.95, -20.4, 0.7, -3.25, -19.85], // behind the big oak (Tree0)
  Sneezy: [4.2, -31.6, -0.7, 3.5, -31.05],   // behind the fir near the cottage (Tree49)
};
const FIND_R = 2.4;
const bushMat = new THREE.MeshStandardMaterial({ color: '#3f8f3a', roughness: 0.9 });
const bushMat2 = new THREE.MeshStandardMaterial({ color: '#58a845', roughness: 0.9 });
const bushGeo = new THREE.IcosahedronGeometry(1, 2);
function HideBush({ x, z, grounds }: { x: number; z: number; grounds: React.MutableRefObject<THREE.Object3D[]> }) {
  const ref = useRef<THREE.Group>(null!);
  useFrame((st) => {
    const g = ref.current; if (!g) return;
    g.position.y = groundY(grounds.current, x, z, 0);
    // rustle now and then (a clue for little seekers)
    const c = (st.clock.elapsedTime + z) % 5; const k = c > 3.4 ? Math.sin((c - 3.4) * 18) * 0.06 * Math.sin(((c - 3.4) / 1.6) * Math.PI) : 0;
    g.rotation.z = k; g.scale.setScalar(1 + Math.abs(k) * 0.6);
  });
  const blobs: [number, number, number, number, THREE.Material][] = [
    [0, 0.42, 0, 0.55, bushMat], [-0.45, 0.32, 0.12, 0.42, bushMat2], [0.45, 0.3, 0.05, 0.45, bushMat2], [0.1, 0.72, -0.1, 0.38, bushMat2], [-0.2, 0.25, 0.4, 0.33, bushMat],
  ];
  return (
    <group ref={ref} position={[x, 0, z]} name="HideBush">
      {blobs.map(([bx, by, bz, r, m], i) => <mesh key={i} geometry={bushGeo} material={m} position={[bx, by, bz]} scale={[r, r * 0.85, r]} castShadow receiveShadow />)}
    </group>
  );
}
function HiddenDwarf({ node, grounds }: { node: string; grounds: React.MutableRefObject<THREE.Object3D[]> }) {
  const obj = useModelPart(MODELS.dwarfs, node);
  const found = useGame((s) => s.found.includes(node));
  const tx = useTx();
  const ref = useRef<THREE.Group>(null!);
  const arms = useMemo(() => rigArms(obj), [obj]);
  const [dx, dz, ry, bx, bz] = HIDE_SPOTS[node];
  const hide = useMemo(() => new THREE.Vector3(pathX(dz) + dx, 0, dz), [dx, dz]);
  const out = useMemo(() => new THREE.Vector3(pathX(dz) + bx * 0.62, 0, bz + 0.9), [bx, bz, dz]); // hops out onto the path edge
  const pos = useMemo(() => hide.clone(), [hide]);
  useEffect(() => { npcPos[node] = pos; return () => { delete npcPos[node]; }; }, [node, pos]);
  useAct(`hide-${node}`, { icon: '🔍', label: T('찾았다! 누르기', 'Found you! Press'), r: FIND_R, pos: () => (found ? null : [hide.x, hide.z]), run: () => useGame.getState().findHidden(node) });
  useFrame((st) => {
    const g = ref.current; if (!g) return;
    const t = st.clock.elapsedTime;
    if (found) pos.lerp(out, 0.08); else pos.copy(hide);
    g.position.set(pos.x, groundY(grounds.current, pos.x, pos.z, 0), pos.z);
    const body = g.children[0];
    if (found) { // jump for joy
      body.position.y = Math.abs(Math.sin(t * 6)) * 0.25; body.rotation.z = 0; body.position.x = 0;
      const want = Math.atan2(player.pos.x - pos.x, player.pos.z - pos.z);
      g.rotation.y += Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)) * 0.1;
    } else {
      // crouched behind the bush; every few seconds peeks out sideways for a moment (a little clue!)
      const cyc = (t + dz) % 5; const peek = cyc > 3.6 ? Math.sin(((cyc - 3.6) / 1.4) * Math.PI) : 0;
      body.position.y = -0.28 + peek * 0.22;
      body.position.x = peek * 0.25 * (dx > 0 ? -1 : 1);
      body.rotation.z = peek * 0.3 * (dx > 0 ? 1 : -1);
      g.rotation.y = ry;
    }
    poseArms(arms, found ? 'cheer' : 'idle', t, 0.2, dz);
  });
  const name = DWARFS.find((d) => d.node === node)!.name;
  const tryFind = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const g = useGame.getState();
    if (Math.hypot(player.pos.x - hide.x, player.pos.z - hide.z) <= FIND_R + 0.4) g.findHidden(node);
    else { g.flash(T('저기 뭔가 있는 것 같아… 더 가까이 가 봐! 👀', 'Something is there… go closer! 👀')); g.moveTo(pathX(dz) + Math.sign(dx) * 2.2, dz + 0.6); }
  };
  return (
    <>
      {!found && <HideBush x={pathX(bz) + bx} z={bz} grounds={grounds} />}
      <group ref={ref} rotation={[0, ry, 0]} onClick={tryFind}
        onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
        <group scale={S * 0.62}><primitive object={obj} /></group>
        {found && <Html position={[0, 1.4, 0]} center style={{ pointerEvents: 'none' }}><div className="nametag">✨ {tx(name)}</div></Html>}
      </group>
    </>
  );
}

export function ForestScene() {
  const { forest, grounds } = useForest();
  const queen = useModelPart(MODELS.queen, 'Queen');
  const fired = useRef({ met: false, gate: false });
  const spawnKey = useGame((s) => s.spawnKey);
  const world = useMemo<World>(() => ({
    scale: S,
    speed: 3.6,
    spawn: [pathX(3), 0, 3],
    spawnRot: Math.PI, // face up the path (back to the camera, like a 3rd-person game: hair / ponytail visible)
    grounds,
    blocked: (x, z) => z > 11 || z < -37 || Math.abs(x - pathX(z)) > 3.4 || (useGame.getState().seek === 'off' && !escort.skip && inObstacle(x, z, 0.22)),
    autoRun: () => { const g = useGame.getState(); return g.seek === 'off' && g.swFollow && player.pos.z > -31 ? (escort.skip ? 5.5 : slowUntil.t > performance.now() ? 1.6 : 2.8) : null; },
    onBump: () => {
      const now = performance.now(); if (now - bumpAt.t < 1800) return; bumpAt.t = now;
      sfx('doorClose');
      useGame.getState().flash(T('앗, 막혔다! ← → 로 피해 가자!', 'Blocked! Steer ← → around it!'));
    },
    onStep: (p) => {
      const g = useGame.getState();
      if (g.running) {
        const pd = obPos.find((t) => t.kind === 'puddle' && Math.hypot(p.x - t.x, p.z - t.z) < t.r);
        if (pd && !escort.skip && slowUntil.t < performance.now()) { slowUntil.t = performance.now() + 1100; sfx('poof'); g.flash(T('첨벙! 💦 물웅덩이~', 'Splash! 💦 A puddle~')); }
      }
      // Story beat: the jealous Queen steps out onto the path with her magic mirror…
      if (g.seek !== 'off') { if (g.seek === 'done' && !fired.current.gate && p.z < -31 && !g.lines.length) { fired.current.gate = true; gateHint(); } return; }
      if (!g.talked['q1'] && g.metSnowWhite && p.z < -13 && !g.lines.length && !g.mini) {
        useGame.setState({ talked: { ...g.talked, q1: true }, target: null, pending: null });
        // she stops a few steps up the path talking to her mirror — the player overhears her (doesn't walk into you)
        const z1 = p.z - 3.4; walkNpc('Queen', [[pathX(z1) - 1.6, z1]], queenTalks, 2.2);
        const h = HEROES[g.hero];
        g.say([{ speaker: h.name, text: T('앗, 저기 무서운 왕비가 온다! 쉿… 나무 뒤에 숨어서 들어 보자!', "Oh! The wicked Queen is coming! Shh… let's hide behind a tree and listen!") }]);
      }
      // …and later appears once more to reveal her poison-apple plan, then vanishes
      if (!g.talked['q2'] && g.talked['q1'] && g.swFollow && p.z < -24 && !g.lines.length && !g.mini) {
        useGame.setState({ talked: { ...g.talked, q2: true }, target: null, pending: null });
        const q = npcPos.Queen; if (q) q.set(pathX(p.z - 6) - 2.4, q.y, p.z - 6); // she steps out of the trees just ahead
        const z2 = p.z - 3.4; walkNpc('Queen', [[pathX(z2) - 1.6, z2]], queenTalks, 2.4);
      }
      // (wait until the Queen has finished her poison-apple scene so it can't be skipped by walking past)
      if (!fired.current.gate && g.swFollow && p.z < -31 && !npcGoal.Queen && !g.lines.length && g.talked['qGone']) {
        fired.current.gate = true; gateHint();
      }
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [grounds, spawnKey]);

  const qGone = useGame((s) => !!s.talked['qGone']);
  // after her mirror scene she slips away into the trees until she comes back with the poison-apple plan
  const queenAway = useGame((s) => (s.beats['Queen'] ?? 0) >= 1 && !s.talked['q2'] && !s.lines.length);
  const seek = useGame((s) => s.seek);
  useFrame(() => {
    const g = useGame.getState();
    if (g.talked['q2'] && !g.talked['qGone'] && !g.lines.length && !npcGoal.Queen && (g.beats['Queen'] ?? 0) >= 2) {
      sfx('poof'); useGame.setState({ talked: { ...g.talked, qGone: true } });
    }
  });
  useEffect(() => () => { npcGoal.Queen = undefined; }, []);
  useAct('Queen', { icon: '🪞', label: T('왕비 엿듣기', 'Listen to the Queen'), r: 2.3, pos: () => (useGame.getState().talked['qGone'] || useGame.getState().seek !== 'off' ? null : npcPos.Queen ? [npcPos.Queen.x, npcPos.Queen.z] : [pathX(-21) - 2.4, -21]), run: () => useGame.getState().interact('Queen') });
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
      {seek === 'on' && HIDDEN.map((n) => <HiddenDwarf key={n} node={n} grounds={grounds} />)}
      <Npc object={queen} name="Queen" position={[pathX(-21) - 2.4, 0, -21]} rotY={0.6} scale={S} grounds={grounds} wander={1.2} speed={0.5} visible={!qGone && seek === 'off' && !queenAway}
        blocked={(x, z) => Math.abs(x - pathX(z)) > 3.3 || Math.abs(x - pathX(z)) < 1.2}
        onClick={(n) => { const q = npcPos.Queen; if (q) useGame.getState().moveTo(q.x + 1.2, q.z + 0.6, n); }} />
    </>
  );
}
