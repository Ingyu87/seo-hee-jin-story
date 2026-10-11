'use client';
import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useGame, player, HEROES } from './store';
import { useModel } from './models';
import { sfx } from './audio';

export type World = {
  scale: number;
  speed: number;
  spawn: [number, number, number];
  spawnRot: number;
  blocked: (x: number, z: number) => boolean;
  grounds: React.MutableRefObject<THREE.Object3D[]>;
  seat?: (name: string) => { pos: THREE.Vector3; quat: THREE.Quaternion } | null;
  onStep?: (pos: THREE.Vector3) => void;
};

const keys: Record<string, boolean> = {};
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => (keys[e.key.toLowerCase()] = true));
  window.addEventListener('keyup', (e) => (keys[e.key.toLowerCase()] = false));
}

const ray = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0, -1, 0);

export function groundY(grounds: THREE.Object3D[], x: number, z: number, fallback: number) {
  if (!grounds.length) return fallback;
  ray.set(new THREE.Vector3(x, 12, z), DOWN);
  const hit = ray.intersectObjects(grounds, true)[0];
  return hit ? hit.point.y : fallback;
}

/** Wrap leg/shoe nodes of an ACNH-style kid in a hip pivot so the kid can sit with legs forward. */
function rigLegs(root: THREE.Object3D) {
  const charRoot = root.getObjectByName('CharPivot') ?? root;
  const legs: THREE.Object3D[] = [];
  charRoot.children.forEach((c) => /(Leg|Shoe)/.test(c.name) && legs.push(c));
  const box = new THREE.Box3();
  legs.filter((l) => /Leg/.test(l.name)).forEach((l) => box.expandByObject(l));
  const hipY = box.isEmpty() ? 0.5 : box.max.y - 0.05;
  const hip = new THREE.Group();
  hip.name = 'HipPivot';
  hip.position.set(0, hipY, 0);
  charRoot.add(hip);
  root.updateMatrixWorld(true);
  legs.forEach((l) => hip.attach(l));
  return { hip, hipY };
}

