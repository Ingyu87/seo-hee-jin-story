'use client';
import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useGame, player, HEROES, jump, npcPos, npcGoal } from './store';
import { rigArms, poseArms, Pose } from './rig';
import { useModel } from './models';
import { sfx } from './audio';
import { stick } from './touch';
import { convoHidden } from './common';

export type World = {
  scale: number;
  speed: number;
  spawn: [number, number, number];
  spawnRot: number;
  blocked: (x: number, z: number) => boolean;
  grounds: React.MutableRefObject<THREE.Object3D[]>;
  seat?: (name: string) => { pos: THREE.Vector3; quat: THREE.Quaternion } | null;
  onStep?: (pos: THREE.Vector3) => void;
  /** run-game mode: forward speed along -z (the player only steers left/right, ↓ = stop), or null when off */
  autoRun?: () => number | null;
  /** auto-run bumped into something (e.g. thorns) */
  onBump?: () => void;
  /** run-game: which way to sidestep the obstacle ahead (-1 / +1, 0 = nothing there) — used when stuck */
  steer?: (pos: THREE.Vector3) => number;
};
/** Recent player positions (with hop height) — Snow White follows this trail in the run-game escort. */
export const trail: { x: number; z: number; y: number }[] = [];
export const runMode = { on: false };
// run-game steering by swiping: drag left / right anywhere on the 3D view
if (typeof window !== 'undefined') {
  let sx: number | null = null; let id = -1;
  window.addEventListener('pointerdown', (e) => {
    if (!runMode.on || !(e.target as HTMLElement)?.closest?.('canvas')) return;
    sx = e.clientX; id = e.pointerId;
  });
  window.addEventListener('pointermove', (e) => {
    if (sx === null || e.pointerId !== id || !runMode.on) return;
    const v = Math.max(-1, Math.min(1, (e.clientX - sx) / 45));
    stick.x = Math.abs(v) > 0.2 ? v : 0; stick.z = 0; stick.active = Math.abs(v) > 0.2;
  });
  const up = (e: PointerEvent) => { if (e.pointerId !== id || sx === null) return; sx = null; stick.x = 0; stick.active = false; };
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}

const keys: Record<string, boolean> = {};
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => (keys[e.key.toLowerCase()] = true));
  window.addEventListener('keyup', (e) => (keys[e.key.toLowerCase()] = false));
  window.addEventListener('keydown', (e) => {
    if (e.key !== ' ' || e.repeat) return;
    const t = e.target as HTMLElement | null;
    if (t && /^(BUTTON|INPUT|TEXTAREA)$/.test(t.tagName)) return;
    if (jump()) e.preventDefault();
  });
}

const ray = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0, -1, 0);

export function groundY(grounds: THREE.Object3D[], x: number, z: number, fallback: number) {
  if (!grounds.length) return fallback;
  ray.set(new THREE.Vector3(x, 12, z), DOWN);
  const hit = ray.intersectObjects(grounds, true)[0];
  return hit ? hit.point.y : fallback;
}

/** Wrap leg/shoe nodes of an ACNH-style kid in a hip pivot so the kid can sit with legs forward. */
function rigLegs(root: THREE.Object3D) {
  const charRoot = root.getObjectByName('CharPivot') ?? root;
  const legs: THREE.Object3D[] = [];
  charRoot.children.forEach((c) => /(Leg|Shoe)/.test(c.name) && legs.push(c));
  const box = new THREE.Box3();
  legs.filter((l) => /Leg/.test(l.name)).forEach((l) => box.expandByObject(l));
  const hipY = box.isEmpty() ? 0.5 : box.max.y - 0.05;
  const hip = new THREE.Group();
  hip.name = 'HipPivot';
  hip.position.set(0, hipY, 0);
  charRoot.add(hip);
  root.updateMatrixWorld(true);
  legs.forEach((l) => hip.attach(l));
  return { hip, hipY };
}

