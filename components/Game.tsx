'use client';
import { Suspense, useEffect } from 'react';
import { unlockAudio } from './audio';
import { Canvas, useThree, advance } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { useGame } from './store';
import { SelectScene } from './SelectScene';
import { ForestScene } from './ForestScene';
import { CottageScene } from './CottageScene';
import { Hud } from './Hud';

/** DOM overlay (outside the canvas) so it never fights R3F/Html portals during scene swaps. */
function Loader() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return <div className="boot">{useGame.getState().lang === 'en' ? 'Opening the storybook…' : '동화책을 펼치는 중…'} {progress.toFixed(0)}%</div>;
}

function ExposeGl() {
  const gl = useThree((s) => s.gl);
  if (typeof window !== 'undefined') (window as unknown as { __snow: Record<string, unknown> }).__snow.gl = gl;
  return null;
}

// ?capture=1 → deterministic frame stepping for recording the demo video on a GPU-less machine
const CAPTURE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('capture');
if (CAPTURE) {
  let t = 0;
  (window as unknown as { __snow: Record<string, unknown> }).__snow.step = (dt = 1 / 15) => { t += dt; advance(t); };
}

export default function Game() {
  const scene = useGame((s) => s.scene);
  const key = useGame((s) => s.spawnKey);
  // browsers only allow audio after a user gesture: unlock + start BGM on the first tap / key press
  useEffect(() => {
    const go = () => { unlockAudio(); window.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go); };
    window.addEventListener('pointerdown', go); window.addEventListener('keydown', go);
    return () => { window.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go); };
  }, []);
  return (
    <div className="game">
      <Canvas frameloop={CAPTURE ? 'never' : 'always'} shadows dpr={[1, 1.75]} camera={{ fov: 42, near: 0.1, far: 200, position: [0, 3, 8] }}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 0.95, preserveDrawingBuffer: true }}
        onPointerMissed={() => useGame.getState().next()}>
        <ExposeGl />
        {(scene === 'stories' || scene === 'select' || scene === 'ending') && <Suspense key={`s${key}`} fallback={null}><SelectScene /></Suspense>}
        {scene === 'forest' && <Suspense key={`f${key}`} fallback={null}><ForestScene /></Suspense>}
        {scene === 'cottage' && <Suspense key={`c${key}`} fallback={null}><CottageScene /></Suspense>}
      </Canvas>
      <Hud />
      <Loader />
    </div>
  );
}
