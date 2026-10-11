'use client';
import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { rigArms, poseArms } from './rig';
import { useFrame, useThree } from '@react-three/fiber';
import { useGame, HEROES, HeroId, player } from './store';
import { useModel } from './models';
import { Lights } from './common';
import { ForestBackdrop, pathX } from './ForestScene';

function Sister({ id, x }: { id: HeroId; x: number }) {
  const model = useModel(HEROES[id].model);
  const hero = useGame((s) => s.hero);
  const ref = useRef<THREE.Group>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const arms = useMemo(() => rigArms(model), [model]);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const sel = hero === id;
    poseArms(arms, sel ? 'cheer' : 'idle', t, 0.15, x);
    ref.current.position.y = sel ? Math.abs(Math.sin(t * 3.2)) * 0.18 : Math.sin(t * 1.5 + x) * 0.02;
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, sel ? Math.sin(t * 1.2) * 0.25 : -x * 0.12, 0.08);
    const m = ring.current.material as THREE.MeshBasicMaterial;
    m.opacity = THREE.MathUtils.lerp(m.opacity, sel ? 0.75 : 0.0, 0.1);
  });
  const h = HEROES[id];
  // names/ages are shown on the DOM cards below (drei <Html> labels raced React 19 unmounts on scene change)
  return (
    <group position={[x, 0, 0]}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0.05]}>
        <ringGeometry args={[0.62, 0.8, 48]} />
        <meshBasicMaterial color={h.color} transparent opacity={0} />
      </mesh>
      <group ref={ref} onClick={(e) => { e.stopPropagation(); useGame.getState().setHero(id); }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
        <group scale={0.82}><primitive object={model} /></group>
      </group>
    </group>
  );
}

function Cam() {
  const { camera } = useThree();
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const aspect = st.size.width / st.size.height;
    const d = Math.max(5.6, 4.7 / aspect); // keep both sisters in frame on portrait phones
    camera.position.set(pathX(4) + Math.sin(t * 0.25) * 0.4, 1.9 + (d - 5.6) * 0.12, 3.4 + d + 0.6);
    camera.lookAt(pathX(4), 1.2, 3.4);
  });
  return null;
}

export function SelectScene() {
  player.pos.set(pathX(4), 0, 4);
  return (
    <>
      <color attach="background" args={['#f7e9d6']} />
      <fog attach="fog" args={['#f3ead9', 14, 60]} />
      <Lights sun={[5, 10, 8]} range={8} />
      <Cam />
      <ForestBackdrop />
      <group position={[pathX(4), 0, 4]}>
        <Sister id="seohui" x={-0.85} />
        <Sister id="seojin" x={0.85} />
      </group>
    </>
  );
}
