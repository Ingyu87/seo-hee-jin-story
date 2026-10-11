'use client';
import * as THREE from 'three';

/**
 * Procedural arm rig for the ACNH-style GLBs (they ship with no skeleton / animation).
 * Each "<x>Arm" mesh + its matching "<x>Hand" (and cuff/puff-slash bits) is wrapped in a shoulder pivot.
 * Arms that were modelled raised (the old waving pose) are swung down to a relaxed rest pose; then
 * per-frame poses (idle / walk / jump / wave / talk / sit) rotate the pivots.
 */
export type Arm = { pivot: THREE.Group; side: 1 | -1; rest: THREE.Quaternion };
export type Pose = 'idle' | 'walk' | 'jump' | 'wave' | 'talk' | 'sit' | 'cheer' | 'hold';

const sideOf = (name: string): 1 | -1 | 0 => {
  // three.js strips dots from glTF names: "K1Arm.-1" → "K1Arm-1"
  if (/(_-1(Arm|Hand|Cuff)|(Arm|Hand|Cuff)\.?-1$)/.test(name)) return -1;
  if (/(_1(Arm|Hand|Cuff)|(Arm|Hand|Cuff)\.?1$)/.test(name)) return 1;
  return 0;
};

function pointsIn(obj: THREE.Object3D, space: THREE.Object3D) {
  const inv = new THREE.Matrix4().copy(space.matrixWorld).invert();
  const pts: THREE.Vector3[] = [];
  obj.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const pos = m.geometry.attributes.position; const mat = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    const stride = Math.max(1, Math.floor(pos.count / 400));
    for (let i = 0; i < pos.count; i += stride) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mat));
  });
  return pts;
}

export function rigArms(root: THREE.Object3D, opts: { keep?: boolean } = {}): Arm[] {
  if (root.userData.arms) return root.userData.arms;
  root.updateMatrixWorld(true);
  // find the node that directly holds the body parts
  let body: THREE.Object3D | null = null;
  root.traverse((o) => { if (!body && o.children.some((c) => /Arm/.test(c.name))) body = o; });
  const arms: Arm[] = [];
  if (!body) { root.userData.arms = arms; return arms; }
  const b = body as THREE.Object3D;
  ([1, -1] as const).forEach((side) => {
    const parts = b.children.filter((c) => sideOf(c.name) === side && /(Arm|Hand|Cuff)/.test(c.name));
    const arm = parts.find((c) => /Arm/.test(c.name)); if (!arm) return;
    const hand = parts.find((c) => /Hand/.test(c.name));
    const handC = hand ? new THREE.Box3().setFromObject(hand).getCenter(new THREE.Vector3()) : null;
    const armPts = pointsIn(arm, b);
    if (!armPts.length) return;
    const handP = handC ? b.worldToLocal(handC.clone()) : armPts[0];
    // shoulder = arm vertex farthest from the hand
    let sh = armPts[0], best = -1;
    armPts.forEach((p) => { const d = p.distanceToSquared(handP); if (d > best) { best = d; sh = p; } });
    sh = sh.clone();
    // nudge the pivot a little into the arm so the rotation looks like a shoulder joint
    const dir = handP.clone().sub(sh);
    sh.addScaledVector(dir, 0.12);
    const pivot = new THREE.Group(); pivot.name = `Shoulder${side}`; pivot.position.copy(sh);
    b.add(pivot); b.updateMatrixWorld(true);
    parts.forEach((p) => pivot.attach(p));
    // other bits hanging off the hand (puff slashes are on the shoulder → leave them)
    const rest = new THREE.Quaternion();
    const d = dir.clone().normalize();
    const raised = d.y > -0.35; // modelled waving / reaching up
    const crossed = Math.sign(d.x) !== 0 && Math.sign(d.x) !== side && Math.abs(d.x) > 0.3 && d.y < 0.2; // e.g. Grumpy's folded arms, basket hold
    const holding = d.z > 0.55; // e.g. the old woman's basket
    if (raised && !crossed && !holding && !opts.keep) {
      const want = new THREE.Vector3(side * 0.32, -1, 0.06).normalize();
      rest.setFromUnitVectors(d, want);
    }
    pivot.quaternion.copy(rest);
    arms.push({ pivot, side, rest });
  });
  root.userData.arms = arms;
  return arms;
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler();
/** Blend each arm toward the pose. t = time (s). k = blend factor per frame. */
export function poseArms(arms: Arm[], pose: Pose, t: number, k = 0.25, phase = 0) {
  for (const a of arms) {
    let swing = 0, raise = 0; // swing: about X (negative = forward), raise: outwards/up about Z
    const s = a.side;
    switch (pose) {
      case 'idle': swing = Math.sin(t * 1.6 + phase) * 0.04; raise = 0.04 + Math.sin(t * 1.6 + phase) * 0.02; break;
      case 'walk': swing = Math.sin(t * 12 + phase) * 0.55 * s; raise = 0.08; break;
      case 'jump': raise = 2.3; swing = -0.2; break;
      case 'cheer': raise = 2.4 + Math.sin(t * 10 + phase + (s > 0 ? 0 : Math.PI)) * 0.25; swing = -0.15; break;
      case 'wave': if (s === 1) { raise = 2.5 + Math.sin(t * 9 + phase) * 0.35; swing = -0.25; } else { raise = 0.06; swing = 0; } break;
      case 'talk': swing = -0.35 + Math.sin(t * 5 + phase + (s > 0 ? 0 : 1.7)) * 0.2; raise = 0.2; break;
      case 'sit': swing = -0.9; raise = 0.05; break;
      case 'hold': swing = -1.1; raise = -0.15; break;
    }
    _e.set(swing, 0, raise * s);
    _q.setFromEuler(_e).multiply(a.rest);
    a.pivot.quaternion.slerp(_q, k);
  }
}