export function Player({ world }: { world: World }) {
  const hero = useGame((s) => s.hero);
  const model = useModel(HEROES[hero].model);
  const appleModel = useModel('/models/cottage.glb', false);
  const outer = useRef<THREE.Group>(null!);
  const inner = useRef<THREE.Group>(null!);
  const rig = useMemo(() => rigLegs(model), [model]);
  const apple = useMemo(() => {
    const a = appleModel.getObjectByName('Apple');
    const g = new THREE.Group();
    if (a) { const c = a.clone(true); c.position.set(0, 0, 0); g.add(c); }
    return g;
  }, [appleModel]);
  const sleeping = useGame((s) => s.sleeping);
  const appleState = useGame((s) => s.apple);
  const taps = useGame((s) => s.taps);
  const spawnKey = useGame((s) => s.spawnKey);
  const t0 = useRef(0);
  const stepT = useRef(0);

  useEffect(() => {
    const [x, y, z] = world.spawn;
    player.pos.set(x, y, z);
    player.rotY = world.spawnRot;
  }, [spawnKey, world]);

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.2);
    const g = useGame.getState();
    const p = player.pos;
    let dx = 0, dz = 0;
    const kx = (keys['arrowright'] || keys['d'] ? 1 : 0) - (keys['arrowleft'] || keys['a'] ? 1 : 0);
    const kz = (keys['arrowdown'] || keys['s'] ? 1 : 0) - (keys['arrowup'] || keys['w'] ? 1 : 0);
    const locked = g.sleeping || g.lines.length > 0 || !!g.mini;
    if (!locked && (kx || kz)) {
      if (g.sitting) g.standUp();
      if (g.target) useGame.setState({ target: null, pending: null });
      dx = kx; dz = kz;
    } else if (!locked && g.target && !g.sitting) {
      dx = g.target[0] - p.x; dz = g.target[1] - p.z;
      const d = Math.hypot(dx, dz);
      const stopAt = g.pending ? 0.2 : 0.08;
      if (d < stopAt) { dx = dz = 0; g.arrive(); }
    }
    const len = Math.hypot(dx, dz);
    player.moving = len > 0.001;
    if (player.moving) {
      const step = Math.min(world.speed * dt, len);
      const nx = p.x + (dx / len) * step, nz = p.z + (dz / len) * step;
      if (!world.blocked(nx, nz)) { p.x = nx; p.z = nz; }
      else if (!world.blocked(nx, p.z)) p.x = nx;
      else if (!world.blocked(p.x, nz)) p.z = nz;
      else if (g.target) useGame.setState({ target: null, pending: null });
      const want = Math.atan2(dx, dz);
      let diff = want - player.rotY;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      player.rotY += diff * Math.min(1, dt * 12);
      world.onStep?.(p);
      stepT.current += dt;
      if (stepT.current > 0.32) { stepT.current = 0; sfx('step'); }
    } else stepT.current = 0.25;
    p.y = groundY(world.grounds.current, p.x, p.z, p.y);

    const o = outer.current, i = inner.current;
    t0.current += dt;
    const seat = g.sitting && world.seat ? world.seat(g.sitting) : null;
    if (seat) {
      o.position.copy(seat.pos).add(new THREE.Vector3(0, -rig.hipY * world.scale, 0));
      const e = new THREE.Euler().setFromQuaternion(seat.quat, 'YXZ');
      o.rotation.set(0, e.y + Math.PI, 0);
      player.rotY = e.y + Math.PI;
      rig.hip.rotation.x = THREE.MathUtils.lerp(rig.hip.rotation.x, -Math.PI / 2, 0.25);
      i.position.y = 0; i.rotation.set(0, 0, 0);
    } else {
      rig.hip.rotation.x = THREE.MathUtils.lerp(rig.hip.rotation.x, player.moving ? Math.sin(t0.current * 12) * 0.25 : 0, 0.3);
      o.position.copy(p);
      o.rotation.set(0, player.rotY, 0);
      if (g.sleeping) {
        i.rotation.set(0, 0, THREE.MathUtils.lerp(i.rotation.z, Math.PI / 2, 0.08));
        i.position.y = 0.45 * world.scale;
      } else {
        i.rotation.z = THREE.MathUtils.lerp(i.rotation.z, player.moving ? Math.sin(t0.current * 12) * 0.06 : 0, 0.3);
        i.rotation.x = 0;
        i.position.y = player.moving ? Math.abs(Math.sin(t0.current * 12)) * 0.08 * world.scale : Math.sin(t0.current * 2) * 0.01;
      }
    }
  });

  return (
    <group ref={outer}>
      <group ref={inner} scale={world.scale}>
        <primitive object={model} />
        {appleState === 'held' && <primitive object={apple} position={[0.05, 1.15, 0.55]} scale={1.6} />}
      </group>
      {sleeping && (
        <Html position={[0, 1.6 * world.scale, 0]} center>
          <div className="zzz">Zzz… ({taps}/5)</div>
        </Html>
      )}
    </group>
  );
}

/** Static/idle NPC with gentle breathing, click-to-talk, optional look-at-player. */
export function Npc({ object, name, position, rotY = 0, scale = 1, face = true, onClick, label, visible = true, grounds }: {
  object: THREE.Object3D; name: string; position: [number, number, number]; rotY?: number; scale?: number; face?: boolean;
  onClick?: (name: string) => void; label?: string; visible?: boolean; grounds?: React.MutableRefObject<THREE.Object3D[]>;
}) {
  const ref = useRef<THREE.Group>(null!);
  const phase = useMemo(() => Math.random() * 6, []);
  useFrame((st) => {
    const g = ref.current;
    if (!g) return;
    const t = st.clock.elapsedTime + phase;
    if (grounds) g.position.y = groundY(grounds.current, g.position.x, g.position.z, position[1]);
    g.children[0].position.y = Math.abs(Math.sin(t * 1.6)) * 0.03 * scale;
    if (face) {
      const want = Math.atan2(player.pos.x - g.position.x, player.pos.z - g.position.z);
      const d = Math.hypot(player.pos.x - g.position.x, player.pos.z - g.position.z);
      const target = d < 4.5 ? want : rotY;
      let diff = target - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * 0.06;
    }
  });
  return (
    <group ref={ref} position={position} rotation={[0, rotY, 0]} visible={visible}
      onClick={(e) => { e.stopPropagation(); onClick?.(name); }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}>
      <group scale={scale}><primitive object={object} /></group>
      {label && (
        <Html position={[0, 2.95 * scale, 0]} center distanceFactor={9} style={{ pointerEvents: 'none' }}>
          <div className="nametag">{label}</div>
        </Html>
      )}
    </group>
  );
}
