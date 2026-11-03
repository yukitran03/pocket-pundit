"use client";

// /me "taste room": the viewer's memories as objects in the stands around a small pitch.
// Colour + shape = kind, flare glow + line to the beacon = cited by tonight's brief,
// brightness = Walrus storage life left (dims toward endEpoch), wireframe = not stored (yet).

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { MemoryRow } from "@/lib/contract";
import { KIND_META, type KindShape } from "@/lib/client/kinds";
import { lifeLeft } from "@/lib/client/chain";
import { glowTexture, goalsGeometry, groundMaterial, pitchLinesGeometry, PITCH_M } from "./pitch";

const S = 6.4 / PITCH_M.length;
const HX = (PITCH_M.length * S) / 2;
const HZ = (PITCH_M.width * S) / 2;
const INK = "#060e0b";
const FLARE = new THREE.Color("#f0531c");
const BEACON = new THREE.Vector3(0, 0.05, 0);
export const ROOM_MAX = 96;

export interface RoomItem {
  key: string; // blobId or a synthetic key
  row: MemoryRow;
  cited: boolean;
}

export interface TasteRoomProps {
  items: RoomItem[];
  currentEpoch: number;
  selected: string | null;
  highlighted: Set<string> | null; // recall hits
  onHover: (key: string | null) => void;
  onSelect: (key: string | null) => void;
  reducedMotion: boolean;
  active: boolean;
  allowOrbit: boolean;
}

export default function TasteRoomScene(props: TasteRoomProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={props.reducedMotion ? "demand" : props.active ? "always" : "never"}
      camera={{ fov: 38, position: [0, 4.6, 8.4], near: 0.2, far: 60 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => gl.setClearColor(INK, 1)}
      onPointerMissed={() => props.onSelect(null)}
      aria-hidden
      tabIndex={-1}
    >
      <hemisphereLight args={["#fff1d6", "#0b2416", 0.9]} />
      <pointLight position={[-5, 6, 3]} intensity={30} color="#fff1d6" />
      <pointLight position={[5, 6, 3]} intensity={30} color="#fff1d6" />
      <Room {...props} />
      <FitCamera />
      {props.allowOrbit ? (
        <OrbitControls
          target={[0, 0.9, -1.2]}
          enableZoom={false}
          enablePan={false}
          minAzimuthAngle={-0.45}
          maxAzimuthAngle={0.45}
          minPolarAngle={0.85}
          maxPolarAngle={1.2}
          rotateSpeed={0.5}
          enableDamping={!props.reducedMotion}
        />
      ) : null}
    </Canvas>
  );
}

const ROOM_TARGET = new THREE.Vector3(0, 0.9, -1.2);
const ROOM_DIR = new THREE.Vector3(0, 4.6, 8.4).sub(ROOM_TARGET).normalize();

/** Keep the whole stand in frame at any aspect ratio (portrait phones included). */
function FitCamera() {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const halfV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const d = THREE.MathUtils.clamp(11.2 / (2 * halfV * aspect), 9.2, 24);
    cam.position.copy(ROOM_TARGET).addScaledVector(ROOM_DIR, d);
    cam.lookAt(ROOM_TARGET);
    cam.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, invalidate]);
  return null;
}

/** Seats in raked arcs behind and around the far side of the pitch, newest in the front row. */
function seatLayout(n: number) {
  const seats: THREE.Vector3[] = [];
  let row = 0;
  while (seats.length < n) {
    const radius = 4.3 + row * 0.78;
    const arc = THREE.MathUtils.degToRad(150);
    const count = Math.max(6, Math.floor((radius * arc) / 0.66));
    for (let i = 0; i < count && seats.length < n; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const a = -arc / 2 + t * arc; // 0 = straight behind the pitch
      seats.push(new THREE.Vector3(Math.sin(a) * radius, 0.55 + row * 0.5, -Math.cos(a) * radius + 0.6));
    }
    row++;
  }
  return seats;
}

function geometryFor(shape: KindShape): THREE.BufferGeometry {
  switch (shape) {
    case "sphere": return new THREE.SphereGeometry(0.17, 20, 14);
    case "cube": return new THREE.BoxGeometry(0.27, 0.27, 0.27);
    case "octa": return new THREE.OctahedronGeometry(0.22);
    case "torus": return new THREE.TorusGeometry(0.15, 0.055, 10, 28);
    case "tetra": return new THREE.TetrahedronGeometry(0.2);
  }
}

