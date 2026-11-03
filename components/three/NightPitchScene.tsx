"use client";

// Hero scene: a night pitch from the stands, floodlit, with memories floating above it.
// Every few seconds a handful of memories are recalled: they turn flare and draw a line to tonight's pick.

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { coneMaterial, glowTexture, goalsGeometry, groundMaterial, mulberry32, pitchLinesGeometry, PITCH_M } from "./pitch";

const S = 16 / PITCH_M.length; // scene units per metre
const HX = (PITCH_M.length * S) / 2; // 8
const HZ = (PITCH_M.width * S) / 2; // ≈5.18
const INK = "#060e0b";
const FLARE = new THREE.Color("#f0531c");
const KIND_COLORS = ["#c98500", "#c98500", "#c98500", "#008300", "#008300", "#9085e9", "#9085e9", "#d55181"].map((c) => new THREE.Color(c));
const PICK_POS = new THREE.Vector3(0, 1.55, 0.25);
const CYCLE = 4.6;
const MAX_LINKS = 4;
const SEGMENTS = 36;

export interface NightPitchProps {
  memoryCount: number;
  reducedMotion: boolean;
  active: boolean;
  onReady?: () => void;
  /** 0 at the top of the page, 1 once the hero has scrolled away. Tilts the camera and lifts tonight's three. */
  scroll?: MutableRefObject<number>;
}

export default function NightPitchScene({ memoryCount, reducedMotion, active, onReady, scroll }: NightPitchProps) {
  const fallback = useRef(0);
  const s = scroll ?? fallback;
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={reducedMotion ? "demand" : active ? "always" : "never"}
      camera={{ fov: 30, position: [0, 13, 19], near: 0.5, far: 90 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(INK, 1);
        requestAnimationFrame(() => onReady?.());
      }}
      aria-hidden
      tabIndex={-1}
    >
      <CameraRig reducedMotion={reducedMotion} scroll={s} />
      <Ground />
      <Markings />
      <Floodlights />
      <Memories count={memoryCount} reducedMotion={reducedMotion} />
      {reducedMotion ? null : <RisingPicks scroll={s} />}
    </Canvas>
  );
}

const SCROLL_TILT = THREE.MathUtils.degToRad(16);

function CameraRig({ reducedMotion, scroll }: { reducedMotion: boolean; scroll: MutableRefObject<number> }) {
  const { camera, size, invalidate } = useThree();
  const target = useMemo(() => new THREE.Vector3(0, 0.35, -0.4), []);
  const base = useRef(new THREE.Vector3());
  const fit = useRef({ d: 20, elev: THREE.MathUtils.degToRad(37) });
  const smooth = useRef(0);

  useEffect(() => {
    // Fit the 16-unit pitch (plus floodlights) to the box width at any aspect.
    const aspect = size.width / Math.max(1, size.height);
    const cam = camera as THREE.PerspectiveCamera;
    const halfV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const wanted = aspect < 1 ? 17.5 : 19.5;
    const d = THREE.MathUtils.clamp(wanted / (2 * halfV * aspect), 17, 44);
    const elev = THREE.MathUtils.degToRad(37);
    fit.current = { d, elev };
    base.current.set(0, Math.sin(elev) * d, Math.cos(elev) * d);
    cam.position.copy(base.current);
    cam.lookAt(target);
    cam.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, target, invalidate]);

  useFrame((state, dt) => {
    if (reducedMotion) return;
    // Scroll tilts the view toward overhead and dollies in a little, as tonight's three lift off.
    smooth.current += (scroll.current - smooth.current) * Math.min(1, dt * 5);
    const k = smooth.current;
    const e = fit.current.elev + SCROLL_TILT * k;
    const d = fit.current.d * (1 - 0.14 * k);
    base.current.set(0, Math.sin(e) * d, Math.cos(e) * d);
    const t = state.clock.elapsedTime;
    const px = state.pointer.x * 0.55 + Math.sin(t * 0.07) * 0.7;
    const py = state.pointer.y * 0.3;
    camera.position.x += (base.current.x + px - camera.position.x) * 0.04;
    camera.position.y += (base.current.y + py - camera.position.y) * 0.04;
    camera.position.z = base.current.z;
    camera.lookAt(target);
  });
  return null;
}

