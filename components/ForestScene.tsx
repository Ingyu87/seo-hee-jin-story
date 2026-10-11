'use client';
import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { useGame, player } from './store';
import { useModel, useModelPart, MODELS } from './models';
import { Player, Npc, World, groundY } from './Player';
import { Lights, FollowCam } from './common';

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
  useFrame((_, dt) => {
    const g = ref.current; if (!g) return;
    t.current += dt;
    const p = pos.current;
    let moving = false;
    if (follow) {
      // walk beside the player (to her right, half a step behind)
      const fwd = new THREE.Vector3(Math.sin(player.rotY), 0, Math.cos(player.rotY));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x).multiplyScalar(-1);
      const want = player.pos.clone().addScaledVector(fwd, -0.5).addScaledVector(right, 1.15);
      const d = want.clone().sub(p).setY(0);
      if (d.length() > 0.3) {
        moving = true;
        p.add(d.normalize().multiplyScalar(Math.min(dt * 3.4, d.length())));
        g.rotation.y = Math.atan2(d.x, d.z);
      }
    } else {
      const want = Math.atan2(player.pos.x - p.x, player.pos.z - p.z);
      g.rotation.y += Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y)) * 0.05;
    }
    p.y = groundY(grounds.current, p.x, p.z, 0);
    g.position.copy(p);
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

export function ForestScene() {
  const { forest, grounds } = useForest();
  const queen = useModelPart(MODELS.queen, 'Queen');
  const fired = useRef({ met: false, gate: false });
  const spawnKey = useGame((s) => s.spawnKey);
  const world = useMemo<World>(() => ({
    scale: S,
    speed: 3.6,
    spawn: [pathX(3), 0, 3],
    spawnRot: 0,
    grounds,
    blocked: (x, z) => z > 6 || z < -37 || Math.abs(x - pathX(z)) > 3.4,
    onStep: (p) => {
      const g = useGame.getState();
      const sw = new THREE.Vector3(pathX(-5) + 1.3, 0, -5);
      if (!fired.current.met && !g.metSnowWhite && p.distanceTo(sw.setY(p.y)) < 2.6) {
        fired.current.met = true; useGame.setState({ target: null, pending: null }); g.interact('SnowWhite');
      }
      if (!fired.current.gate && g.swFollow && p.z < -31) {
        fired.current.gate = true; useGame.setState({ target: null, pending: null }); g.interact('CottageGate');
      }
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [grounds, spawnKey]);

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
      <SnowWhite grounds={grounds} />
      <Npc object={queen} name="Queen" position={[pathX(-21) - 2.4, 0, -21]} rotY={0.6} scale={S} face={false} grounds={grounds}
        onClick={(n) => useGame.getState().moveTo(pathX(-21) - 1.0, -20.2, n)} />
    </>
  );
}
