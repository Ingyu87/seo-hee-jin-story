'use client';
import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { player } from './store';

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
    const a = first.current ? 1 : lerp;
    first.current = false;
    camera.position.lerp(pos, a);
    lookAt.current.lerp(lk, a);
    camera.lookAt(lookAt.current);
  });
  return null;
}
