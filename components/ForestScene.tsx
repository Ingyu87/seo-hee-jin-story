'use client';
import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { useGame, player, HIDDEN, DWARFS, HEROES, SPK, useTx, npcPos, walkNpc, npcGoal } from './store';
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

function SnowWhite({ grounds }: { grounds: React.MutableRefObject<THREE.Object3D[]> }) {
  const obj = useModelPart(MODELS.snowwhite, 'SnowWhite');
  const ref = useRef<THREE.Group>(null!);
  const follow = useGame((s) => s.swFollow);
  const start = useMemo(() => new THREE.Vector3(pathX(-5) + 1.3, 0, -5), []);
  const pos = useRef(start.clone());
  const t = useRef(0);
  const arms = useMemo(() => rigArms(obj), [obj]);
  const roam = useRef({ target: null as THREE.Vector3 | null, wait: 2, idle: 0 });
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
      if (d.length() > 0.3) {
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
        if (dist < 2.3 || (r.idle > 4 && dist < 2.6)) { gs0.interact('SnowWhite'); useGame.setState({ target: null, pending: null }); }
        else if (r.idle > 4) {
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
    g.children[0].position.y = moving ? Math.abs(Math.sin(t.current * 11)) * 0.07 : Math.abs(Math.sin(t.current * 1.6)) * 0.02;
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

/** Hide-and-seek: three dwarfs peek out from behind trees beside the path. Tap them to find them. */
const HIDE_SPOTS: Record<string, [number, number, number]> = {
  Dopey: [3.0, -9, -1.2],
  Bashful: [-3.1, -16.5, 1.4],
  Sneezy: [2.9, -25, -1.0],
};
function HiddenDwarf({ node, grounds }: { node: string; grounds: React.MutableRefObject<THREE.Object3D[]> }) {
  const obj = useModelPart(MODELS.dwarfs, node);
  const found = useGame((s) => s.found.includes(node));
  const tx = useTx();
  const ref = useRef<THREE.Group>(null!);
  const arms = useMemo(() => rigArms(obj), [obj]);
  const [dx, dz, ry] = HIDE_SPOTS[node];
  const pos = useMemo(() => new THREE.Vector3(pathX(dz) + dx, 0, dz), [dx, dz]);
  useEffect(() => { npcPos[node] = pos; return () => { delete npcPos[node]; }; }, [node, pos]);
  useAct(`hide-${node}`, { icon: '🔍', label: T('찾았다! 누르기', 'Found you! Press'), r: 2.6, pos: () => (found ? null : [pos.x, pos.z]), run: () => useGame.getState().findHidden(node) });
  useFrame((st) => {
    const g = ref.current; if (!g) return;
    const t = st.clock.elapsedTime;
    g.position.set(pos.x, groundY(grounds.current, pos.x, pos.z, 0), pos.z);
    // peeking: lean in and out from behind the tree until found, then jump for joy
    g.children[0].position.y = found ? Math.abs(Math.sin(t * 6)) * 0.25 : 0;
    g.children[0].rotation.z = found ? 0 : Math.sin(t * 1.3 + dz) * 0.35;
    poseArms(arms, found ? 'cheer' : 'idle', t, 0.2, dz);
  });
  const name = DWARFS.find((d) => d.node === node)!.name;
  return (
    <group ref={ref} rotation={[0, ry, 0]}
      onClick={(e) => { e.stopPropagation(); useGame.getState().findHidden(node); }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
      <group scale={S * 0.62}><primitive object={obj} /></group>
      {found && <Html position={[0, 1.4, 0]} center style={{ pointerEvents: 'none' }}><div className="nametag">✨ {tx(name)}</div></Html>}
    </group>
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
    blocked: (x, z) => z > 11 || z < -37 || Math.abs(x - pathX(z)) > 3.4,
    onStep: (p) => {
      const g = useGame.getState();
      // Story beat: the jealous Queen steps out onto the path with her magic mirror…
      if (g.seek !== 'off') { if (g.seek === 'done' && !fired.current.gate && p.z < -31 && !g.lines.length) { fired.current.gate = true; g.interact('CottageGate'); } return; }
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
        const q = npcPos.Queen; if (q && q.distanceTo(p) > 9) q.set(p.x - 2.6, q.y, p.z - 3);
        const z2 = p.z - 3.4; walkNpc('Queen', [[pathX(z2) - 1.6, z2]], queenTalks, 2.4);
      }
      // (wait until the Queen has finished her poison-apple scene so it can't be skipped by walking past)
      if (!fired.current.gate && g.swFollow && p.z < -31 && !npcGoal.Queen && !g.lines.length && (!g.talked['q2'] || g.talked['qGone'])) {
        fired.current.gate = true; useGame.setState({ target: null, pending: null }); g.interact('CottageGate');
      }
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [grounds, spawnKey]);

  const qGone = useGame((s) => !!s.talked['qGone']);
  const seek = useGame((s) => s.seek);
  useFrame(() => {
    const g = useGame.getState();
    if (g.talked['q2'] && !g.talked['qGone'] && !g.lines.length && !npcGoal.Queen && (g.beats['Queen'] ?? 0) >= 2) {
      sfx('poof'); useGame.setState({ talked: { ...g.talked, qGone: true } });
    }
  });
  useEffect(() => () => { npcGoal.Queen = undefined; }, []);
  useAct('Queen', { icon: '🪞', label: T('왕비 엿듣기', 'Listen to the Queen'), r: 2.3, pos: () => (useGame.getState().talked['qGone'] || useGame.getState().seek !== 'off' ? null : npcPos.Queen ? [npcPos.Queen.x, npcPos.Queen.z] : [pathX(-21) - 2.4, -21]), run: () => useGame.getState().interact('Queen') });
  useAct('CottageGate', { icon: '🏠', label: T('오두막에 들어가기', 'Enter the cottage'), r: 4, pos: () => (useGame.getState().swFollow || useGame.getState().seek === 'done' ? [pathX(-33), -33] : null), run: () => useGame.getState().interact('CottageGate') });

  const onGround = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    useGame.getState().moveTo(e.point.x, e.point.z);
  };

  return (
    <>
      <color attach="background" args={['#f7e9d6']} />
      <fog attach="fog" args={['#f3ead9', 18, 70]} />
      <Lights sun={[7, 12, 5]} range={12} />
      <FollowCam offset={[0, 3.1, 6.2]} look={[0, 1.2, -1.5]} />
      <primitive object={forest} onClick={onGround} />
      <Player world={world} />
      {seek === 'off' && <SnowWhite grounds={grounds} />}
      {seek === 'on' && HIDDEN.map((n) => <HiddenDwarf key={n} node={n} grounds={grounds} />)}
      <Npc object={queen} name="Queen" position={[pathX(-21) - 2.4, 0, -21]} rotY={0.6} scale={S} grounds={grounds} wander={1.2} speed={0.5} visible={!qGone && seek === 'off'}
        blocked={(x, z) => Math.abs(x - pathX(z)) > 3.3 || Math.abs(x - pathX(z)) < 1.2}
        onClick={(n) => { const q = npcPos.Queen; if (q) useGame.getState().moveTo(q.x + 1.2, q.z + 0.6, n); }} />
    </>
  );
}
