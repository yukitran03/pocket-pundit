// Pitch construction shared by the hero scene and the taste room.
// Real markings in metres (105 × 68), scaled into scene units.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const PITCH_M = { length: 105, width: 68 };

/** Flat chalk markings merged into one geometry (one draw call). */
export function pitchLinesGeometry(scale: number, lineM = 0.24): THREE.BufferGeometry {
  const L = PITCH_M.length / 2;
  const W = PITCH_M.width / 2;
  const t = lineM; // line thickness in metres
  const parts: THREE.BufferGeometry[] = [];

  const seg = (x1: number, z1: number, x2: number, z2: number) => {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz) + t;
    const g = new THREE.PlaneGeometry(len, t);
    g.rotateX(-Math.PI / 2);
    g.rotateY(-Math.atan2(dz, dx));
    g.translate((x1 + x2) / 2, 0, (z1 + z2) / 2);
    parts.push(g);
  };
  const arc = (cx: number, cz: number, r: number, start = 0, length = Math.PI * 2) => {
    const g = new THREE.RingGeometry(r - t / 2, r + t / 2, 72, 1, start, length);
    g.rotateX(-Math.PI / 2);
    g.translate(cx, 0, cz);
    parts.push(g);
  };
  const spot = (cx: number, cz: number, r = 0.32) => {
    const g = new THREE.CircleGeometry(r, 20);
    g.rotateX(-Math.PI / 2);
    g.translate(cx, 0, cz);
    parts.push(g);
  };

  // boundary + halfway
  seg(-L, -W, L, -W);
  seg(-L, W, L, W);
  seg(-L, -W, -L, W);
  seg(L, -W, L, W);
  seg(0, -W, 0, W);
  arc(0, 0, 9.15);
  spot(0, 0);

  for (const s of [-1, 1]) {
    const gx = s * L;
    // penalty area (16.5 deep, 40.32 wide)
    const px = gx - s * 16.5;
    seg(gx, -20.16, px, -20.16);
    seg(gx, 20.16, px, 20.16);
    seg(px, -20.16, px, 20.16);
    // goal area (5.5 deep, 18.32 wide)
    const ax = gx - s * 5.5;
    seg(gx, -9.16, ax, -9.16);
    seg(gx, 9.16, ax, 9.16);
    seg(ax, -9.16, ax, 9.16);
    // penalty spot + arc outside the box
    const sx = gx - s * 11;
    spot(sx, 0, 0.26);
    const half = Math.acos((16.5 - 11) / 9.15);
    // RingGeometry angles run counter-clockwise from +x in the XY plane; after rotateX(-90°) +y maps to -z.
    const centre = s > 0 ? Math.PI : 0;
    arc(sx, 0, 9.15, centre - half, half * 2);
    // corner arcs: quarter circles facing into the pitch. Angle θ in the ring's XY plane maps to
    // the XZ direction (cos θ, −sin θ) after rotateX(−90°).
    for (const z of [-1, 1]) {
      const start = s > 0 ? (z > 0 ? Math.PI / 2 : Math.PI) : z > 0 ? 0 : -Math.PI / 2;
      arc(gx, z * W, 1, start, Math.PI / 2);
    }
  }

  const merged = mergeGeometries(parts.map((g) => g.toNonIndexed()), false)!;
  parts.forEach((g) => g.dispose());
  merged.scale(scale, 1, scale);
  return merged;
}

/** Goal frames (posts + crossbar), merged. */
export function goalsGeometry(scale: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const post = 0.16, h = 2.44, w = 7.32, depth = 1.8;
  for (const s of [-1, 1]) {
    const x = s * PITCH_M.length / 2;
    for (const z of [-w / 2, w / 2]) {
      const g = new THREE.BoxGeometry(post, h, post);
      g.translate(x, h / 2, z);
      parts.push(g);
      const back = new THREE.BoxGeometry(depth, post * 0.6, post * 0.6);
      back.translate(x + s * depth / 2, h * 0.08, z);
      parts.push(back);
    }
    const bar = new THREE.BoxGeometry(post, post, w + post);
    bar.translate(x, h, 0);
    parts.push(bar);
  }
  const merged = mergeGeometries(parts.map((g) => g.toNonIndexed()), false)!;
  parts.forEach((g) => g.dispose());
  merged.scale(scale, scale, scale);
  return merged;
}

/** Mowed stripes, floodlight pools and a fade to ink, all in one cheap shader (no lights needed). */
export function groundMaterial(opts: { halfX: number; halfZ: number; lights: [number, number][]; ink: string; grassA: string; grassB: string }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uHalf: { value: new THREE.Vector2(opts.halfX, opts.halfZ) },
      uLights: { value: opts.lights.map(([x, z]) => new THREE.Vector2(x, z)) },
      uInk: { value: new THREE.Color(opts.ink) },
      uGrassA: { value: new THREE.Color(opts.grassA) },
      uGrassB: { value: new THREE.Color(opts.grassB) },
      uBoost: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec2 uHalf;
      uniform vec2 uLights[4];
      uniform vec3 uInk;
      uniform vec3 uGrassA;
      uniform vec3 uGrassB;
      uniform float uBoost;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 p = vWorld.xz;
        float stripe = step(0.5, fract((p.x + uHalf.x) / (uHalf.x * 2.0) * 6.0));
        vec3 grass = mix(uGrassA, uGrassB, stripe);
        float light = 0.0;
        for (int i = 0; i < 4; i++) {
          vec2 d = p - uLights[i] * 0.72;
          light += exp(-dot(d, d) / (uHalf.x * uHalf.x * 0.55));
        }
        float centre = exp(-dot(p, p) / (uHalf.x * uHalf.x * 0.25));
        float lit = 0.32 + 0.55 * light + 0.25 * centre + uBoost * centre * 0.35;
        vec3 col = grass * lit;
        col += (hash(floor(p * 40.0)) - 0.5) * 0.012;
        vec2 q = p / (uHalf * vec2(1.35, 1.55));
        float r = length(q);
        col = mix(col, uInk, smoothstep(0.78, 1.25, r));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Soft radial sprite texture for glows (generated, no image asset). */
export function glowTexture(size = 128): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.18, "rgba(255,255,255,0.55)");
  grd.addColorStop(0.5, "rgba(255,255,255,0.12)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Vertical gradient for floodlight cones: bright at the lamp, gone at the grass. */
export function coneMaterial(color: string) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.11 } },
    vertexShader: /* glsl */ `
      varying float vY;
      void main() { vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity; varying float vY;
      void main() {
        float a = pow(vY, 2.2) * uOpacity;
        gl_FragColor = vec4(uColor * a, a);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Deterministic PRNG so layouts are stable between renders. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
