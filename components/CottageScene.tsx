'use client';
import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useGame, player, DWARFS, SPK, T, useTx, npcPos, walkNpc, npcGoal, HIDDEN, HEROES, SEEK_ASK } from './store';
import { useModel, useModelPart, MODELS, findNamed } from './models';
import { Player, Npc, World, Separation, sepCheck } from './Player';
import { Lights, FollowCam } from './common';
import { useAct, Act } from './touch';
import { cozyCottage, DINING_DX, BED_ZONE } from './cozy';

const S = 0.68; // character scale used in the Blender cottage render
const DWARF_S = S * 0.62;
const DOOR_Z = 1.2; // centre of the door opening (glTF z)

// interior layout (glTF metres): room x∈[-4,4], z∈[-3,3]; front wall cut away (dollhouse), door on the left wall.
const DWARF_SPOTS: Record<string, [number, number, number]> = {
  Doc: [3.0, -0.3, -0.9],
  Grumpy: [3.1, 1.75, -1.2],
  Happy: [1.75, 2.05, 0.2],
  Sleepy: [-1.45, -2.3, 0],
  Bashful: [-0.2, -2.3, 0],
  Sneezy: [1.0, -2.3, 0],
  Dopey: [-1.75, 2.15, 1.2],
};
const AISLE_X = -1.6; // walkway between the beds (left wall) and the dining set
/** Route from a dwarf's spot to the front of the door, around the table / beds / fireplace. */
function routeToDoor(x: number, z: number): [number, number][] {
  const r: [number, number][] = [];
  if (z < -0.8) { r.push([x, -1.95]); r.push([AISLE_X, -1.95]); r.push([AISLE_X, 1.3]); }
  else r.push([x, 1.3]);
  r.push([-2.9, 1.3], [-2.9, DOOR_Z]);
  return r;
}

/** Dollhouse camera: wide establishing shot outside, closer follow shot once the player is inside. */
const _cp = new THREE.Vector3(), _cl = new THREE.Vector3();
function cottageCam(p: THREE.Vector3) {
  const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6;
  const back = aspect < 1 ? 1.25 / Math.max(aspect, 0.45) : 1; // portrait phones: pull back a little
  if (p.x > -3.6 && p.x < 3.6 && p.z > -2.6 && p.z < 2.75) {
    const portrait = aspect < 1;
    const cx = THREE.MathUtils.clamp(p.x, -2.6, 2.6) * (portrait ? 0.95 : 0.75);
    if (portrait) _cp.set(cx, 7.6, 9.0); else _cp.set(cx, 4.5, 7.4);
    _cl.set(cx, 0.75, THREE.MathUtils.clamp(p.z, -2, 2) * 0.35 - 0.2);
  } else {
    // front-left three-quarter view so the door on the left wall, the old woman and the room are all visible
    const lx = aspect < 1 ? (p.x - 4.2) / 2 : -3.4 + (p.x + 6.4) * 0.3; // portrait: keep the player on screen
    _cp.set(lx - 5.8 - 1.5 * back, 4.2 + back, 6.6 + 3.2 * back);
    _cl.set(lx, 1.0, 0.6);
  }
  return { pos: _cp.clone(), look: _cl.clone() };
}

const isInteractive = (n: string) => /^(Door|Chair\d|Apple)$/.test(n);

function blocked(x: number, z: number) {
  const g = useGame.getState();
  if (x < -10 || x > 10 || z < -9 || z > 9) return true;
  const inFoot = x > -4.1 && x < 4.1 && z > -3.1 && z < 3.1;
  if (!inFoot) return false;
  const interior = x > -3.62 && x < 3.62 && z > -2.6 && z < 2.7;
  if (interior) {
    if (x > -2.05 + DINING_DX && x < 1.45 + DINING_DX && z > -0.98 && z < 0.4) return true; // table
    if (x < BED_ZONE.x && z < BED_ZONE.z) return true; // beds along the left wall
    if (x > 1.45 && x < 3.35 && z < -2.0) return true; // fireplace
    return false;
  }
  // in a wall band: only the open door lets you through
  if (x < -3.4 && Math.abs(z - DOOR_Z) < 0.5 && g.doorOpen) return false;
  return true;
}

