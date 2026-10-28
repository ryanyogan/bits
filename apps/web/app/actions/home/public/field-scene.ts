// The landing page's 3D neural field, ported from the Main artboard
// (docs/design/artboards/Main.dc.html lines 415–685; port guide in
// docs/design/spec/pages/Main.md §NeuralField). ~3,400 points in one
// ShaderMaterial morph through four formations (network → token ribbon →
// agent loop → galaxy) as `uMorph` goes 0 → 3.
//
// `three` is passed in by the island after a dynamic import, so this module
// only needs its types and never pulls three into the initial page load.
import type * as THREE_NS from '../../public/three.ts'

type Three = typeof THREE_NS

export interface FieldInput {
  /** Scroll progress through the page, 0–1, or null when the page cannot scroll. */
  progress(): number | null
  /** Pointer position normalised to −1..1, the target the parallax eases towards. */
  pointer: { x: number; y: number }
}

export interface FieldOptions {
  canvas: HTMLCanvasElement
  input: FieldInput
  /** Called only when the rounded formation index changes (0–3). */
  onStage(stage: number): void
  /** Point count: 3,400 at ≥760px, ~1,500 below. */
  count: number
  reducedMotion: boolean
}

export interface Field {
  /** Runs the render loop (autonomous motion). */
  start(): void
  /** Cancels the render loop; the last frame stays on the canvas. */
  stop(): void
  /**
   * Draws one still frame on the next animation frame, unless the loop is
   * running: time frozen, the formation set straight to the scroll target,
   * no easing left to play out. Paused, this keeps the field in step with
   * the viewer's own scrolling and redraws it after a resize clears it.
   */
  draw(): void
  resize(width: number, height: number): void
  dispose(): void
}

const PALETTE = [
  ['#C6FF3D', '#3DE3FF'],
  ['#3DE3FF', '#9D85FF'],
  ['#9D85FF', '#C6FF3D'],
  ['#E4FF9E', '#9D85FF'],
] as const

const MORPH_EASE = 0.055
const PARALLAX_EASE = 0.04

const pointsVertex = /* glsl */ `
uniform float uMorph; uniform float uTime; uniform float uPx;
attribute vec3 aB; attribute vec3 aC; attribute vec3 aD; attribute float aR; attribute float aS;
varying float vR;
void main(){
  vec3 from = position; vec3 to = aB; float f = uMorph;
  if (uMorph >= 2.0) { from = aC; to = aD; f = uMorph - 2.0; }
  else if (uMorph >= 1.0) { from = aB; to = aC; f = uMorph - 1.0; }
  f = clamp((f - aR * 0.35) / 0.65, 0.0, 1.0);
  f = f * f * (3.0 - 2.0 * f);
  vec3 p = mix(from, to, f);
  float mid = sin(f * 3.14159);
  p += vec3(sin(uTime * 0.6 + aR * 43.0), cos(uTime * 0.5 + aR * 31.0), sin(uTime * 0.7 + aR * 17.0)) * (0.03 + mid * 1.1);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.7 + 0.3 * sin(uTime * 2.2 + aR * 60.0);
  gl_PointSize = aS * tw * uPx * (36.0 / -mv.z);
  vR = aR;
}`

const pointsFragment = /* glsl */ `
uniform vec3 uC1; uniform vec3 uC2; uniform float uAlpha;
varying float vR;
void main(){
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d); a *= a;
  vec3 col = mix(uC1, uC2, smoothstep(0.15, 0.85, vR));
  col = mix(col, vec3(1.0), smoothstep(0.16, 0.0, d) * 0.55);
  gl_FragColor = vec4(col, a * uAlpha * (0.5 + vR * 0.5));
}`

const signalVertex = /* glsl */ `
uniform float uTime; uniform float uPx; attribute vec3 aEnd; attribute float aOff; varying float vA;
void main(){
  float t = fract(uTime * 0.3 + aOff);
  vec3 p = mix(position, aEnd, t);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * (64.0 / -mv.z);
  vA = sin(t * 3.14159);
}`

const signalFragment = /* glsl */ `
uniform float uAlpha; varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d); a *= a;
  gl_FragColor = vec4(mix(vec3(0.78, 1.0, 0.24), vec3(1.0), 0.5), a * vA * uAlpha);
}`

