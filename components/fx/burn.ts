// Burn-dissolve: a sheet of "paper" (any 2D canvas) burns away from an ignition point with a ragged,
// glowing flare-orange edge, revealing whatever sits underneath. Written from scratch for this project:
// raw WebGL 1, one full-screen triangle, value-noise fbm. No three.js, so it never pulls the 3D chunk.
// Each run creates its own context and releases it when the burn ends.

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// The burn front is a threshold sweeping through `field`: distance from the ignition point, roughened
// by fbm so the edge tears unevenly. Just ahead of the front the paper scorches; at the front a thin
// white-hot line sits on a wider flare glow; behind it a few sparks drift and fade.
const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uPaper;
uniform vec2 uSize;
uniform vec2 uOrigin;
uniform float uT;
uniform float uTime;
uniform float uSeed;

float hash(vec2 p) {
  p = fract(p * vec2(127.13, 311.71));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.55;
  mat2 turn = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    sum += amp * vnoise(p);
    p = turn * p * 2.07 + vec2(5.3, 1.7);
    amp *= 0.5;
  }
  return sum;
}

void main() {
  float aspect = uSize.x / max(uSize.y, 1.0);
  vec2 q = vec2(vUv.x * aspect, vUv.y);
  vec2 o = vec2(uOrigin.x * aspect, uOrigin.y);

  // Normalise by the farthest corner so the front always clears the sheet at uT = 1.
  float far = max(max(length(o), length(o - vec2(aspect, 0.0))), max(length(o - vec2(0.0, 1.0)), length(o - vec2(aspect, 1.0))));
  float d = length(q - o) / far;
  float rough = fbm(q * 3.2 + uSeed);
  float field = d * 0.74 + rough * 0.36;

  float front = mix(-0.04, 1.16, uT);
  float x = field - front; // < 0: burnt away, > 0: paper left

  vec4 paper = texture2D(uPaper, vec2(vUv.x, 1.0 - vUv.y));
  float intact = smoothstep(0.0, 0.01, x) * paper.a;

  // Scorch: paper darkens and browns as the front approaches.
  float scorch = 1.0 - smoothstep(0.0, 0.10, x);
  vec3 col = mix(paper.rgb, vec3(0.07, 0.035, 0.02), scorch * 0.9);

  float flicker = 0.8 + 0.2 * vnoise(q * 22.0 + vec2(uTime * 7.0, -uTime * 5.0));
  vec3 flare = vec3(0.941, 0.325, 0.110); // #f0531c
  vec3 hot = vec3(1.0, 0.82, 0.52);

  float glow = exp(-max(x, 0.0) * 26.0) * step(0.0, x);
  float line = exp(-abs(x) * 160.0);
  col += flare * glow * 1.25 * flicker;
  col = mix(col, hot, clamp(line * 1.1, 0.0, 1.0));

  // Sparks: sparse cells just behind the front, flickering out.
  vec2 cell = floor(q * 46.0 + uSeed);
  float spark = step(0.955, hash(cell)) * smoothstep(-0.09, -0.01, x) * (1.0 - smoothstep(-0.01, 0.0, x));
  spark *= 0.5 + 0.5 * sin(uTime * 30.0 + hash(cell + 3.0) * 6.283);

  float edgeA = clamp(line * 0.95 + spark * 0.9, 0.0, 1.0) * (1.0 - smoothstep(0.9, 1.0, uT));
  float a = max(intact, edgeA);
  vec3 outCol = mix(mix(flare, hot, 0.5), col, intact);
  gl_FragColor = vec4(outCol * a, a); // premultiplied
}`;

export interface BurnOptions {
  /** Canvas sized (CSS) exactly over the element being burnt away. */
  canvas: HTMLCanvasElement;
  /** What the paper looks like: a 2D canvas at the same CSS size (any resolution). */
  paper: HTMLCanvasElement;
  /** Ignition point in 0..1, measured from the top-left. */
  origin?: [number, number];
  durationMs?: number;
  /** Called once the first burnt frame is on screen, so the DOM original can be hidden underneath. */
  onFirstFrame?: () => void;
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl", { failIfMajorPerformanceCaveat: false });
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) throw new Error("burn: createShader failed");
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`burn: ${gl.getShaderInfoLog(s) ?? "compile failed"}`);
  return s;
}

/** Runs the burn and resolves when the sheet is gone. Rejects if WebGL can't start (callers reveal instantly). */
export function burn({ canvas, paper, origin = [0.5, 0.5], durationMs = 1500, onFirstFrame }: BurnOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));

    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return reject(new Error("burn: no WebGL"));

    let prog: WebGLProgram | null = null;
    try {
      prog = gl.createProgram();
      if (!prog) throw new Error("burn: createProgram failed");
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("burn: link failed");
    } catch (e) {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return reject(e);
    }
    gl.useProgram(prog);

    // One triangle that covers the viewport.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, paper);

    const u = (n: string) => gl.getUniformLocation(prog, n);
    gl.uniform1i(u("uPaper"), 0);
    gl.uniform2f(u("uSize"), rect.width, rect.height);
    gl.uniform2f(u("uOrigin"), origin[0], 1 - origin[1]);
    gl.uniform1f(u("uSeed"), Math.random() * 40);
    const uT = u("uT");
    const uTime = u("uTime");

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);

    const start = performance.now();
    let first = true;
    const frame = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      // Catches quickly, spreads, and slows as the last corners go.
      const t = 1 - Math.pow(1 - p, 1.7);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uT, t);
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (first) {
        first = false;
        onFirstFrame?.();
      }
      if (p < 1) requestAnimationFrame(frame);
      else {
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        resolve();
      }
    };
    requestAnimationFrame(frame);
  });
}
