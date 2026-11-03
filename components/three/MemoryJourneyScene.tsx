"use client";

// "Memory journey": a rating tile lifts off a small pitch, is sealed into a blob, drops into a Walrus
// stack, and a reading beam carries it up to a Sui checkpoint ring ("read via Tatum").
// Progress (0..1) comes from scroll position while the visitor is scrolling, and loops slowly otherwise.

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { glowTexture, pitchLinesGeometry, PITCH_M } from "./pitch";

export interface JourneyDrive {
  /** Scroll-derived progress, 0..1. */
  scroll: number;
  /** performance.now() of the last scroll event. */
  scrolledAt: number;
}

export interface MemoryJourneyProps {
  drive: MutableRefObject<JourneyDrive>;
  active: boolean;
  /** DOM labels owned by the wrapper; the scene only moves them to their anchors. */
  labels: MutableRefObject<(HTMLElement | null)[]>;
  onReady?: () => void;
}

const INK = "#060e0b";
const AMBER = new THREE.Color("#c98500");
const FLARE = new THREE.Color("#f0531c");
const CHALK = new THREE.Color("#eef3ec");
const OK = new THREE.Color("#0ca30c");
const STEEL = new THREE.Color("#8fb8ec");

const PITCH_AT = new THREE.Vector3(-2.85, 0, 0.35);
const PITCH_W = 3.0;
const STACK_AT = new THREE.Vector3(0.25, 0, 0);
const SLABS = 6;
const SLAB_H = 0.14;
const SLAB_GAP = 0.06;
const STACK_TOP = SLABS * (SLAB_H + SLAB_GAP);
const RING_AT = new THREE.Vector3(2.95, 2.85, 0);
const AIM = new THREE.Vector3(-0.15, 1.45, 0.2);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const ease = (x: number) => x * x * (3 - 2 * x);

export default function MemoryJourneyScene({ drive, active, labels, onReady }: MemoryJourneyProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={active ? "always" : "never"}
      camera={{ fov: 30, position: [0, 5.4, 13], near: 0.5, far: 60 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(INK, 1);
        requestAnimationFrame(() => onReady?.());
      }}
      aria-hidden
      tabIndex={-1}
    >
      <Rig />
      <Journey drive={drive} labels={labels} />
    </Canvas>
  );
}

/** Fit the diorama (about 8.6 units wide) at any aspect, looking slightly down at it. */
function Rig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const halfV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const d = THREE.MathUtils.clamp(Math.max(9.4 / (2 * halfV * aspect), 4.6 / (2 * halfV)), 9, 30);
    const elev = THREE.MathUtils.degToRad(20);
    cam.position.set(AIM.x, AIM.y + Math.sin(elev) * d, AIM.z + Math.cos(elev) * d);
    cam.lookAt(AIM);
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

/** Label anchors in world space, in the order the wrapper renders its labels. */
export const LABEL_ANCHORS: [number, number, number][] = [
  [PITCH_AT.x, 0, PITCH_AT.z + 1.55],
  [STACK_AT.x, 0, 1.3],
  [RING_AT.x, RING_AT.y - 0.95, 0],
];

