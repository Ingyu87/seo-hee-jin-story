'use client';
import * as THREE from 'three';

/**
 * Runtime "cozy log cabin" pass over the Blender cottage (no re-export needed):
 *  - dining set (table, chairs, bowl, apple, rug) nudged right; the three beds turned and lined up along the
 *    left wall like the dwarfs' beds in the film — they no longer cut through the back row of chairs
 *  - walls become stacked honey-pine logs, the round pink rug becomes a smaller oval braided rag rug
 *  - glowing fire / window, floor planks lifted off the floor (no z-fighting)
 */
export const DINING_DX = 0.35;
export const BED_ZONE = { x: -1.82, z: 0.36 }; // beds occupy x < -1.82, z < 0.36 (inside the room)
const BED_Z = [-2.25, -1.2, -0.15];
const BED_X = -2.84;

function patchOnce(m: THREE.Material, key: string, fn: (m: THREE.MeshStandardMaterial) => void) {
  if (m.userData[key]) return;
  m.userData[key] = true;
  fn(m as THREE.MeshStandardMaterial);
  m.needsUpdate = true;
}

/** Stacked horizontal logs (world-space, so it works without UVs). */
function logWalls(m: THREE.MeshStandardMaterial) {
  m.color.set('#d9a066');
  m.roughness = 0.82;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLogW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvLogW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLogW;\nfloat logHash(float n){return fract(sin(n)*43758.5453);}')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float lh = 0.3;
        float row = floor(vLogW.y / lh);
        float f = fract(vLogW.y / lh);
        float round_ = 0.72 + 0.28 * sin(3.14159 * f);            // rounded log profile
        float groove = smoothstep(0.0, 0.07, f) * smoothstep(1.0, 0.93, f); // dark chinking between logs
        float tone = 0.9 + 0.2 * logHash(row * 7.13);              // each log a slightly different shade
        float grain = 0.95 + 0.05 * sin((vLogW.x + vLogW.z) * 9.0 + row * 3.1 + sin((vLogW.x - vLogW.z) * 1.7) * 2.0);
        diffuseColor.rgb *= round_ * tone * grain * mix(0.45, 1.0, groove);`);
  };
  m.customProgramCacheKey = () => 'logWalls';
}

/** Oval braided rag rug: concentric rings of cream / rust / sage. */
function braidedRug(m: THREE.MeshStandardMaterial) {
  m.color.set('#ffffff');
  m.roughness = 1;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRugP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRugP = position.xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRugP;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float r = length(vRugP) * 9.0;
        float ring = floor(r);
        float k = mod(ring, 3.0);
        vec3 c = k < 1.0 ? vec3(0.62, 0.20, 0.10) : (k < 2.0 ? vec3(0.80, 0.70, 0.50) : vec3(0.30, 0.42, 0.24));
        float braid = 0.82 + 0.18 * sin(fract(r) * 3.14159) * (0.85 + 0.15 * sin(atan(vRugP.y, vRugP.x) * 60.0 + ring * 2.0));
        diffuseColor.rgb = c * braid;`);
  };
  m.customProgramCacheKey = () => 'braidedRug';
}

export function cozyCottage(root: THREE.Object3D) {
  if (root.userData.cozy) return;
  root.userData.cozy = true;
  const byName = (n: string) => root.getObjectByName(n);

  // 1) dining set a little to the right (clear aisle between the beds and the chairs)
  root.children.forEach((o) => {
    if (/^(Table\.|Chair\d$|Bowl|Apple$|Rug$)/.test(o.name)) o.position.x += DINING_DX;
  });

  // 2) beds: rotate 90° (headboard against the left wall), side by side along that wall
  for (let i = 0; i < 3; i++) {
    const frame = byName(`Bed${i}.Frame`); if (!frame) continue;
    const pivot = frame.position.clone();
    const c = new THREE.Vector3(BED_X, pivot.y, BED_Z[i]);
    for (const part of ['Frame', 'Head', 'Pillow', 'Quilt']) {
      const o = byName(`Bed${i}.${part}`); if (!o) continue;
      const d = o.position.clone().sub(pivot);
      // R_y(+90°): (x, z) -> (z, -x)
      o.position.set(c.x + d.z, o.position.y, c.z - d.x);
      o.rotation.y += Math.PI / 2;
    }
  }

  // 3) rug: smaller oval, centred under the table, lifted clear of the floor planks
  const rug = byName('Rug');
  if (rug) { rug.position.set(-0.3 + DINING_DX, 0.222, -0.3); rug.scale.set(1.85, 1.2, 1.4); }
  root.children.forEach((o) => { if (/^FloorPlank/.test(o.name)) o.position.y = 0.21; });

  // 4) materials
  root.traverse((o) => {
    const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
    const m = mesh.material as THREE.MeshStandardMaterial;
    if (!m) return;
    if (m.name === 'CottageWall') patchOnce(m, 'cozy', logWalls);
    if (m.name === 'Rug') patchOnce(m, 'cozy', braidedRug);
    if (m.name === 'Fire') patchOnce(m, 'cozy', (f) => { f.emissive = new THREE.Color('#ff7a1a'); f.emissiveIntensity = 2.2; });
    if (m.name === 'WindowGlow') patchOnce(m, 'cozy', (w) => { w.emissive = new THREE.Color('#bfe3ff'); w.emissiveIntensity = 0.5; });
    if (m.name === 'FloorWood') patchOnce(m, 'cozy', (w) => { w.color.set('#b0703c'); w.roughness = 0.85; });
    if (m.name === 'Timber') patchOnce(m, 'cozy', (w) => { w.color.set('#5a3418'); });
    // the toy-bright cushions: a touch softer / more homespun
    if (/^Cushion/.test(m.name)) patchOnce(m, 'cozy', (w) => { w.color.lerp(new THREE.Color('#c9a27a'), 0.3); });
    if (/^Quilt/.test(m.name)) patchOnce(m, 'cozy', (w) => { w.color.lerp(new THREE.Color('#d8c2a0'), 0.2); });
    if (/^(Rug|FloorPlank)/.test(o.name)) mesh.castShadow = false;
  });
}

/** Forest view of the same cottage: log walls / dark timber like the cabin interior. */
export function cozyExterior(root: THREE.Object3D) {
  if (root.userData.cozyExt) return;
  root.userData.cozyExt = true;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh; if (!mesh.isMesh || !/^Cottage/.test(o.name)) return;
    const m = mesh.material as THREE.MeshStandardMaterial; if (!m) return;
    if (m.name === 'CottageWall') patchOnce(m, 'cozyExt', logWalls);
    if (m.name === 'Timber') patchOnce(m, 'cozyExt', (w) => { w.color.set('#5a3418'); });
    if (m.name === 'WindowGlow') patchOnce(m, 'cozyExt', (w) => { w.emissive = new THREE.Color('#ffd27a'); w.emissiveIntensity = 0.6; });
  });
}
