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

const _mid = new THREE.Vector3(), _dir = new THREE.Vector3(), _up = new THREE.Vector3();

/** Smooth follow camera: world-space offset from the player, looking slightly ahead. */
export function FollowCam({ offset, look, lerp = 0.08, fixed }: {
  offset: [number, number, number]; look: [number, number, number]; lerp?: number;
  fixed?: (p: THREE.Vector3) => { pos: THREE.Vector3; look: THREE.Vector3 };
}) {
  const { camera } = useThree();
  const lookAt = useRef(new THREE.Vector3());
  const first = useRef(true);
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
      const mid = _mid.copy(player.pos).add(npc).multiplyScalar(0.5);
      const portrait = typeof window !== 'undefined' && window.innerWidth < window.innerHeight;
      // side-on "two shot": look across the player→NPC axis so neither hides the other
      const axis = _dir.set(npc.x - player.pos.x, 0, npc.z - player.pos.z);
      const sep = axis.length(); axis.normalize();
      const backXZ = _up.copy(pos).sub(lk).setY(0).normalize();
      const side = new THREE.Vector3(-axis.z, 0, axis.x);
      if (side.dot(backXZ) < 0) side.negate();
      // dollhouse cottage: stay in front of the cut-away wall (mostly the default direction, slight turn)
      const hdir = fixed ? backXZ.multiplyScalar(1).add(side.multiplyScalar(0.3)).normalize() : side.add(backXZ.multiplyScalar(0.55)).normalize();
      const dist = THREE.MathUtils.clamp(Math.max(2.2, sep * 1.5) * (portrait ? (fixed ? 3.3 : 2.7) : 1.9), 4, 11);
      const el = THREE.MathUtils.degToRad(portrait ? 24 : 18);
      lk = mid.clone(); lk.y += portrait ? 0.35 : 0.8; // aim a bit low so faces sit above the dialogue box on phones
      pos = lk.clone().addScaledVector(hdir, dist * Math.cos(el)); pos.y += dist * Math.sin(el);
      a = Math.min(a, 0.05);
    }
    first.current = false;
    camera.position.lerp(pos, a);
    lookAt.current.lerp(lk, a);
    camera.lookAt(lookAt.current);
  });
  return null;
}
