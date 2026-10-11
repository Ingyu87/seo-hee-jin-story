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

/** Clone of a whole GLB scene (materials shared, nodes unique per instance). */
export function useModel(url: string, shadows = true) {
  const { scene } = useGLTF(url);
  return useMemo(() => prep(scene.clone(true), shadows), [scene, shadows]);
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