/** NPCs stay off the table and out of the walls / doorway (and don't block the player). */
function npcBlocked(x: number, z: number) {
  if (blocked(x, z)) return true;
  if (x < -3.4 && x > -4.4) return true; // doorway
  return !sepCheck.on && Math.hypot(player.pos.x - x, player.pos.z - z) < 0.6;
}

/** Warm, gently flickering light from the fireplace. */
function FireGlow() {
  const ref = useRef<THREE.PointLight>(null!);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    if (ref.current) ref.current.intensity = 3.2 + Math.sin(t * 9) * 0.35 + Math.sin(t * 23 + 1) * 0.25;
  });
  return <pointLight ref={ref} position={[2.4, 0.95, -1.75]} intensity={3.2} distance={5} decay={1.8} color="#ff9a4a" />;
}

export function CottageScene() {
  const cottage = useModel(MODELS.cottage);
  const grounds = useRef<THREE.Object3D[]>([]);
  const dwarfs = DWARFS.map((d) => ({ ...d, obj: useModelPart(MODELS.dwarfs, d.node) })); // eslint-disable-line react-hooks/rules-of-hooks
  const snow = useModelPart(MODELS.snowwhite, 'SnowWhite');
  const oldWoman = useModelPart(MODELS.queen, 'OldWoman');
  const doorOpen = useGame((s) => s.doorOpen);
  const apple = useGame((s) => s.apple);
  const queenGone = useGame((s) => s.queenGone);
  const sitting = useGame((s) => s.sitting);
  const dwarfState = useGame((s) => s.dwarfs);
  const sleeping = useGame((s) => s.sleeping);
  const seek = useGame((s) => s.seek);
  const spawnKey = useGame((s) => s.spawnKey);
  const hasLine = useGame((s) => s.lines.length > 0);
  const hover = useRef<THREE.Object3D | null>(null);
  const tx = useTx();

  const { door, appleNode, chairs } = useMemo(() => {
    cozyCottage(cottage);
    grounds.current = ['Ground', 'Floor', 'Rug', 'DoorPath'].map((n) => cottage.getObjectByName(n)).filter(Boolean) as THREE.Object3D[];
    const chairs: Record<string, THREE.Object3D> = {};
    for (let i = 1; i <= 7; i++) { const c = cottage.getObjectByName(`Chair${i}`); if (c) chairs[`Chair${i}`] = c; }
    cottage.traverse((o) => { if (/^(Ground|Rug|Floor)/.test(o.name)) (o as THREE.Mesh).castShadow = false; });
    return { door: cottage.getObjectByName('Door')!, appleNode: cottage.getObjectByName('Apple')!, chairs };
  }, [cottage]);

  const world = useMemo<World>(() => ({
    scale: S,
    speed: 2.6,
    spawn: [-6.4, 0, DOOR_Z],
    spawnRot: Math.PI / 2,
    grounds,
    blocked,
    seat: (name) => {
      const c = chairs[name]; if (!c) return null;
      c.updateWorldMatrix(true, false);
      const pos = new THREE.Vector3(0, 0.62, 0).applyMatrix4(c.matrixWorld);
      return { pos, quat: c.getWorldQuaternion(new THREE.Quaternion()) };
    },
    onStep: (p) => {
      // inside the cottage: the dwarfs wave — the welcome chat starts when the player talks to one of them
      const g = useGame.getState();
      if (p.x > -3.0 && !g.talked['welcome'] && !g.talked['inside']) {
        useGame.setState({ talked: { ...g.talked, inside: true }, hint: T('💬 난쟁이에게 가까이 가서 말하기 버튼을 눌러 봐!', '💬 Walk up to a dwarf and press the Talk button!') });
      }
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [chairs, spawnKey]);

  // door hinge animation (Blender Z rotation == glTF Y rotation)
  useFrame((st) => {
    if (door) door.rotation.y = THREE.MathUtils.lerp(door.rotation.y, doorOpen ? THREE.MathUtils.degToRad(100) : 0 /* swings OUTWARD so the open door never blocks the room view */, 0.08);
    if (appleNode) {
      appleNode.visible = apple === 'table';
      const pulse = apple === 'table' ? 1 + Math.sin(st.clock.elapsedTime * 4) * 0.08 : 1;
      appleNode.scale.setScalar(pulse);
    }
    const h = hover.current;
    Object.values(chairs).forEach((c) => (c.scale.setScalar(c === h && !sitting ? 1.06 : 1)));
  });

  // action button (🅰 / Space): use whatever is within reach
  useAct('Door', { icon: '🚪', label: T('문 열기/닫기', 'Open / close door'), r: 1.6, pos: () => [player.pos.x < -3.9 ? -4.6 : -3.2, DOOR_Z], run: () => useGame.getState().interact('Door') });
  useAct('Apple', { icon: '🍎', label: T('사과 집기', 'Pick up apple'), r: 1.5, pos: () => (useGame.getState().apple === 'table' ? [-0.9 + DINING_DX, 0.85] : null), run: () => useGame.getState().interact('Apple') });
  Object.keys(chairs).forEach((name) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAct(name, { icon: '🪑', label: T('의자에 앉기', 'Sit down'), r: 0.95, pos: () => { const wp = chairs[name].getWorldPosition(new THREE.Vector3()); return [wp.x, wp.z]; }, run: () => useGame.getState().interact(name) });
  });
  DWARFS.forEach((d) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAct(d.node, { icon: '💬', label: T(`${d.name.ko}와 이야기하기`, `Talk to ${d.name.en}`), r: 1.5, pos: () => (useGame.getState().dwarfs !== 'home' || (useGame.getState().seek !== 'done' && HIDDEN.includes(d.node)) ? null : npcPos[d.node] ? [npcPos[d.node].x, npcPos[d.node].z] : [DWARF_SPOTS[d.node][0], DWARF_SPOTS[d.node][1]]), run: () => useGame.getState().interact(d.node) } as Act);
  });
  useAct('SnowWhiteHome', { icon: '💬', label: T('백설공주와 이야기하기', 'Talk to Snow White'), r: 1.4, pos: () => (npcPos.SnowWhiteHome ? [npcPos.SnowWhiteHome.x, npcPos.SnowWhiteHome.z] : [-0.4, 1.7]), run: () => useGame.getState().interact('SnowWhiteHome') });
  useAct('OldWoman', { icon: '💬', label: T('할머니와 이야기하기', 'Talk to the old woman'), r: 1.8, pos: () => (useGame.getState().queenGone || (useGame.getState().dwarfs !== 'away' && useGame.getState().apple === 'hidden') ? null : npcPos.OldWoman ? [npcPos.OldWoman.x, npcPos.OldWoman.z] : [-6.2, -1.6]), run: () => useGame.getState().interact('OldWoman') });

  // conversation staging: if the NPC you talk to stands in front of / behind you (as seen from the dollhouse
  // camera), step beside them so the two-shot shows both faces side by side instead of one hiding the other
  useFrame(() => {
    const g = useGame.getState();
    const n = g.lines.length && g.talker ? npcPos[g.talker] : null;
    if (!n || g.sitting || g.sleeping) return;
    const p = player.pos;
    if (Math.hypot(n.x - p.x, n.z - p.z) > 2.4 || (Math.abs(n.x - p.x) > 0.85 && Math.abs(n.z - p.z) < 0.45)) return; // already side by side
    const sx = p.x >= n.x ? 1 : -1;
    let tx = n.x + sx * 0.95;
    if (blocked(tx, n.z)) tx = n.x - sx * 0.95;
    if (blocked(tx, n.z)) return;
    p.x += (tx - p.x) * 0.15; p.z += (n.z - p.z) * 0.15;
  });

  // ---- story director: dwarfs leave for the mine → the disguised Queen comes to Snow White → dwarfs come home
  const welcomeAt = useRef<number | null>(null);
  useFrame((st) => {
    const g = useGame.getState();
    if (g.talked['welcome'] && welcomeAt.current === null && !g.lines.length) welcomeAt.current = st.clock.elapsedTime;
    if (g.dwarfs !== 'home' || g.apple !== 'hidden' || g.lines.length || welcomeAt.current === null) return;
    const chats = DWARFS.filter((d) => g.talked[d.node]).length;
    const waited = st.clock.elapsedTime - welcomeAt.current;
    if ((g.talked['sat'] && (chats >= 2 || waited > 25)) || chats >= 3 || waited > 45) g.dwarfsLeave();
  });
  useEffect(() => {
    if (dwarfState === 'leaving') {
      let left = DWARFS.length;
      DWARFS.forEach((d, i) => {
        const p = npcPos[d.node]; const z = p ? p.z : DWARF_SPOTS[d.node][1];
        const x = p ? p.x : DWARF_SPOTS[d.node][0];
        setTimeout(() => walkNpc(d.node, [...routeToDoor(x, z), [-4.75, DOOR_Z], [-8.5 - i * 0.4, DOOR_Z + 0.4]], () => {
          if (--left === 0) useGame.setState({ dwarfs: 'away', doorOpen: true });
        }, 1.7), i * 350);
      });
    }
    if (dwarfState === 'away') {
      // the "old woman" (the Queen in disguise) walks in through the door straight to Snow White
      const sw = npcPos.SnowWhiteHome;
      const ow = npcPos.OldWoman; if (ow) ow.set(-9.5, ow.y, DOOR_Z);
      walkNpc('OldWoman', [[-5.6, DOOR_Z], [-4.75, DOOR_Z], [-3.0, DOOR_Z], sw ? [sw.x - 1.1, Math.max(1.0, sw.z)] : [-1.5, 1.7]], () => useGame.getState().oldWomanArrives(), 1.3);
    }
    if (dwarfState === 'returning') {
      let left = DWARFS.length;
      DWARFS.forEach((d, i) => {
        const p = npcPos[d.node]; if (p) p.set(-8.5 - i * 0.4, 0.2, DOOR_Z + 0.4);
        const [hx, hz] = DWARF_SPOTS[d.node];
        setTimeout(() => walkNpc(d.node, [[-4.75, DOOR_Z], ...routeToDoor(hx, hz).reverse(), [hx, hz]], () => {
          if (--left === 0) useGame.setState({ dwarfs: 'home' });
        }, 2.2), 600 + i * 300);
      });
    }
  }, [dwarfState]);
  useEffect(() => () => { DWARFS.forEach((d) => (npcGoal[d.node] = undefined)); npcGoal.OldWoman = undefined; }, []);

  const approach = (name: string): [number, number] => {
    if (name === 'Door') return player.pos.x < -3.9 ? [-4.75, DOOR_Z] : [-3.05, DOOR_Z];
    if (name === 'Apple') return [-0.9 + DINING_DX, 0.85];
    const c = chairs[name];
    if (c) {
      const wp = c.getWorldPosition(new THREE.Vector3());
      const q = c.getWorldQuaternion(new THREE.Quaternion());
      const out = new THREE.Vector3(0, 0, 1).applyQuaternion(q); // away from the table (glTF +Z of a 0° chair)
      return [wp.x + out.x * 0.55 + 0.35, wp.z + out.z * 0.55];
    }
    return [player.pos.x, player.pos.z];
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const g = useGame.getState();
    let hit = findNamed(e.object, isInteractive);
    // the door is thin and sits inside the wall: also accept taps on its frame / the wall right around it
    if (!hit && e.point.x < -3.3 && e.point.y < 3.0 && Math.abs(e.point.z - DOOR_Z) < 1.7 && /^(Door|Wall_?\.?Left|Corner)/.test(e.object.name)) hit = door;
    if (hit) {
      const [x, z] = approach(hit.name);
      if (Math.hypot(player.pos.x - x, player.pos.z - z) < 0.6 || (hit.name === 'Door' && Math.abs(player.pos.x + 3.9) < 1.3 && Math.abs(player.pos.z - DOOR_Z) < 0.9)) g.interact(hit.name);
      else g.moveTo(x, z, hit.name);
      return;
    }
    g.moveTo(e.point.x, e.point.z);
  };

  const talkTo = (name: string, home: [number, number, number]) => {
    const live = npcPos[name]; const pos: [number, number, number] = live ? [live.x, live.y, live.z] : home;
    const dir = new THREE.Vector3(player.pos.x - pos[0], 0, player.pos.z - pos[2]).normalize();
    useGame.getState().moveTo(pos[0] + dir.x * 0.9, pos[2] + dir.z * 0.9, name);
  };

  // automation/debug hook: screen position of a named object (used by the screenshot/demo script)
  const { camera, size, scene } = useThree();
  useEffect(() => {
    const w = window as unknown as { __snow: Record<string, unknown> };
    w.__snow.where = (name: string) => {
      const o = scene.getObjectByName(name); if (!o) return null;
      const v = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).project(camera);
      return { x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height };
    };
  }, [camera, size, scene]);

  const applePos = appleNode ? appleNode.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(-1.2, 1.12, 0.05);

  return (
    <>
      <color attach="background" args={['#f8ecd9']} />
      <fog attach="fog" args={['#f6eddc', 22, 60]} />
      <Lights sun={[6, 12, 9]} range={11} intensity={2.1} ground="#b08a62" />
      <pointLight position={[0, 2.9, 0.4]} intensity={5} distance={9} decay={1.6} color="#ffd9a8" />
      <FireGlow />
      <FollowCam charH={1.65} occluders={/^Chair\d$/} offset={[0, 0, 0]} look={[0, 0, 0]} lerp={0.06} fixed={cottageCam} room={{ x: [-3.3, 3.3], frontZ: 3.6, maxY: 3.3 }} />
      <primitive object={cottage} onClick={onClick}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          const h = findNamed(e.object, isInteractive); hover.current = h;
          document.body.style.cursor = h ? 'pointer' : '';
        }} />
      {apple === 'table' && (
        <Html position={[applePos.x, applePos.y + 0.45, applePos.z]} center style={{ pointerEvents: 'none' }}>
          <div className="sparkle">✨</div>
        </Html>
      )}
      {!doorOpen && (
        <Html position={[-4.1, 2.9, DOOR_Z]} center style={{ pointerEvents: 'none' }}>
          <div className="bubble">{tx(T('🚪 여기가 문이야!', '🚪 Here is the door!'))}</div>
        </Html>
      )}
      <Player world={world} />
      {dwarfs.map((d) => (
        <Npc key={d.node} object={d.obj} name={d.node} position={[DWARF_SPOTS[d.node][0], 0.2, DWARF_SPOTS[d.node][1]]}
          rotY={DWARF_SPOTS[d.node][2]} scale={DWARF_S} label={tx(d.name)} wander={dwarfState === 'home' ? 0.7 : 0} blocked={npcBlocked}
          visible={dwarfState !== 'away' && (seek === 'done' || !HIDDEN.includes(d.node))} grounds={grounds} bubble={dwarfState === 'leaving' && !hasLine ? tx(T('⛏️ ♪ 하이호~', '⛏️ ♪ Heigh-ho~')) : null} onClick={(n) => dwarfState === 'home' && talkTo(n, [DWARF_SPOTS[n][0], 0.2, DWARF_SPOTS[n][1]])} />
      ))}
      <Npc object={snow} name="SnowWhiteHome" position={[-0.4, 0.2, 1.7]} rotY={Math.PI} scale={S * 1.02} wander={sleeping ? 0 : 0.6} blocked={npcBlocked} asleep={sleeping} grounds={grounds}
        onClick={(n) => talkTo(n, [-0.4, 0.2, 1.7])} />
      <Npc object={oldWoman} name="OldWoman" position={[-9.5, 0, DOOR_Z]} rotY={1.2} scale={S} visible={!queenGone && (dwarfState === 'away' || apple !== 'hidden')} wander={0} blocked={npcBlocked} speed={0.5} grounds={grounds}
        label={tx(T('할머니', 'Old woman'))} onClick={(n) => !queenGone && talkTo(n, [-6.2, 0, -1.6])} />
      <Separation playerR={0.28} />
    </>
  );
}