function Ground() {
  const lights: [number, number][] = [[-HX - 1.4, -HZ - 1.2], [HX + 1.4, -HZ - 1.2], [-HX - 1.4, HZ + 1.2], [HX + 1.4, HZ + 1.2]];
  const mat = useMemo(() => groundMaterial({ halfX: HX, halfZ: HZ, lights, ink: INK, grassA: "#1d6a43", grassB: "#195c3a" }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh rotation-x={-Math.PI / 2} material={mat}>
      <planeGeometry args={[HX * 5, HZ * 5]} />
    </mesh>
  );
}

function Markings() {
  const lines = useMemo(() => pitchLinesGeometry(S), []);
  const goals = useMemo(() => goalsGeometry(S), []);
  useEffect(() => () => { lines.dispose(); goals.dispose(); }, [lines, goals]);
  return (
    <group>
      <mesh geometry={lines} position-y={0.004}>
        <meshBasicMaterial color="#eef3ec" transparent opacity={0.78} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh geometry={goals}>
        <meshBasicMaterial color="#eef3ec" transparent opacity={0.85} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Floodlights() {
  const tex = useMemo(() => glowTexture(), []);
  const cone = useMemo(() => coneMaterial("#fff1d0"), []);
  useEffect(() => () => { tex.dispose(); cone.dispose(); }, [tex, cone]);

  const masts = useMemo(() => {
    const H = 4.4;
    return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => {
      const foot = new THREE.Vector3(sx * (HX + 1.5), 0, sz * (HZ + 1.3));
      const head = foot.clone().setY(H);
      const aim = new THREE.Vector3(sx * HX * 0.15, 0, sz * HZ * 0.1);
      const dir = head.clone().sub(aim);
      const len = dir.length();
      const mid = head.clone().add(aim).multiplyScalar(0.5);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      const headRot = new THREE.Euler(0, Math.atan2(-foot.x, -foot.z), 0);
      return { foot, head, len, mid, q, headRot, H };
    });
  }, []);

  return (
    <group>
      {masts.map((m, i) => (
        <group key={i}>
          <mesh position={[m.foot.x, m.H / 2, m.foot.z]}>
            <cylinderGeometry args={[0.035, 0.06, m.H, 6]} />
            <meshBasicMaterial color="#22302a" />
          </mesh>
          <mesh position={m.head} rotation={m.headRot}>
            <boxGeometry args={[1.05, 0.42, 0.06]} />
            <meshBasicMaterial color="#fff6e3" toneMapped={false} />
          </mesh>
          <sprite position={m.head} scale={[3.6, 3.6, 1]}>
            <spriteMaterial map={tex} color="#ffe7bf" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </sprite>
          <mesh position={m.mid} quaternion={m.q} material={cone}>
            <cylinderGeometry args={[0.3, 3.4, m.len, 28, 1, true]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

type Mem = { pos: THREE.Vector3; color: THREE.Color; phase: number; speed: number };

function Memories({ count, reducedMotion }: { count: number; reducedMotion: boolean }) {
  const n = Math.max(12, Math.min(64, Math.round(count)));
  const { camera, invalidate } = useThree();
  const cards = useRef<THREE.InstancedMesh>(null);
  const halos = useRef<THREE.InstancedMesh>(null);
  const pick = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);

  const mems = useMemo<Mem[]>(() => {
    const rnd = mulberry32(7 + n);
    return Array.from({ length: n }, (_, i) => {
      // Keep the centre column clear for tonight's pick.
      let x = (rnd() * 2 - 1) * (HX - 0.8);
      if (Math.abs(x) < 1.3) x = Math.sign(x || 1) * (1.3 + rnd() * 1.5);
      const z = (rnd() * 2 - 1) * (HZ - 0.4);
      const y = 1.0 + rnd() * 2.3;
      return { pos: new THREE.Vector3(x, y, z), color: KIND_COLORS[i % KIND_COLORS.length].clone(), phase: rnd() * Math.PI * 2, speed: 0.5 + rnd() * 0.5 };
    });
  }, [n]);

  const cardGeo = useMemo(() => {
    const w = 0.4, h = 0.27, r = 0.05;
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2);
    s.lineTo(w / 2 - r, -h / 2);
    s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r);
    s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r);
    s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return new THREE.ShapeGeometry(s, 3);
  }, []);
  const tex = useMemo(() => glowTexture(), []);
  const beamMat = useMemo(() => {
    const m = coneMaterial("#f0531c");
    m.uniforms.uOpacity.value = 0.32;
    return m;
  }, []);
  useEffect(() => () => { cardGeo.dispose(); tex.dispose(); beamMat.dispose(); }, [cardGeo, tex, beamMat]);

  // Recall lines (Line2 so they keep pixel width on any DPR).
  const links = useMemo(() => {
    return Array.from({ length: MAX_LINKS }, () => {
      const geo = new LineGeometry();
      geo.setPositions(new Array((SEGMENTS + 1) * 3).fill(0));
      const mat = new LineMaterial({ color: 0xf0531c, linewidth: 1.6, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
      const line = new Line2(geo, mat);
      line.frustumCulled = false;
      return line;
    });
  }, []);
  useEffect(() => () => links.forEach((l) => { l.geometry.dispose(); (l.material as LineMaterial).dispose(); }), [links]);

  const cycle = useRef({ index: -1, chosen: [] as number[] });
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color(), q: new THREE.Quaternion() }), []);

  const choose = (k: number) => {
    const rnd = mulberry32(1000 + k * 17);
    const want = 3 + (k % 2);
    const picked = new Set<number>();
    while (picked.size < Math.min(want, n)) picked.add(Math.floor(rnd() * n));
    return [...picked];
  };

  const layLink = (line: Line2, from: THREE.Vector3) => {
    const ctrl = from.clone().lerp(PICK_POS, 0.5);
    ctrl.y += 1.1;
    const curve = new THREE.QuadraticBezierCurve3(from.clone(), ctrl, PICK_POS.clone());
    const pts = curve.getPoints(SEGMENTS);
    line.geometry.setPositions(pts.flatMap((p) => [p.x, p.y, p.z]));
  };

  useFrame((state) => {
    const t = reducedMotion ? 1.9 : state.clock.elapsedTime;
    const k = reducedMotion ? 0 : Math.floor(t / CYCLE);
    const ct = reducedMotion ? 1.9 : t - k * CYCLE; // time within cycle

    if (cycle.current.index !== k) {
      cycle.current.index = k;
      cycle.current.chosen = choose(k);
      cycle.current.chosen.slice(0, MAX_LINKS).forEach((i, j) => layLink(links[j], mems[i].pos));
    }
    const chosen = cycle.current.chosen;

    const rise = THREE.MathUtils.smoothstep(ct, 0.15, 0.75);
    const fall = 1 - THREE.MathUtils.smoothstep(ct, 3.4, 4.2);
    const act = rise * fall;
    const draw = THREE.MathUtils.smoothstep(ct, 0.45, 1.6);

    const camQ = camera.quaternion;
    for (let i = 0; i < n; i++) {
      const m = mems[i];
      const isOn = chosen.includes(i);
      const a = isOn ? act : 0;
      const bob = reducedMotion ? 0 : Math.sin(t * m.speed + m.phase) * 0.09 * (1 - a);
      tmp.p.copy(m.pos).setY(m.pos.y + bob);
      const sc = 1 + a * 0.45;
      tmp.s.set(sc, sc, sc);
      tmp.m.compose(tmp.p, camQ, tmp.s);
      cards.current?.setMatrixAt(i, tmp.m);
      tmp.c.copy(m.color).lerp(FLARE, a);
      cards.current?.setColorAt(i, tmp.c);
      const hs = 1.5 + a * 1.6;
      tmp.s.set(hs, hs, hs);
      tmp.m.compose(tmp.p, camQ, tmp.s);
      halos.current?.setMatrixAt(i, tmp.m);
      tmp.c.multiplyScalar(0.28 + a * 0.75);
      halos.current?.setColorAt(i, tmp.c);
    }
    for (const mesh of [cards.current, halos.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    links.forEach((line, j) => {
      const on = j < chosen.length;
      const mat = line.material as LineMaterial;
      mat.opacity = on ? 0.95 * fall : 0;
      line.visible = on && mat.opacity > 0.01;
      // stagger each link slightly
      const d = THREE.MathUtils.clamp(draw * 1.25 - j * 0.08, 0, 1);
      line.geometry.instanceCount = Math.max(0, Math.round(d * SEGMENTS));
    });

    if (pick.current) {
      pick.current.quaternion.copy(camQ);
      const glow = 0.55 + 0.45 * THREE.MathUtils.smoothstep(ct, 1.3, 1.7) * fall;
      pick.current.scale.setScalar(1 + 0.06 * glow);
    }
    if (pulse.current) {
      const pt = reducedMotion ? 0.4 : THREE.MathUtils.clamp((ct - 1.5) / 1.2, 0, 1);
      pulse.current.scale.setScalar(1 + pt * 3.2);
      (pulse.current.material as THREE.MeshBasicMaterial).opacity = (1 - pt) * 0.8 * (ct > 1.5 || reducedMotion ? 1 : 0);
    }
    if (beam.current) (beam.current.material as THREE.ShaderMaterial).uniforms.uOpacity.value = 0.12 + 0.22 * act;
  });

  // demand-mode (reduced motion): render once after mount
  useEffect(() => {
    if (reducedMotion) invalidate();
  }, [reducedMotion, invalidate]);

  return (
    <group>
      <instancedMesh ref={halos} args={[undefined, undefined, n]} frustumCulled={false}>
        <planeGeometry args={[0.5, 0.5]} />
        <meshBasicMaterial map={tex} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={cards} args={[cardGeo, undefined, n]} frustumCulled={false}>
        <meshBasicMaterial transparent opacity={0.94} side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>

      {links.map((l, i) => (
        <primitive key={i} object={l} />
      ))}

      {/* Tonight's pick: a chalk card with a flare edge, a beam down to the centre spot, a pulse ring. */}
      <group ref={pick} position={PICK_POS}>
        <mesh>
          <planeGeometry args={[1.02, 0.64]} />
          <meshBasicMaterial color="#f0531c" toneMapped={false} />
        </mesh>
        <mesh position-z={0.002}>
          <planeGeometry args={[0.94, 0.56]} />
          <meshBasicMaterial color="#eef3ec" toneMapped={false} />
        </mesh>
        {[0.12, -0.02, -0.14].map((y, i) => (
          <mesh key={i} position={[-0.12 + (i === 0 ? 0.05 : 0), y, 0.004]}>
            <planeGeometry args={[i === 0 ? 0.56 : 0.46 - i * 0.08, 0.045]} />
            <meshBasicMaterial color={i === 0 ? "#0c1a14" : "#83958a"} toneMapped={false} />
          </mesh>
        ))}
        <sprite scale={[2.6, 2.6, 1]} position-z={-0.05}>
          <spriteMaterial map={tex} color="#f0531c" transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </sprite>
      </group>
      <mesh ref={beam} position={[0, PICK_POS.y / 2 - 0.15, 0.12]} material={beamMat}>
        <cylinderGeometry args={[0.05, 0.38, PICK_POS.y - 0.3, 16, 1, true]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.01}>
        <ringGeometry args={[0.3, 0.36, 48]} />
        <meshBasicMaterial color="#f0531c" toneMapped={false} />
      </mesh>
      <mesh ref={pulse} rotation-x={-Math.PI / 2} position-y={0.012}>
        <ringGeometry args={[0.3, 0.34, 48]} />
        <meshBasicMaterial color="#f0531c" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * Tonight's three: chalk cards lying on the grass at the top of the page. As the visitor scrolls, they
 * lift off the pitch one after another, turn to face the camera and come toward it.
 */
const RISE = [
  { from: new THREE.Vector3(-3.1, 0.03, 2.1), to: new THREE.Vector3(-2.15, 3.2, 4.6) },
  { from: new THREE.Vector3(0, 0.03, 3.0), to: new THREE.Vector3(0, 3.75, 5.4) },
  { from: new THREE.Vector3(3.1, 0.03, 2.1), to: new THREE.Vector3(2.15, 3.2, 4.6) },
];

function RisingPicks({ scroll }: { scroll: MutableRefObject<number> }) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const faces = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const smooth = useRef(0);
  const tmp = useMemo(() => ({ flat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), q: new THREE.Quaternion() }), []);

  useFrame((state, dt) => {
    smooth.current += (scroll.current - smooth.current) * Math.min(1, dt * 5);
    const s = smooth.current;
    RISE.forEach((r, i) => {
      const g = groups.current[i];
      if (!g) return;
      const k0 = THREE.MathUtils.clamp(s * 1.7 - i * 0.18, 0, 1);
      const k = k0 * k0 * (3 - 2 * k0);
      g.position.lerpVectors(r.from, r.to, k);
      g.position.y += Math.sin(state.clock.elapsedTime * 1.3 + i) * 0.05 * k;
      tmp.q.copy(tmp.flat).slerp(state.camera.quaternion, k);
      g.quaternion.copy(tmp.q);
      g.scale.setScalar(1 + k * 0.35);
      const face = faces.current[i];
      if (face) face.opacity = 0.32 + 0.68 * k;
    });
  });

  return (
    <group>
      {RISE.map((r, i) => (
        <group key={i} ref={(g) => { groups.current[i] = g; }} position={r.from}>
          <mesh>
            <planeGeometry args={[0.98, 0.62]} />
            <meshBasicMaterial color="#f0531c" transparent opacity={0.85} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
          <mesh position-z={0.003}>
            <planeGeometry args={[0.9, 0.54]} />
            <meshBasicMaterial ref={(m) => { faces.current[i] = m; }} color="#eef3ec" transparent opacity={0.32} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
          {[0.11, -0.02, -0.13].map((y, j) => (
            <mesh key={j} position={[-0.1 + (j === 0 ? 0.04 : 0), y, 0.006]}>
              <planeGeometry args={[j === 0 ? 0.52 : 0.42 - j * 0.07, 0.045]} />
              <meshBasicMaterial color={j === 0 ? "#0c1a14" : "#83958a"} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
