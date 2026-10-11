'use client';
import * as THREE from 'three';
import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';

export const MODELS = {
  seohui: '/models/seohui.glb',
  seojin: '/models/seojin.glb',
  forest: '/models/forest.glb',
  cottage: '/models/cottage.glb',
  dwarfs: '/models/dwarfs.glb',
  queen: '/models/queen.glb',
  snowwhite: '/models/snowwhite.glb',
} as const;

function prep(root: THREE.Object3D, shadows = true) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = shadows;
      m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const sm = mat as THREE.MeshStandardMaterial;
        if (sm && 'envMapIntensity' in sm) sm.envMapIntensity = 0.3;
        const pm = mat as THREE.MeshPhysicalMaterial;
        // Blender exports KHR_materials_sheen with a white sheen colour on every material, which washes
        // colours out in three.js. Keep a faint, base-tinted sheen for the soft "felt" look instead.
        if (pm.isMeshPhysicalMaterial && pm.sheen > 0 && !pm.userData.fixed) {
          pm.sheenColor.copy(pm.color).multiplyScalar(0.35);
          pm.sheen = 0.4;
          pm.userData.fixed = true;
        }
        // procedural (noise) Blender materials export as plain white: give them their painted colours
        if (mat.name === 'Grass') sm.color.set('#86c95e');
        if (mat.name === 'Path') sm.color.set('#e2cc9c');
      }
    }
  });
  return root;
}

/**
 * Seohee's ponytail (K1Ponytail) was modelled hugging the back of the head, so the round hair cap hides it
 * from almost every angle. Hang it from a pivot at the hair tie, make it a bit bigger and swing it out
 * behind the head so it reads as a cute 꽁지머리 (Player sways it while walking / jumping).
 */
function fixPonytail(root: THREE.Object3D) {
  const tail = root.getObjectByName('K1Ponytail');
  if (!tail || !tail.parent || root.userData.ponytail) return;
  const tie = root.getObjectByName('K1Tie');
  const parent = tail.parent;
  const pivot = new THREE.Group();
  pivot.name = 'PonytailPivot';
  pivot.position.set(0, tie ? tie.position.y : 2.07, (tie ? tie.position.z : -0.6) - 0.02);
  parent.add(pivot);
  parent.updateMatrixWorld(true);
  pivot.attach(tail);
  pivot.scale.setScalar(1.3);
  pivot.rotation.x = 0.55; // swing the tail out behind the head
  pivot.rotation.z = 0.32; // and a little to one side so it peeks out even from the front
  pivot.userData.baseX = 0.55;
  pivot.userData.baseZ = 0.32;
  if (tie) tie.scale.multiplyScalar(1.35); // chunkier scrunchie
  root.userData.ponytail = pivot;
}

/** Clone of a whole GLB scene (materials shared, nodes unique per instance). */
export function useModel(url: string, shadows = true) {
  const { scene } = useGLTF(url);
  return useMemo(() => { const r = prep(scene.clone(true), shadows); fixPonytail(r); return r; }, [scene, shadows]);
}

/** Clone of a single named root node of a GLB (e.g. one dwarf out of seven), re-centred at the origin. */
export function useModelPart(url: string, nodeName: string) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const src = scene.getObjectByName(nodeName);
    if (!src) return new THREE.Group();
    const c = src.clone(true);
    c.position.set(0, 0, 0);
    c.rotation.set(0, 0, 0);
    const g = new THREE.Group();
    g.add(c);
    return prep(g);
  }, [scene, nodeName]);
}

/** Find the nearest ancestor (incl. self) whose name passes the test. */
export function findNamed(o: THREE.Object3D | null, test: (n: string) => boolean): THREE.Object3D | null {
  while (o) {
    if (o.name && test(o.name)) return o;
    o = o.parent;
  }
  return null;
}

Object.values(MODELS).forEach((u) => useGLTF.preload(u));
