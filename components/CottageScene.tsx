'use client';
import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useGame, player, DWARFS } from './store';
import { useModel, useModelPart, MODELS, findNamed } from './models';
import { Player, Npc, World } from './Player';
import { Lights, FollowCam } from './common';

const S = 0.68; // character scale used in the Blender cottage render
const DWARF_S = S * 0.62;
const DOOR_Z = 1.2; // centre of the door opening (glTF z)

// interior layout (glTF metres): room x∈[-4,4], z∈[-3,3]; front wall cut away (dollhouse), door on the left wall.
const DWARF_SPOTS: Record<string, [number, number, number]> = {
  Doc: [2.9, -2.0, -0.6],
  Grumpy: [3.1, 1.75, -1.2],
  Happy: [1.55, 2.0, 0.2],
  Sleepy: [-1.7, -2.2, 0],
  Bashful: [-0.45, -2.25, 0],
  Sneezy: [0.85, -2.25, 0],
  Dopey: [-2.75, -0.55, 1.2],
};

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
    if (x > -2.05 && x < 1.45 && z > -0.98 && z < 0.4) return true; // table
    return false;
  }
  // in a wall band: only the open door lets you through
  if (x < -3.4 && Math.abs(z - DOOR_Z) < 0.5 && g.doorOpen) return false;
  return true;
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
  const spawnKey = useGame((s) => s.spawnKey);
  const hover = useRef<THREE.Object3D | null>(null);

  const { door, appleNode, chairs } = useMemo(() => {
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
      const g = useGame.getState();
      if (p.x > -3.0 && !g.talked['welcome']) {
        useGame.setState({ talked: { ...g.talked, welcome: true }, target: null, pending: null });
        g.say([
          { speaker: '박사', text: '오호! 손님이 왔구나! 일곱 난쟁이의 집에 온 걸 환영해!' },
          { speaker: '백설공주', text: '우리 의자에 앉아서 같이 쉬자. 난쟁이들한테 말을 걸어 봐도 좋아!' },
        ]);
      }
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [chairs, spawnKey]);

  // door hinge animation (Blender Z rotation == glTF Y rotation)
  useFrame((st) => {
    if (door) door.rotation.y = THREE.MathUtils.lerp(door.rotation.y, doorOpen ? THREE.MathUtils.degToRad(-100) : 0, 0.08);
    if (appleNode) {
      appleNode.visible = apple === 'table';
      const pulse = apple === 'table' ? 1 + Math.sin(st.clock.elapsedTime * 4) * 0.08 : 1;
      appleNode.scale.setScalar(pulse);
    }
    const h = hover.current;
    Object.values(chairs).forEach((c) => (c.scale.setScalar(c === h && !sitting ? 1.06 : 1)));
  });

  const approach = (name: string): [number, number] => {
    if (name === 'Door') return player.pos.x < -3.9 ? [-4.75, DOOR_Z] : [-3.05, DOOR_Z];
    if (name === 'Apple') return [-0.9, 0.85];
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

  const talkTo = (name: string, pos: [number, number, number]) => {
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
      <Lights sun={[6, 12, 9]} range={11} intensity={2.3} />
      <pointLight position={[0, 2.8, 0]} intensity={6} distance={9} color="#ffdcae" />
      <FollowCam offset={[0, 0, 0]} look={[0, 0, 0]} lerp={0.06} fixed={cottageCam} />
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
          <div className="bubble">문을 눌러 봐! 🚪</div>
        </Html>
      )}
      <Player world={world} />
      {dwarfs.map((d) => (
        <Npc key={d.node} object={d.obj} name={d.node} position={[DWARF_SPOTS[d.node][0], 0.2, DWARF_SPOTS[d.node][1]]}
          rotY={DWARF_SPOTS[d.node][2]} scale={DWARF_S} label={d.ko} onClick={(n) => talkTo(n, [DWARF_SPOTS[n][0], 0.2, DWARF_SPOTS[n][1]])} />
      ))}
      <Npc object={snow} name="SnowWhiteHome" position={[3.05, 0.2, 0.35]} rotY={-1.4} scale={S * 1.02}
        onClick={() => useGame.getState().say([{ speaker: '백설공주', text: '난쟁이들 집은 정말 아늑하다! 같이 앉을래?' }])} />
      <Npc object={oldWoman} name="OldWoman" position={[-6.2, 0, -1.6]} rotY={1.2} scale={S} visible={!queenGone}
        label="할머니" onClick={(n) => !queenGone && talkTo(n, [-6.2, 0, -1.6])} />
    </>
  );
}