export function Player({ world }: { world: World }) {
  const hero = useGame((s) => s.hero);
  const model = useModel(HEROES[hero].model);
  const appleModel = useModel('/models/cottage.glb', false);
  const outer = useRef<THREE.Group>(null!);
  const inner = useRef<THREE.Group>(null!);
  const rig = useMemo(() => rigLegs(model), [model]);
  const arms = useMemo(() => rigArms(model), [model]);
  const apple = useMemo(() => {
    const a = appleModel.getObjectByName('Apple');
    const g = new THREE.Group();
    if (a) { const c = a.clone(true); c.position.set(0, 0, 0); g.add(c); }
    return g;
  }, [appleModel]);
  const appleState = useGame((s) => s.apple);
  const spawnKey = useGame((s) => s.spawnKey);
  const t0 = useRef(0);
  const stepT = useRef(0);
  const stuck = useRef({ t: 0, dir: 0, hold: 0 }); // run-game: seconds blocked + auto-sidestep direction

  useEffect(() => {
    const [x, y, z] = world.spawn;
    player.pos.set(x, y, z);
    player.rotY = world.spawnRot;
    trail.length = 0;
  }, [spawnKey, world]);

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.2);
    const g = useGame.getState();
    const p = player.pos;
    let dx = 0, dz = 0;
    let kx = (keys['arrowright'] || keys['d'] ? 1 : 0) - (keys['arrowleft'] || keys['a'] ? 1 : 0);
    let kz = (keys['arrowdown'] || keys['s'] ? 1 : 0) - (keys['arrowup'] || keys['w'] ? 1 : 0);
    let analog = 1; // on-screen joystick: same axes as the keys, with analog speed
    if (!kx && !kz && stick.active && Math.hypot(stick.x, stick.z) > 0.15) {
      kx = stick.x; kz = stick.z; analog = Math.max(0.35, Math.min(1, Math.hypot(kx, kz)));
    }
    const locked = g.sleeping || g.lines.length > 0;
    if (g.cutscene) { kx = 0; kz = 0; } // story cut-scene: only scripted walking
    const run = !locked && !g.cutscene && world.autoRun ? world.autoRun() : null;
    if (runMode.on !== !!run) { runMode.on = !!run; useGame.setState({ running: runMode.on }); }
    const air0 = player.jumpY > 0.001;
    if (run && kz < 0.5) {
      // run-game escort: keep walking up the path automatically; keys / stick / swipe steer left-right
      if (g.target) useGame.setState({ target: null, pending: null });
      dx = Math.abs(kx) > 0.15 ? kx * 1.1 : 0; dz = -1; analog = (run * (air0 ? 2.3 : 1)) / world.speed; // a hop carries you over
      // stuck against a rock / thorn bush for a moment (little ones!) → sidestep around it automatically
      const st = stuck.current;
      if (st.hold > 0) { st.hold -= dt; if (!dx) dx = st.dir * 1.3; }
      else if (st.t > 1.2 && !dx) { st.dir = world.steer?.(p) || (p.x > 0 ? -1 : 1); st.hold = 0.9; st.t = 0; dx = st.dir * 1.3; }
    } else if (run) { dx = 0; dz = 0; }
    else if (!locked && (kx || kz)) {
      if (g.sitting) g.standUp();
      if (g.target) useGame.setState({ target: null, pending: null });
      dx = kx; dz = kz;
    } else if (!locked && g.target && !g.sitting) {
      analog = 1;
      dx = g.target[0] - p.x; dz = g.target[1] - p.z;
      const d = Math.hypot(dx, dz);
      const stopAt = g.pending ? 0.2 : 0.08;
      if (d < stopAt) { dx = dz = 0; g.arrive(); }
    }
    const len = Math.hypot(dx, dz);
    player.moving = len > 0.001;
    if (player.moving) {
      const step = Math.min(world.speed * analog * dt, len);
      const nx = p.x + (dx / len) * step, nz = p.z + (dz / len) * step;
      const inside = world.blocked(p.x, p.z); // landed on / spawned inside something: always let them walk out
      if (inside || !world.blocked(nx, nz)) { p.x = nx; p.z = nz; if (run) stuck.current.t = 0; }
      else if (run) { world.onBump?.(); stuck.current.t += dt; if (!world.blocked(nx, p.z)) p.x = nx; }
      else if (!world.blocked(nx, p.z)) p.x = nx;
      else if (!world.blocked(p.x, nz)) p.z = nz;
      else if (g.target) useGame.setState({ target: null, pending: null });
      const want = Math.atan2(dx, dz);
      let diff = want - player.rotY;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      player.rotY += diff * Math.min(1, dt * 12);
      world.onStep?.(p);
      stepT.current += dt;
      if (stepT.current > 0.32) { stepT.current = 0; sfx('step'); }
    } else {
      stepT.current = 0.25;
      // during a conversation, turn to face whoever is talking
      const tk = g.lines.length && g.talker ? npcPos[g.talker] : null;
      if (tk && !g.sitting && tk.distanceTo(p) < 7.5) {
        let diff = Math.atan2(tk.x - p.x, tk.z - p.z) - player.rotY;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        player.rotY += diff * Math.min(1, dt * 6);
      }
    }
    p.y = groundY(world.grounds.current, p.x, p.z, p.y);
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 0.08) { trail.push({ x: p.x, z: p.z, y: player.jumpY }); if (trail.length > 80) trail.shift(); }
    // jump / hop
    if (player.vy !== 0 || player.jumpY > 0) {
      player.vy -= 16 * dt;
      player.jumpY = Math.max(0, player.jumpY + player.vy * dt);
      if (player.jumpY === 0 && player.vy < 0) { player.vy = 0; sfx('step'); }
    }
    const air = player.jumpY > 0.001;
    const line = g.lines[g.lineIdx];
    const heroTalking = !!line && line.speaker.ko === HEROES[g.hero].name.ko;
    const pose: Pose = g.sitting ? 'sit' : g.sleeping ? 'idle' : air ? 'jump' : player.moving ? 'walk'
      : g.apple === 'held' ? 'hold' : heroTalking ? 'wave' : line ? 'talk' : 'idle';
    poseArms(arms, pose, t0.current, 0.25);
    const tail = model.userData.ponytail as THREE.Object3D | undefined;
    if (tail) { // bouncy ponytail: swings while walking, flips up on a jump
      const base = tail.userData.baseX as number;
      const want = air ? base + 0.45 : player.moving ? base + 0.12 + Math.sin(t0.current * 12) * 0.12 : base + Math.sin(t0.current * 2) * 0.03;
      tail.rotation.x = THREE.MathUtils.lerp(tail.rotation.x, want, 0.25);
      tail.rotation.z = THREE.MathUtils.lerp(tail.rotation.z, (tail.userData.baseZ as number) + (player.moving ? Math.sin(t0.current * 6) * 0.15 : 0), 0.2);
    }

    const o = outer.current, i = inner.current;
    t0.current += dt;
    const seat = g.sitting && world.seat ? world.seat(g.sitting) : null;
    if (seat) {
      o.position.copy(seat.pos).add(new THREE.Vector3(0, -rig.hipY * world.scale, 0));
      const e = new THREE.Euler().setFromQuaternion(seat.quat, 'YXZ');
      o.rotation.set(0, e.y + Math.PI, 0);
      player.rotY = e.y + Math.PI;
      rig.hip.rotation.x = THREE.MathUtils.lerp(rig.hip.rotation.x, -Math.PI / 2, 0.25);
      i.position.y = 0; i.rotation.set(0, 0, 0);
    } else {
      rig.hip.rotation.x = THREE.MathUtils.lerp(rig.hip.rotation.x, player.moving ? Math.sin(t0.current * 12) * 0.25 : 0, 0.3);
      o.position.copy(p);
      o.position.y += player.jumpY;
      o.rotation.set(0, player.rotY, 0);
      {
        i.rotation.z = THREE.MathUtils.lerp(i.rotation.z, player.moving ? Math.sin(t0.current * 12) * 0.06 : 0, 0.3);
        i.rotation.x = 0;
        i.position.y = player.moving && player.jumpY === 0 ? Math.abs(Math.sin(t0.current * 12)) * 0.08 * world.scale : Math.sin(t0.current * 2) * 0.01;
      }
    }
  });

  return (
    <group ref={outer}>
      <group ref={inner} scale={world.scale}>
        <primitive object={model} />
        {appleState === 'held' && <primitive object={apple} position={[0.05, 1.15, 0.55]} scale={1.6} />}
      </group>
    </group>
  );
}