function smooth(a: number, b: number, x: number) {
  let t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Frame-rate independent version of `value += (target − value) * k` at 60fps. */
function ease(k: number, dt: number) {
  return 1 - Math.pow(1 - k, dt * 60)
}

interface Formations {
  A: Float32Array
  B: Float32Array
  C: Float32Array
  D: Float32Array
  R: Float32Array
  S: Float32Array
  edges: Float32Array
  signalStart: Float32Array
  signalEnd: Float32Array
  signalOffset: Float32Array
}

/** Generates the four formations with the artboard's seeded PRNG (Park–Miller, seed 11). */
function buildFormations(N: number): Formations {
  let seed = 11
  let rnd = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  let gauss = () => {
    let u = 0
    let v = 0
    while (!u) u = rnd()
    while (!v) v = rnd()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  let A = new Float32Array(N * 3)
  let B = new Float32Array(N * 3)
  let C = new Float32Array(N * 3)
  let D = new Float32Array(N * 3)
  let R = new Float32Array(N)
  let S = new Float32Array(N)

  // Formation A: a layered neural network.
  let layers = [5, 9, 13, 13, 9, 5]
  let nodes: { x: number; y: number; z: number; li: number }[] = []
  layers.forEach((count, li) => {
    let x = (li - (layers.length - 1) / 2) * 2.7
    for (let k = 0; k < count; k++) nodes.push({ x, y: (k - (count - 1) / 2) * 0.92, z: (rnd() - 0.5) * 1.4, li })
  })
  let edges: [number, number][] = []
  for (let i = 0; i < nodes.length; i++) {
    for (let j = 0; j < nodes.length; j++) {
      if (nodes[j]!.li === nodes[i]!.li + 1 && rnd() < 0.5) edges.push([i, j])
    }
  }
  for (let i = 0; i < N; i++) {
    R[i] = rnd()
    let x: number, y: number, z: number
    if (i < N * 0.58) {
      let n = nodes[i % nodes.length]!
      x = n.x + gauss() * 0.08
      y = n.y + gauss() * 0.08
      z = n.z + gauss() * 0.08
      S[i] = 1.1 + rnd() * 0.9
    } else {
      let e = edges[Math.floor(rnd() * edges.length)]!
      let a = nodes[e[0]]!
      let b = nodes[e[1]]!
      let t = rnd()
      x = a.x + (b.x - a.x) * t
      y = a.y + (b.y - a.y) * t
      z = a.z + (b.z - a.z) * t
      S[i] = 0.45 + rnd() * 0.35
    }
    A[i * 3] = x
    A[i * 3 + 1] = y
    A[i * 3 + 2] = z
  }

  // Formation B: a ribbon of token blocks.
  let blocks = 26
  for (let i = 0; i < N; i++) {
    let cx = ((i % blocks) - (blocks - 1) / 2) * 1.0
    let w = 0.78
    let h = 0.52
    let lx: number, ly: number
    if (rnd() < 0.72) {
      let t = rnd() * 2 * (w + h)
      if (t < w) {
        lx = t - w / 2
        ly = -h / 2
      } else if (t < w + h) {
        lx = w / 2
        ly = t - w - h / 2
      } else if (t < 2 * w + h) {
        lx = t - w - h - w / 2
        ly = h / 2
      } else {
        lx = -w / 2
        ly = t - 2 * w - h - h / 2
      }
    } else {
      lx = (rnd() - 0.5) * w * 0.7
      ly = (rnd() - 0.5) * h * 0.5
    }
    B[i * 3] = cx + lx
    B[i * 3 + 1] = ly + Math.sin(cx * 0.42) * 1.7
    B[i * 3 + 2] = Math.cos(cx * 0.3) * 2.4 + (rnd() - 0.5) * 0.12
  }

  // Formation C: an agent loop (a (2,3) torus knot) around a core.
  for (let i = 0; i < N; i++) {
    let x: number, y: number, z: number
    if (i < N * 0.74) {
      let t = rnd() * Math.PI * 2
      let r = Math.cos(3 * t) + 2.4
      x = r * Math.cos(2 * t) * 1.5 + gauss() * 0.1
      y = r * Math.sin(2 * t) * 1.5 + gauss() * 0.1
      z = -Math.sin(3 * t) * 1.5 + gauss() * 0.1
    } else {
      let u = rnd() * 2 - 1
      let th = rnd() * Math.PI * 2
      let s = Math.sqrt(1 - u * u)
      let rr = 1.05 + gauss() * 0.04
      x = s * Math.cos(th) * rr
      y = s * Math.sin(th) * rr
      z = u * rr
    }
    C[i * 3] = x
    C[i * 3 + 1] = y
    C[i * 3 + 2] = z
  }

  // Formation D: a three-armed galaxy, tilted toward the viewer.
  let ct = Math.cos(-1.0)
  let st = Math.sin(-1.0)
  for (let i = 0; i < N; i++) {
    let arm = i % 3
    let r = Math.pow(rnd(), 0.62) * 8.2
    let ang = arm * ((2 * Math.PI) / 3) + r * 0.55 + gauss() * 0.2
    let x = Math.cos(ang) * r
    let z0 = Math.sin(ang) * r
    let y0 = gauss() * 0.16 * (1.3 - r / 9)
    D[i * 3] = x
    D[i * 3 + 1] = y0 * ct - z0 * st
    D[i * 3 + 2] = y0 * st + z0 * ct
  }

  // Network edges, then 170 signals travelling along random edges.
  let lines = new Float32Array(edges.length * 6)
  edges.forEach(([i, j], k) => {
    let a = nodes[i]!
    let b = nodes[j]!
    lines.set([a.x, a.y, a.z, b.x, b.y, b.z], k * 6)
  })
  let M = 170
  let signalStart = new Float32Array(M * 3)
  let signalEnd = new Float32Array(M * 3)
  let signalOffset = new Float32Array(M)
  for (let k = 0; k < M; k++) {
    let e = edges[Math.floor(rnd() * edges.length)]!
    let a = nodes[e[0]]!
    let b = nodes[e[1]]!
    signalStart.set([a.x, a.y, a.z], k * 3)
    signalEnd.set([b.x, b.y, b.z], k * 3)
    signalOffset[k] = rnd()
  }

  return { A, B, C, D, R, S, edges: lines, signalStart, signalEnd, signalOffset }
}

/**
 * Builds the scene on `canvas`. Throws if WebGL cannot be created; the
 * caller treats that as "no field" and leaves the static dot grid.
 */
export function createField(T: Three, options: FieldOptions): Field {
  let { canvas, input, onStage, count, reducedMotion } = options

  let renderer = new T.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0)

  let scene = new T.Scene()
  let camera = new T.PerspectiveCamera(50, 1, 0.1, 200)
  camera.position.set(0, 0, 16)
  let group = new T.Group()
  scene.add(group)

  let f = buildFormations(count)
  let px = renderer.getPixelRatio()

  let geo = new T.BufferGeometry()
  geo.setAttribute('position', new T.BufferAttribute(f.A, 3))
  geo.setAttribute('aB', new T.BufferAttribute(f.B, 3))
  geo.setAttribute('aC', new T.BufferAttribute(f.C, 3))
  geo.setAttribute('aD', new T.BufferAttribute(f.D, 3))
  geo.setAttribute('aR', new T.BufferAttribute(f.R, 1))
  geo.setAttribute('aS', new T.BufferAttribute(f.S, 1))
  let mat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    uniforms: {
      uMorph: { value: 0 },
      uTime: { value: 0 },
      uPx: { value: px },
      uC1: { value: new T.Color(PALETTE[0][0]) },
      uC2: { value: new T.Color(PALETTE[0][1]) },
      uAlpha: { value: 1 },
    },
    vertexShader: pointsVertex,
    fragmentShader: pointsFragment,
  })
  let points = new T.Points(geo, mat)
  points.frustumCulled = false
  group.add(points)

  let lineGeo = new T.BufferGeometry()
  lineGeo.setAttribute('position', new T.BufferAttribute(f.edges, 3))
  let lineMat = new T.LineBasicMaterial({
    color: 0xc6ff3d,
    transparent: true,
    opacity: 0.14,
    blending: T.AdditiveBlending,
    depthWrite: false,
  })
  let lines = new T.LineSegments(lineGeo, lineMat)
  group.add(lines)

  let signalGeo = new T.BufferGeometry()
  signalGeo.setAttribute('position', new T.BufferAttribute(f.signalStart, 3))
  signalGeo.setAttribute('aEnd', new T.BufferAttribute(f.signalEnd, 3))
  signalGeo.setAttribute('aOff', new T.BufferAttribute(f.signalOffset, 1))
  let signalMat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: px }, uAlpha: { value: 1 } },
    vertexShader: signalVertex,
    fragmentShader: signalFragment,
  })
  let signals = new T.Points(signalGeo, signalMat)
  signals.frustumCulled = false
  group.add(signals)

  let palette = PALETTE.map(([a, b]) => [new T.Color(a), new T.Color(b)] as const)
  let c1 = new T.Color()
  let c2 = new T.Color()

  let width = 0
  let morph = 0
  let time = 0
  let stage = 0
  let mouse = { x: 0, y: 0 }
  let last = 0
  let raf = 0
  let stillRaf = 0
  let frames = 0

  function frame(now: number) {
    raf = requestAnimationFrame(frame)
    let dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
    last = now
    step(dt, false)
    // A coarse loop counter for the e2e test (decision 034): it moves while
    // the loop runs and stops when it is paused. Written every 30 frames.
    if (++frames % 30 === 0) canvas.dataset.frames = String(frames)
  }

  function step(dt: number, still: boolean) {
    time += dt * (reducedMotion ? 0.25 : 1)

    // Scroll → formation, with smoothstep holds at each one. Without a
    // scrollable page it cycles 0 → 3 → 0 on its own.
    let target: number
    let p = input.progress()
    if (p !== null) {
      let m = Math.min(3, p * 3.5)
      let base = Math.floor(m)
      target = Math.min(3, base + smooth(0.3, 0.85, m - base))
    } else {
      let cyc = (time * 0.11) % 6
      let tri = cyc < 3 ? cyc : 6 - cyc
      let base = Math.floor(tri)
      target = Math.min(3, base + smooth(0.45, 1.0, tri - base))
    }
    morph = still ? target : morph + (target - morph) * ease(MORPH_EASE, dt)

    // Palette shifts per stage.
    let si = Math.min(2, Math.floor(morph))
    let sf = morph - si
    c1.copy(palette[si]![0]).lerp(palette[si + 1]![0], sf)
    c2.copy(palette[si]![1]).lerp(palette[si + 1]![1], sf)
    mat.uniforms.uC1!.value.copy(c1)
    mat.uniforms.uC2!.value.copy(c2)
    mat.uniforms.uMorph!.value = morph
    mat.uniforms.uTime!.value = time
    signalMat.uniforms.uTime!.value = time

    // Edges and signals fade out during the first morph.
    let netAlpha = 1 - Math.min(1, morph * 1.6)
    lineMat.opacity = 0.15 * netAlpha
    signalMat.uniforms.uAlpha!.value = netAlpha
    lines.visible = netAlpha > 0.01
    signals.visible = netAlpha > 0.01

    // Cursor parallax plus a slow drift; the galaxy spins once it forms.
    // Reduced motion keeps the spec's ¼-speed drift but drops cursor
    // parallax: motion that follows the pointer is the vestibular trigger
    // the setting exists for (decision 031).
    let k = reducedMotion || still ? 0 : ease(PARALLAX_EASE, dt)
    mouse.x += (input.pointer.x - mouse.x) * k
    mouse.y += (input.pointer.y - mouse.y) * k
    group.rotation.y =
      Math.sin(time * 0.09) * 0.45 + mouse.x * 0.35 + (morph > 2 ? (morph - 2) * time * 0.04 : 0)
    group.rotation.x = mouse.y * 0.18 + Math.sin(time * 0.07) * 0.08
    camera.position.z = (width < 760 ? 25 : 16) + Math.sin(Math.min(3, morph) * Math.PI) * 1.4

    renderer.render(scene, camera)

    let next = Math.max(0, Math.min(3, Math.round(morph)))
    if (next !== stage) {
      stage = next
      onStage(stage)
    }
  }

  return {
    start() {
      if (raf) return
      cancelAnimationFrame(stillRaf)
      stillRaf = 0
      last = 0
      raf = requestAnimationFrame(frame)
    },
    stop() {
      cancelAnimationFrame(raf)
      raf = 0
    },
    draw() {
      if (raf || stillRaf) return
      stillRaf = requestAnimationFrame(() => {
        stillRaf = 0
        step(0, true)
      })
    },
    resize(w, h) {
      if (!w || !h) return
      width = w
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    },
    dispose() {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(stillRaf)
      raf = 0
      stillRaf = 0
      for (let d of [geo, mat, lineGeo, lineMat, signalGeo, signalMat]) d.dispose()
      renderer.dispose()
    },
  }
}