function Journey({ drive, labels }: { drive: MutableRefObject<JourneyDrive>; labels: MutableRefObject<(HTMLElement | null)[]> }) {
  const p = useRef(0.08);
  const tile = useRef<THREE.Group>(null);
  const blob = useRef<THREE.Group>(null);
  const blobHalo = useRef<THREE.Sprite>(null);
  const slabs = useRef<(THREE.Mesh | null)[]>([]);
  const beam = useRef<THREE.Mesh>(null);
  const spark = useRef<THREE.Sprite>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringPulse = useRef<THREE.Mesh>(null);
  const ringHalo = useRef<THREE.Sprite>(null);

  const tex = useMemo(() => glowTexture(), []);
  const lines = useMemo(() => pitchLinesGeometry(PITCH_W / PITCH_M.length, 1.1), []);
  const tileGeo = useMemo(() => roundedRect(0.62, 0.42, 0.06), []);
  const slabGeo = useMemo(() => new THREE.BoxGeometry(1.5, SLAB_H, 1.5), []);
  const slabEdges = useMemo(() => new THREE.EdgesGeometry(slabGeo), [slabGeo]);
  const blobGeo = useMemo(() => new THREE.BoxGeometry(0.54, 0.54, 0.54), []);
  const blobEdges = useMemo(() => new THREE.EdgesGeometry(blobGeo), [blobGeo]);
  useEffect(() => () => { tex.dispose(); lines.dispose(); tileGeo.dispose(); slabGeo.dispose(); slabEdges.dispose(); blobGeo.dispose(); blobEdges.dispose(); }, [tex, lines, tileGeo, slabGeo, slabEdges, blobGeo, blobEdges]);

  // Beam from the top of the stack to the ring.
  const beamFrom = useMemo(() => STACK_AT.clone().setY(STACK_TOP + 0.5), []);
  const beamDir = useMemo(() => RING_AT.clone().sub(beamFrom), [beamFrom]);
  const beamLen = beamDir.length();
  const beamQuat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamDir.clone().normalize()), [beamDir]);

  const tileStart = useMemo(() => PITCH_AT.clone().setY(0.03), []);
  const tileUp = useMemo(() => PITCH_AT.clone().add(new THREE.Vector3(0.3, 1.45, 0.2)), []);
  const blobHover = useMemo(() => STACK_AT.clone().setY(STACK_TOP + 1.9), []);
  const blobRest = useMemo(() => STACK_AT.clone().setY(STACK_TOP + 0.28), []);
  const anchors = useMemo(() => LABEL_ANCHORS.map((a) => new THREE.Vector3(...a)), []);
  const v = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Color(), q: new THREE.Quaternion(), flat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)) }), []);

  useFrame((state, dt) => {
    const d = drive.current;
    const scrolling = performance.now() - d.scrolledAt < 1400;
    if (scrolling) p.current += (d.scroll - p.current) * Math.min(1, dt * 4);
    else p.current = (p.current + dt / 10) % 1;
    const P = p.current;
    const t = state.clock.elapsedTime;
    const camQ = state.camera.quaternion;

    // 1) lift off the pitch (0.02 to 0.2)
    const lift = ease(seg(P, 0.02, 0.2));
    // 2) travel and seal (0.2 to 0.42): the tile shrinks as the blob grows
    const travel = ease(seg(P, 0.2, 0.42));
    const seal = ease(seg(P, 0.3, 0.42));
    // 3) drop into the stack (0.44 to 0.54)
    const drop = seg(P, 0.44, 0.54);
    // 4) read beam (0.58 to 0.78), ring confirms (0.78 to 0.86)
    const read = ease(seg(P, 0.58, 0.78));
    const confirm = seg(P, 0.78, 0.86);
    // 5) settle and fade before the loop restarts (0.92 to 1)
    const out = 1 - seg(P, 0.92, 1);
    const fadeIn = seg(P, 0, 0.03);

    if (tile.current) {
      v.a.copy(tileStart).lerp(tileUp, lift);
      v.b.copy(tileUp).lerp(blobHover, travel);
      tile.current.position.copy(travel > 0 ? v.b : v.a);
      tile.current.position.y += Math.sin(t * 2.2) * 0.04 * lift * (1 - travel);
      v.q.copy(v.flat).slerp(camQ, lift);
      tile.current.quaternion.copy(v.q);
      const s = (1 - seal) * fadeIn;
      tile.current.scale.setScalar(Math.max(0.0001, s));
      tile.current.visible = s > 0.01;
    }
    if (blob.current) {
      const s = seal * out;
      const fall = drop * drop;
      v.a.copy(blobHover).lerp(blobRest, fall);
      // a small bounce when it lands
      if (drop >= 1) v.a.y += Math.abs(Math.sin(seg(P, 0.54, 0.6) * Math.PI)) * 0.08 * (1 - seg(P, 0.54, 0.6));
      blob.current.position.copy(v.a);
      blob.current.rotation.set(0.35 * (1 - drop), t * 0.6 * (1 - drop) + 0.6, 0.2 * (1 - drop));
      blob.current.scale.setScalar(Math.max(0.0001, s));
      blob.current.visible = s > 0.01;
    }
    if (blobHalo.current) {
      blobHalo.current.position.copy(blob.current?.position ?? blobRest);
      (blobHalo.current.material as THREE.SpriteMaterial).opacity = 0.65 * seal * out * (0.8 + 0.2 * Math.sin(t * 5));
    }

    // The stack glows from the bottom up when the blob lands.
    const land = seg(P, 0.53, 0.62) * (1 - seg(P, 0.62, 0.75)) + seg(P, 0.53, 0.56) * 0.2;
    slabs.current.forEach((m, i) => {
      if (!m) return;
      const mat = m.material as THREE.MeshBasicMaterial;
      const wave = clamp01(land * 1.6 - i * 0.12);
      v.c.set("#14261c").lerp(FLARE, wave * 0.34);
      mat.color.copy(v.c);
    });

    if (beam.current) {
      beam.current.scale.set(1, Math.max(0.0001, read), 1);
      beam.current.position.copy(beamFrom).addScaledVector(beamDir, read / 2);
      (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.55 * (read > 0 ? 1 : 0) * out;
    }
    if (spark.current) {
      const k = (t * 0.9) % 1;
      spark.current.position.copy(beamFrom).addScaledVector(beamDir, k * read);
      (spark.current.material as THREE.SpriteMaterial).opacity = read > 0.98 ? 0.9 * out * (1 - k * 0.6) : read * 0.9;
    }
    if (ring.current) {
      ring.current.quaternion.copy(camQ);
      v.c.copy(STEEL).lerp(OK, confirm);
      (ring.current.material as THREE.MeshBasicMaterial).color.copy(v.c);
    }
    if (ringPulse.current) {
      ringPulse.current.quaternion.copy(camQ);
      const k = confirm > 0 && confirm < 1 ? confirm : 0;
      ringPulse.current.scale.setScalar(1 + k * 0.9);
      (ringPulse.current.material as THREE.MeshBasicMaterial).opacity = k ? (1 - k) * 0.8 : 0;
    }
    if (ringHalo.current) (ringHalo.current.material as THREE.SpriteMaterial).opacity = 0.18 + 0.45 * confirm * out;

    // Keep the DOM labels on their anchors.
    const { width, height } = state.size;
    anchors.forEach((a, i) => {
      const el = labels.current[i];
      if (!el) return;
      v.b.copy(a).project(state.camera);
      el.style.transform = `translate(-50%, -50%) translate(${((v.b.x + 1) / 2) * width}px, ${((1 - v.b.y) / 2) * height}px)`;
      el.style.opacity = "1"; // hidden until placed at least once
    });
  });

  return (
    <group>
      {/* the small pitch the rating comes from */}
      <group position={PITCH_AT}>
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[PITCH_W, PITCH_W * (PITCH_M.width / PITCH_M.length)]} />
          <meshBasicMaterial color="#1b5c3b" toneMapped={false} />
        </mesh>
        <mesh geometry={lines} position-y={0.006}>
          <meshBasicMaterial color="#eef3ec" transparent opacity={0.7} toneMapped={false} depthWrite={false} />
        </mesh>
      </group>

      {/* the rating tile */}
      <group ref={tile}>
        <mesh geometry={tileGeo}>
          <meshBasicMaterial color={AMBER} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        <mesh position={[-0.06, 0.06, 0.003]}>
          <planeGeometry args={[0.36, 0.05]} />
          <meshBasicMaterial color="#1a0f00" side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        <mesh position={[-0.1, -0.06, 0.003]}>
          <planeGeometry args={[0.28, 0.04]} />
          <meshBasicMaterial color="#5a3b00" side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        <sprite scale={[1.6, 1.6, 1]} position-z={-0.02}>
          <spriteMaterial map={tex} color="#c98500" transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </sprite>
      </group>

      {/* the sealed blob */}
      <group ref={blob}>
        <mesh geometry={blobGeo}>
          <meshBasicMaterial color="#1a2e23" toneMapped={false} />
        </mesh>
        <lineSegments geometry={blobEdges}>
          <lineBasicMaterial color={FLARE} toneMapped={false} />
        </lineSegments>
        <mesh position-z={0.272}>
          <planeGeometry args={[0.18, 0.13]} />
          <meshBasicMaterial color={FLARE} toneMapped={false} />
        </mesh>
      </group>
      <sprite ref={blobHalo} scale={[1.7, 1.7, 1]}>
        <spriteMaterial map={tex} color="#f0531c" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>

      {/* the Walrus stack */}
      <group position={STACK_AT}>
        {Array.from({ length: SLABS }, (_, i) => (
          <group key={i} position-y={SLAB_H / 2 + i * (SLAB_H + SLAB_GAP)}>
            <mesh ref={(m) => { slabs.current[i] = m; }} geometry={slabGeo}>
              <meshBasicMaterial color="#14261c" toneMapped={false} />
            </mesh>
            <lineSegments geometry={slabEdges}>
              <lineBasicMaterial color={CHALK} transparent opacity={0.28} toneMapped={false} />
            </lineSegments>
          </group>
        ))}
      </group>

      {/* the reading beam and the Sui checkpoint ring */}
      <mesh ref={beam} quaternion={beamQuat}>
        <cylinderGeometry args={[0.025, 0.025, beamLen, 8, 1, true]} />
        <meshBasicMaterial color={STEEL} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <sprite ref={spark} scale={[0.6, 0.6, 1]}>
        <spriteMaterial map={tex} color="#cfe2ff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
      <group position={RING_AT}>
        <mesh ref={ring}>
          <torusGeometry args={[0.62, 0.045, 12, 72]} />
          <meshBasicMaterial color={STEEL} toneMapped={false} />
        </mesh>
        <mesh ref={ringPulse}>
          <torusGeometry args={[0.62, 0.02, 8, 72]} />
          <meshBasicMaterial color={OK} transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
        <sprite ref={ringHalo} scale={[2.6, 2.6, 1]}>
          <spriteMaterial map={tex} color="#8fb8ec" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </sprite>
      </group>

    </group>
  );
}

function roundedRect(w: number, h: number, r: number) {
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
  return new THREE.ShapeGeometry(s, 4);
}