/**
 * Simple character collision: NPCs (and the player) never stand inside each other. Each NPC registers a
 * body radius here; <Separation/> pushes overlapping pairs apart every frame (NPCs give way to the player,
 * scripted walkers / sleepers don't get pushed, nothing is pushed into a wall or the table).
 */
type Body = { r: number; solid: boolean; fixed: boolean; blocked?: (x: number, z: number) => boolean };
export const bodies: Record<string, Body> = {};
/** true while <Separation/> tests a nudge (scenes skip their "keep away from the player" rule then) */
export const sepCheck = { on: false };
const _sep = new THREE.Vector3();
export function Separation({ playerR }: { playerR: number }) {
  useFrame(() => {
    const g = useGame.getState();
    const names = Object.keys(bodies).filter((n) => bodies[n].solid && npcPos[n]);
    const push = (n: string, dx: number, dz: number) => {
      const b = bodies[n]; const p = npcPos[n]; if (!b || b.fixed) return false;
      const nx = p.x + dx, nz = p.z + dz;
      sepCheck.on = true; const bad = !!b.blocked && b.blocked(nx, nz); sepCheck.on = false;
      if (bad) return false;
      p.x = nx; p.z = nz; return true;
    };
    for (let i = 0; i < names.length; i++) {
      const a = names[i]; const pa = npcPos[a];
      // player vs NPC: the NPC steps aside (the player is never shoved while steering / sitting)
      if (!g.sitting) {
        _sep.set(pa.x - player.pos.x, 0, pa.z - player.pos.z); const d = _sep.length(); const min = bodies[a].r + playerR;
        if (d < min) {
          if (d < 1e-4) _sep.set(1, 0, 0); else _sep.multiplyScalar(1 / d);
          const k = (min - d) * 0.5;
          if (!push(a, _sep.x * k, _sep.z * k) && bodies[a].fixed && !g.target) { /* immovable NPC: nudge the player instead */
            player.pos.x -= _sep.x * k * 0.5; player.pos.z -= _sep.z * k * 0.5;
          }
        }
      }
      for (let j = i + 1; j < names.length; j++) {
        const b = names[j]; const pb = npcPos[b];
        _sep.set(pb.x - pa.x, 0, pb.z - pa.z); const d = _sep.length(); const min = bodies[a].r + bodies[b].r;
        if (d >= min) continue;
        if (d < 1e-4) _sep.set(1, 0, 0.3).normalize(); else _sep.multiplyScalar(1 / d);
        const k = (min - d) * 0.5;
        const fa = bodies[a].fixed, fb = bodies[b].fixed;
        if (!fa && !fb) { push(a, -_sep.x * k, -_sep.z * k); push(b, _sep.x * k, _sep.z * k); }
        else if (fa && !fb) push(b, _sep.x * k * 2, _sep.z * k * 2);
        else if (!fa && fb) push(a, -_sep.x * k * 2, -_sep.z * k * 2);
      }
    }
  });
  return null;
}