function Room({ items, currentEpoch, selected, highlighted, onHover, onSelect, reducedMotion }: TasteRoomProps) {
  const shown = items.slice(0, ROOM_MAX);
  const seats = useMemo(() => seatLayout(shown.length), [shown.length]);
  const geos = useMemo(() => {
    const m = new Map<KindShape, THREE.BufferGeometry>();
    (["sphere", "cube", "octa", "torus", "tetra"] as KindShape[]).forEach((s) => m.set(s, geometryFor(s)));
    return m;
  }, []);
  const lines = useMemo(() => pitchLinesGeometry(S, 0.45), []);
  const goals = useMemo(() => goalsGeometry(S), []);
  const ground = useMemo(
    () => groundMaterial({ halfX: HX, halfZ: HZ, lights: [[-HX, -HZ], [HX, -HZ], [-HX, HZ], [HX, HZ]], ink: INK, grassA: "#1b6340", grassB: "#175636" }),
    [],
  );
  const tex = useMemo(() => glowTexture(), []);
  useEffect(() => () => { geos.forEach((g) => g.dispose()); lines.dispose(); goals.dispose(); ground.dispose(); tex.dispose(); }, [geos, lines, goals, ground, tex]);

  const { invalidate } = useThree();
  useEffect(() => { invalidate(); }, [selected, highlighted, items, invalidate]);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} material={ground}>
        <planeGeometry args={[30, 22]} />
      </mesh>
      <mesh geometry={lines} position-y={0.004}>
        <meshBasicMaterial color="#eef3ec" transparent opacity={0.75} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh geometry={goals}>
        <meshBasicMaterial color="#eef3ec" transparent opacity={0.8} toneMapped={false} />
      </mesh>
      <Beacon reducedMotion={reducedMotion} tex={tex} anyCited={shown.some((i) => i.cited)} />
      {shown.map((it, i) => (
        <MemoryObject
          key={it.key}
          item={it}
          seat={seats[i]}
          geo={geos.get(KIND_META[it.row.kind].shape)!}
          life={it.row.status === "stored" ? lifeLeft(it.row.endEpoch, currentEpoch) : 1}
          selected={selected === it.key}
          dimmed={highlighted !== null && !highlighted.has(it.key)}
          lit={highlighted !== null && highlighted.has(it.key)}
          tex={tex}
          reducedMotion={reducedMotion}
          onHover={onHover}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

function Beacon({ reducedMotion, tex, anyCited }: { reducedMotion: boolean; tex: THREE.Texture; anyCited: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (!ring.current || reducedMotion) return;
    const p = (s.clock.elapsedTime % 2.4) / 2.4;
    ring.current.scale.setScalar(1 + p * 2.5);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.7;
  });
  return (
    <group position={BEACON}>
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.2, 0.26, 40]} />
        <meshBasicMaterial color={anyCited ? "#f0531c" : "#83958a"} toneMapped={false} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.003}>
        <ringGeometry args={[0.2, 0.235, 40]} />
        <meshBasicMaterial color="#f0531c" transparent opacity={reducedMotion ? 0.3 : 0} depthWrite={false} toneMapped={false} />
      </mesh>
      <sprite scale={[1.6, 1.6, 1]} position-y={0.1}>
        <spriteMaterial map={tex} color="#f0531c" transparent opacity={anyCited ? 0.5 : 0.15} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  );
}

function MemoryObject({
  item, seat, geo, life, selected, dimmed, lit, tex, reducedMotion, onHover, onSelect,
}: {
  item: RoomItem; seat: THREE.Vector3; geo: THREE.BufferGeometry; life: number; selected: boolean; dimmed: boolean; lit: boolean;
  tex: THREE.Texture; reducedMotion: boolean; onHover: (k: string | null) => void; onSelect: (k: string | null) => void;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Sprite>(null);
  const kindColor = useMemo(() => new THREE.Color(KIND_META[item.row.kind].color), [item.row.kind]);
  const stored = item.row.status === "stored";
  const expired = stored && life <= 0;
  const glowing = item.cited || lit;
  const color = glowing ? FLARE : kindColor;
  const brightness = dimmed ? 0.18 : (0.3 + 0.7 * life) * (stored ? 1 : 0.55);
  const phase = useMemo(() => (seat.x * 13.7 + seat.z * 7.1) % (Math.PI * 2), [seat]);

  const link = useMemo(() => {
    if (!item.cited) return null;
    const ctrl = seat.clone().lerp(BEACON, 0.5);
    ctrl.y += 1.4;
    const pts = new THREE.QuadraticBezierCurve3(seat.clone(), ctrl, BEACON.clone()).getPoints(32);
    const g = new LineGeometry();
    g.setPositions(pts.flatMap((p) => [p.x, p.y, p.z]));
    const m = new LineMaterial({ color: 0xf0531c, linewidth: 1.4, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false });
    const l = new Line2(g, m);
    l.frustumCulled = false;
    return l;
  }, [item.cited, seat]);
  useEffect(() => () => { link?.geometry.dispose(); (link?.material as LineMaterial | undefined)?.dispose(); }, [link]);

  useFrame((s) => {
    if (!mesh.current) return;
    const t = s.clock.elapsedTime;
    if (!reducedMotion) {
      mesh.current.rotation.y = t * 0.35 + phase;
      mesh.current.rotation.x = Math.sin(t * 0.5 + phase) * 0.25;
      mesh.current.position.y = seat.y + (selected ? Math.sin(t * 2.2) * 0.06 + 0.12 : Math.sin(t * 0.8 + phase) * 0.025);
    } else {
      mesh.current.position.y = seat.y + (selected ? 0.12 : 0);
    }
    if (halo.current) halo.current.position.copy(mesh.current.position);
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(item.key);
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    onHover(null);
    document.body.style.cursor = "";
  };
  useEffect(() => () => { document.body.style.cursor = ""; }, []);

  const scale = (selected ? 1.4 : glowing ? 1.18 : 1) * (expired ? 0.85 : 1);

  return (
    <group>
      <mesh
        ref={mesh}
        geometry={geo}
        position={seat}
        scale={scale}
        onPointerOver={over}
        onPointerOut={out}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(selected ? null : item.key);
        }}
      >
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={(glowing ? 1.4 : 0.55) * brightness}
          roughness={0.55}
          metalness={0.05}
          transparent
          opacity={Math.max(0.2, brightness + (glowing ? 0.2 : 0))}
          wireframe={!stored || expired}
          toneMapped={!glowing}
        />
      </mesh>
      {glowing || selected ? (
        <sprite ref={halo} position={seat} scale={selected ? [1.4, 1.4, 1] : [1.05, 1.05, 1]}>
          <spriteMaterial map={tex} color={selected ? "#eef3ec" : "#f0531c"} transparent opacity={selected ? 0.35 : 0.55 * (dimmed ? 0.3 : 1)} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </sprite>
      ) : null}
      {link ? <primitive object={link} /> : null}
    </group>
  );
}
