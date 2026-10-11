'use client';
import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { rigArms, poseArms } from './rig';
import { useFrame, useThree } from '@react-three/fiber';
import { useGame, HEROES, HeroId, player, DWARFS } from './store';
import { useModel, useModelPart, MODELS } from './models';
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

/** Ending: everyone together on the forest path — the hero, Snow White and the seven dwarfs dance and cheer. */
function Dancer({ obj, x, z, scale, phase }: { obj: THREE.Object3D; x: number; z: number; scale: number; phase: number }) {
  const ref = useRef<THREE.Group>(null!);
  const arms = useMemo(() => rigArms(obj), [obj]);
  useFrame((st) => {
    const t = st.clock.elapsedTime + phase;
    poseArms(arms, Math.sin(t * 0.9) > -0.3 ? 'cheer' : 'wave', t, 0.15, phase);
    ref.current.position.y = Math.abs(Math.sin(t * 3.4)) * 0.16;
    ref.current.rotation.y = Math.sin(t * 1.3) * 0.35;
  });
  return <group position={[x, 0, z]}><group ref={ref}><group scale={scale}><primitive object={obj} /></group></group></group>;
}
function EndingParty() {
  const hero = useGame((s) => s.hero);
  const heroObj = useModel(HEROES[hero].model);
  const snow = useModelPart(MODELS.snowwhite, 'SnowWhite');
  const dwarfs = DWARFS.map((d) => useModelPart(MODELS.dwarfs, d.node)); // eslint-disable-line react-hooks/rules-of-hooks
  const confetti = useMemo(() => Array.from({ length: 60 }, () => ({ x: (Math.random() - 0.5) * 6, y: Math.random() * 4 + 0.5, z: (Math.random() - 0.5) * 2.5, c: ['#ff7fb0', '#ffd54f', '#7cc0ff', '#9be27a', '#ffffff'][Math.floor(Math.random() * 5)], s: Math.random() * 6 })), []);
  const conf = useRef<THREE.Group>(null!);
  useFrame((st, dt) => {
    conf.current?.children.forEach((m, i) => { m.position.y -= dt * (0.5 + (i % 5) * 0.12); if (m.position.y < 0) m.position.y = 4.5; m.rotation.x += dt * 3; m.rotation.z += dt * 2; });
  });
  return (
    <>
      <Dancer obj={heroObj} x={-0.55} z={0.3} scale={0.82} phase={0} />
      <Dancer obj={snow} x={0.55} z={0.3} scale={0.86} phase={1.3} />
      {dwarfs.map((o, i) => <Dancer key={i} obj={o} x={(i - 3) * 0.52} z={-0.75 - (i % 2) * 0.3} scale={0.5} phase={i * 0.7} />)}
      <group ref={conf}>
        {confetti.map((c, i) => <mesh key={i} position={[c.x, c.y, c.z]} rotation={[c.s, c.s * 2, 0]}><planeGeometry args={[0.07, 0.11]} /><meshBasicMaterial color={c.c} side={THREE.DoubleSide} /></mesh>)}
      </group>
    </>
  );
}

function Cam() {
  const { camera } = useThree();
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const aspect = st.size.width / st.size.height;
    const d = Math.max(5.6, 4.7 / aspect); // keep both sisters in frame on portrait phones
    const end = useGame.getState().scene === 'ending'; // ending: look down a little so the party sits above the story card
    camera.position.set(pathX(4) + Math.sin(t * 0.25) * 0.4, (end ? 3.4 : 1.9) + (d - 5.6) * 0.12, 3.4 + d + 0.6);
    camera.lookAt(pathX(4), end ? 0.1 : 1.2, 3.4);
  });
  return null;
}

export function SelectScene() {
  player.pos.set(pathX(4), 0, 4);
  const ending = useGame((s) => s.scene === 'ending');
  return (
    <>
      <color attach="background" args={['#f7e9d6']} />
      <fog attach="fog" args={['#f3ead9', 14, 60]} />
      <Lights sun={[5, 10, 8]} range={8} />
      <Cam />
      <ForestBackdrop />
      <group position={[pathX(4), 0, 4]}>
        {ending ? <EndingParty /> : <>
          <Sister id="seohui" x={-0.85} />
          <Sister id="seojin" x={0.85} />
        </>}
      </group>
    </>
  );
}