/**
 * NPC: wanders a little around its home spot (procedural walk: waddle + bob + arm swing), stops and turns to
 * the player when they come close or while talking, click-to-talk.
 */
export function Npc({ object, name, position, rotY = 0, scale = 1, face = true, onClick, label, visible = true, grounds, wander = 0, blocked, speed = 0.7, asleep = false, bubble, children }: {
  object: THREE.Object3D; name: string; position: [number, number, number]; rotY?: number; scale?: number; face?: boolean;
  onClick?: (name: string) => void; label?: string; visible?: boolean; grounds?: React.MutableRefObject<THREE.Object3D[]>;
  wander?: number; blocked?: (x: number, z: number) => boolean; speed?: number; asleep?: boolean;
  /** little speech bubble above the head (e.g. "♪ heigh-ho~" while the dwarfs march off) */
  bubble?: string | null;
  /** props held by the character (in model space, scaled with it) */
  children?: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null!);
  const phase = useMemo(() => Math.random() * 6, []);
  const arms = useMemo(() => rigArms(object), [object]);
  const taps = useGame((s) => (asleep ? s.taps : 0));
  const hideTag = useGame((s) => s.lines.length > 0 && s.talker !== name); // only the speaker keeps a name tag during a chat
  const home = useMemo(() => new THREE.Vector3(...position), [position[0], position[1], position[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  const w = useRef({ pos: home.clone(), target: null as THREE.Vector3 | null, wait: 1 + Math.random() * 3, walkT: 0 });
  useEffect(() => { npcPos[name] = w.current.pos; return () => { if (npcPos[name] === w.current.pos) delete npcPos[name]; delete bodies[name]; }; }, [name]);
  useFrame((st, dt) => {
    const g = ref.current;
    if (!g) return;
    dt = Math.min(dt, 0.2);
    const t = st.clock.elapsedTime + phase;
    const gs = useGame.getState();
    const s = w.current; const p = s.pos;
    const speaking = gs.lines.length > 0 && gs.talker === name;
    const dPlayer = Math.hypot(player.pos.x - p.x, player.pos.z - p.z);
    const near = dPlayer < 1.9;
    const stop = speaking || near || gs.lines.length > 0 || gs.sleeping;
    let moving = false; let wantRot: number | null = null;
    const goal = npcGoal[name];
    if (goal) {
      // scripted story walk (e.g. the old woman comes to the door, dwarfs head off to the mine)
      const wp = goal.path[goal.i ?? 0];
      const tx = wp === 'player' ? player.pos.x : wp[0], tz = wp === 'player' ? player.pos.z : wp[1];
      const d = new THREE.Vector3(tx - p.x, 0, tz - p.z); const len = d.length();
      const reach = wp === 'player' ? 1.3 : 0.08;
      if (len <= reach) {
        goal.i = (goal.i ?? 0) + 1;
        if (goal.i >= goal.path.length) { npcGoal[name] = undefined; s.target = null; s.wait = 2; goal.done?.(); }
      } else {
        const step = Math.min(len - reach + 0.01, (goal.speed ?? 1.6) * dt);
        p.x += (d.x / len) * step; p.z += (d.z / len) * step; moving = true; wantRot = Math.atan2(d.x, d.z);
      }
    } else if (wander > 0 && !stop) {
      if (!s.target) {
        s.wait -= dt;
        if (s.wait <= 0) {
          for (let i = 0; i < 8; i++) {
            const a = Math.random() * Math.PI * 2, r = wander * (0.35 + Math.random() * 0.65);
            const c = new THREE.Vector3(home.x + Math.cos(a) * r, home.y, home.z + Math.sin(a) * r);
            if (!blocked || !blocked(c.x, c.z)) { s.target = c; break; }
          }
          s.wait = 1.5 + Math.random() * 3;
        }
      } else {
        const d = new THREE.Vector3(s.target.x - p.x, 0, s.target.z - p.z); const len = d.length();
        if (len < 0.05) s.target = null;
        else {
          const step = Math.min(len, speed * dt);
          const nx = p.x + (d.x / len) * step, nz = p.z + (d.z / len) * step;
          if (blocked && blocked(nx, nz)) s.target = null;
          else { p.x = nx; p.z = nz; moving = true; wantRot = Math.atan2(d.x, d.z); }
        }
      }
    }
    if (moving) s.walkT += dt;
    bodies[name] = { r: 0.32 * (scale / 0.68) * 1.0, solid: visible && !asleep, fixed: !!goal || asleep, blocked };
    g.position.x = p.x; g.position.z = p.z;
    g.visible = visible && !convoHidden.has(name); // a bystander blocking the conversation shot steps out of view
    g.position.y = grounds ? groundY(grounds.current, p.x, p.z, position[1]) : position[1];
    poseArms(arms, moving ? 'walk' : speaking ? (gs.lineIdx === 0 ? 'wave' : 'talk') : near ? 'wave' : 'idle', moving ? s.walkT * 0.75 : t, 0.15, phase);
    const body = g.children[0];
    if (asleep) { // lying down, fast asleep (poisoned apple)
      body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, Math.PI / 2, 0.08);
      body.position.y = THREE.MathUtils.lerp(body.position.y, 0.42 * scale, 0.08);
      poseArms(arms, 'idle', 0, 0.2);
      return;
    }
    body.position.y = moving ? Math.abs(Math.sin(s.walkT * 9)) * 0.06 * scale : Math.abs(Math.sin(t * 1.6)) * 0.03 * scale;
    body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, moving ? Math.sin(s.walkT * 9) * 0.07 : 0, 0.3);
    const other = gs.lines.length && gs.talker && gs.talker !== name ? npcPos[gs.talker] : null;
    if (!moving && other && other.distanceTo(p) < 3.5) wantRot = Math.atan2(other.x - p.x, other.z - p.z); // listen to whoever is talking
    else if (!moving && face && (speaking || dPlayer < 4.5)) wantRot = Math.atan2(player.pos.x - p.x, player.pos.z - p.z);
    else if (!moving && wander === 0) wantRot = rotY;
    if (wantRot !== null) {
      let diff = wantRot - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * Math.min(1, dt * (moving ? 8 : 5));
    }
  });
  return (
    <group ref={ref} position={home.toArray() as [number, number, number]} rotation={[0, rotY, 0]} visible={visible}
      onClick={(e) => { e.stopPropagation(); onClick?.(name); }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}>
      <group scale={scale}><primitive object={object} />{children}</group>
      {bubble && visible && (
        <Html position={[0, 2.6 * scale, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="bubble cue">{bubble}</div>
        </Html>
      )}
      {asleep && (
        <Html position={[0, 1.4 * scale, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="zzz">Zzz… ({taps}/5)</div>
        </Html>
      )}
      {label && visible && !hideTag && (
        <Html position={[0, 2.95 * scale, 0]} center distanceFactor={9} style={{ pointerEvents: 'none' }}>
          <div className="nametag">{label}</div>
        </Html>
      )}
    </group>
  );
}
