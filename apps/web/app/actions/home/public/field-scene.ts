// The landing page's 3D field (decision 057, "bits in motion"; it began as
// the Main artboard's neural field, docs/design/spec/pages/Main.md
// §NeuralField). Thousands of bits, square cells that read 0 (outline) or 1
// (fill), morph through four formations as the page scrolls:
//
//   01 Bits    stacked bit-planes, cells flipping in slow waves
//   02 Tokens  tapes of bytes streaming through, sliced into words
//   03 Agents  a graph that closes into a loop, signals running its edges
//   04 You     a galaxy of bits
//
// One ShaderMaterial carries all four positions per point and blends them
// by `uMorph` (0 → 3). Colours are the CSS accent tokens, read at run time.
//
// `three` is passed in by the island after a dynamic import, so this module
// only needs its types and never pulls three into the initial page load.
import type * as THREE_NS from '../../public/three.ts'
import {
  bell,
  bitGlsl,
  ease,
  hashGlsl,
  onThemeChange,
  readTokenColors,
  sceneTokens,
  type SceneTokens,
  seeded,
  smooth,
  type Rgb,
} from '../../public/bits-gl.ts'

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
  /** Point count: the island picks it from the viewport (1,600 → 4,800). */
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

const MORPH_EASE = 0.055
const PARALLAX_EASE = 0.04

/** Cell pitch of the bit-planes, in scene units (≈ 30px at 1440×900); the tapes use ¾ of it. */
const PITCH = 0.5
/** Pixel size of a unit cell at the camera's resting distance. */
const CELL_PX = 190

const pointsVertex = /* glsl */ `
uniform float uMorph; uniform float uTime; uniform float uPx; uniform float uCell; uniform float uStream; uniform float uClear;
attribute vec3 aB; attribute vec3 aC; attribute vec3 aD; attribute float aR; attribute vec4 aSz; attribute vec4 aW;
varying float vR; varying float vOn; varying float vW; varying float vSmall;
${hashGlsl}
void main(){
  vec3 from = position; vec3 to = aB; float f = uMorph;
  vec2 sz = aSz.xy; vec2 w = aW.xy;
  if (uMorph >= 2.0) { from = aC; to = aD; f = uMorph - 2.0; sz = aSz.zw; w = aW.zw; }
  else if (uMorph >= 1.0) { from = aB; to = aC; f = uMorph - 1.0; sz = aSz.yz; w = aW.yz; }
  f = clamp((f - aR * 0.35) / 0.65, 0.0, 1.0);
  f = f * f * (3.0 - 2.0 * f);
  vec3 p = mix(from, to, f);
  float mid = sin(f * 3.14159);
  p += vec3(sin(uTime * 0.6 + aR * 43.0), cos(uTime * 0.5 + aR * 31.0), sin(uTime * 0.7 + aR * 17.0)) * (0.02 + mid * 1.1);

  // The bit: each cell runs its own slow clock (a flip every few seconds,
  // a third of the time on). In the tapes the pattern streams instead: a
  // byte's bits are a hash of the column passing, so the data flows while
  // the cells stand.
  float clock = fract(uTime * (0.05 + aR * 0.09) + aR * 7.0);
  float own = step(clock, 0.34);
  float column = floor(p.x / ${PITCH.toFixed(2)} - uTime * 2.2);
  float row = floor(p.y / ${(PITCH * 0.75).toFixed(3)} + aR * 0.5);
  float streamed = step(0.42, hash2(vec2(column, row)));
  vOn = mix(own, streamed, uStream);
  vW = mix(w.x, w.y, f);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  // The planes clear the middle of the screen, where the hero copy sits,
  // and frame it instead (uClear is 1 at stage 01, 0 elsewhere).
  vec2 ndc = gl_Position.xy / max(gl_Position.w, 0.001);
  float clearing = smoothstep(0.22, 1.0, length(ndc * vec2(1.0, 1.1)));
  vW *= mix(1.0, clearing, uClear);
  float size = mix(sz.x, sz.y, f) * uPx * (uCell / -mv.z) * (0.82 + 0.18 * vOn) * (1.0 - mid * 0.35);
  gl_PointSize = size;
  vSmall = 1.0 - smoothstep(6.0 * uPx, 9.0 * uPx, size);
  vR = aR;
}`

const pointsFragment = /* glsl */ `
uniform vec3 uC1; uniform vec3 uC2; uniform float uAlpha;
varying float vR; varying float vOn; varying float vW; varying float vSmall;
${bitGlsl}
void main(){
  float a = bitAlpha(vOn, vSmall);
  if (a < 0.004) discard;
  vec3 col = mix(uC1, uC2, smoothstep(0.15, 0.85, vR));
  gl_FragColor = vec4(col, a * uAlpha * vW * (0.6 + vR * 0.4));
}`

const signalVertex = /* glsl */ `
uniform float uTime; uniform float uPx; uniform float uCell; attribute vec3 aEnd; attribute float aOff; varying float vA;
void main(){
  float t = fract(uTime * 0.28 + aOff);
  vec3 p = mix(position, aEnd, t);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * (uCell * 0.55 / -mv.z);
  vA = sin(t * 3.14159);
}`

const signalFragment = /* glsl */ `
uniform vec3 uColor; uniform float uAlpha; varying float vA;
${bitGlsl}
void main(){
  float a = bitAlpha(1.0, 0.0);
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor, a * vA * uAlpha);
}`

interface Formations {
  A: Float32Array
  B: Float32Array
  C: Float32Array
  D: Float32Array
  R: Float32Array
  /** Cell size per formation (xyzw = A B C D), relative to a unit cell. */
  size: Float32Array
  /** Visibility per formation: 0 hides a point there, fractions dim it. */
  weight: Float32Array
  /** Bit-plane outlines (stage 01). */
  planeLines: Float32Array
  /** Graph edges (stage 03). */
  graphLines: Float32Array
  signalStart: Float32Array
  signalEnd: Float32Array
  signalOffset: Float32Array
}

/** Lays out the four formations for N points with the artboard's seeded PRNG (seed 11). */
function buildFormations(N: number): Formations {
  let { rnd, gauss } = seeded(11)

  let A = new Float32Array(N * 3)
  let B = new Float32Array(N * 3)
  let C = new Float32Array(N * 3)
  let D = new Float32Array(N * 3)
  let R = new Float32Array(N)
  let size = new Float32Array(N * 4)
  let weight = new Float32Array(N * 4)
  let put = (arr: Float32Array, i: number, x: number, y: number, z: number) => {
    arr[i * 3] = x
    arr[i * 3 + 1] = y
    arr[i * 3 + 2] = z
  }
  for (let i = 0; i < N; i++) R[i] = rnd()

  // 01 Bits: four bit-planes, each a grid of cells, stacked in depth and
  // staggered half a cell so the stack reads when the group tilts.
  let planes = 4
  let perPlane = Math.ceil(N / planes)
  let cols = Math.ceil(Math.sqrt(perPlane * 1.9))
  let rows = Math.ceil(perPlane / cols)
  let planeGap = 2.3
  for (let i = 0; i < N; i++) {
    let plane = Math.floor(i / perPlane)
    let k = i - plane * perPlane
    let col = k % cols
    let row = Math.floor(k / cols)
    let x = (col - (cols - 1) / 2) * PITCH + (plane % 2) * PITCH * 0.5
    let y = (row - (rows - 1) / 2) * PITCH + (plane % 3) * PITCH * 0.33
    let z = (plane - (planes - 1) / 2) * planeGap
    put(A, i, x, y, z)
    size[i * 4] = 1
    weight[i * 4] = 1
  }
  let planeLines = new Float32Array(planes * 4 * 6)
  for (let plane = 0; plane < planes; plane++) {
    let hw = (cols * PITCH) / 2 + PITCH * 0.25
    let hh = (rows * PITCH) / 2 + PITCH * 0.4
    let ox = (plane % 2) * PITCH * 0.5
    let oy = (plane % 3) * PITCH * 0.33
    let z = (plane - (planes - 1) / 2) * planeGap
    let corners = [
      [-hw + ox, -hh + oy],
      [hw + ox, -hh + oy],
      [hw + ox, hh + oy],
      [-hw + ox, hh + oy],
    ]
    for (let s = 0; s < 4; s++) {
      let a = corners[s]!
      let b = corners[(s + 1) % 4]!
      planeLines.set([a[0]!, a[1]!, z, b[0]!, b[1]!, z], (plane * 4 + s) * 6)
    }
  }

  // 02 Tokens: four tapes of bytes (a column is one byte, eight cells
  // tall; four columns make a word, then a gap) winding through the view
  // and off both sides. What doesn't fit a tape is dust around them.
  let tapes = 4
  let tapeRows = 8
  let tapeShare = Math.floor((N * 0.86) / (tapes * tapeRows))
  let tapePitch = PITCH * 0.75
  let columns = tapeShare
  let tapeLen = columns * tapePitch + Math.floor(columns / 4) * tapePitch
  for (let i = 0; i < N; i++) {
    let tape = Math.floor(i / (tapeShare * tapeRows))
    if (tape < tapes) {
      let k = i - tape * tapeShare * tapeRows
      let col = Math.floor(k / tapeRows)
      let row = k % tapeRows
      let phase = tape * 1.9
      let x = col * tapePitch + Math.floor(col / 4) * tapePitch - tapeLen / 2
      let y0 = (tape - (tapes - 1) / 2) * 3.4
      let y = y0 + (row - (tapeRows - 1) / 2) * tapePitch + Math.sin(x * 0.22 + phase) * 1.4
      let z = Math.cos(x * 0.16 + phase) * 2.4
      put(B, i, x, y, z)
      size[i * 4 + 1] = 0.78
      weight[i * 4 + 1] = 1
    } else {
      put(B, i, (rnd() - 0.5) * 30, (rnd() - 0.5) * 15, (rnd() - 0.5) * 7)
      size[i * 4 + 1] = 0.5
      weight[i * 4 + 1] = 0.22
    }
  }

  // 03 Agents: a graph. Shell nodes on a squashed sphere, joined in a loop
  // around it (the agent's cycle) and to their two nearest neighbours; a
  // few spokes reach a small core. Half the points sit on the nodes, half
  // along the edges, and signals run the edges.
  let shellCount = 34
  let nodes: { x: number; y: number; z: number; az: number }[] = []
  let golden = Math.PI * (3 - Math.sqrt(5))
  for (let k = 0; k < shellCount; k++) {
    let y = 1 - (k / (shellCount - 1)) * 2
    let r = Math.sqrt(1 - y * y)
    let th = golden * k
    let x = Math.cos(th) * r * 6.2 + gauss() * 0.25
    let z = Math.sin(th) * r * 6.2 + gauss() * 0.25
    nodes.push({ x, y: y * 4.4 + gauss() * 0.25, z, az: Math.atan2(z, x) })
  }
  nodes.sort((a, b) => a.az - b.az)
  let coreStart = nodes.length
  for (let k = 0; k < 5; k++) {
    let a = (k / 5) * Math.PI * 2
    nodes.push({ x: Math.cos(a) * 1.1, y: (rnd() - 0.5) * 0.8, z: Math.sin(a) * 1.1, az: a })
  }
  let edgeSet = new Set<string>()
  let edges: [number, number][] = []
  let link = (i: number, j: number) => {
    if (i === j) return
    let key = i < j ? `${i}:${j}` : `${j}:${i}`
    if (edgeSet.has(key)) return
    edgeSet.add(key)
    edges.push([i, j])
  }
  let dist = (a: (typeof nodes)[number], b: (typeof nodes)[number]) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
  for (let i = 0; i < coreStart; i++) {
    link(i, (i + 1) % coreStart)
    let near = nodes
      .slice(0, coreStart)
      .map((n, j) => [dist(nodes[i]!, n), j] as const)
      .filter(([, j]) => j !== i)
      .sort((a, b) => a[0] - b[0])
      .slice(0, 2)
    for (let [, j] of near) link(i, j)
    if (i % 4 === 0) link(i, coreStart + (i % 5))
  }
  for (let k = 0; k < 5; k++) link(coreStart + k, coreStart + ((k + 1) % 5))
  let degree = new Array<number>(nodes.length).fill(0)
  for (let [i, j] of edges) {
    degree[i]!++
    degree[j]!++
  }
  // A node is a chip: its points in a small square grid of cells, facing
  // the viewer, the busier the node the bigger the chip.
  let nodePoints = Math.floor(N * 0.42)
  let perNode = Math.floor(nodePoints / nodes.length)
  let chipPitch = 0.2
  for (let i = 0; i < N; i++) {
    if (i < perNode * nodes.length) {
      let ni = Math.floor(i / perNode)
      let n = nodes[ni]!
      let side = Math.max(2, Math.round(Math.sqrt(perNode) * (0.7 + Math.min(4, degree[ni]!) * 0.1)))
      let k = i - ni * perNode
      let col = k % side
      let row = Math.floor(k / side)
      let w = Math.ceil(perNode / side)
      put(C, i, n.x + (col - (side - 1) / 2) * chipPitch, n.y + (row - (w - 1) / 2) * chipPitch, n.z)
      size[i * 4 + 2] = row < w ? 0.5 : 0
      weight[i * 4 + 2] = 1
    } else {
      let e = edges[Math.floor(rnd() * edges.length)]!
      let a = nodes[e[0]]!
      let b = nodes[e[1]]!
      let t = rnd()
      put(C, i, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)
      size[i * 4 + 2] = 0.42
      weight[i * 4 + 2] = 0.85
    }
  }
  let graphLines = new Float32Array(edges.length * 6)
  edges.forEach(([i, j], k) => {
    let a = nodes[i]!
    let b = nodes[j]!
    graphLines.set([a.x, a.y, a.z, b.x, b.y, b.z], k * 6)
  })
  let M = 180
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

  // 04 You: a three-armed galaxy of bits, tilted toward the viewer.
  let ct = Math.cos(-1.0)
  let st = Math.sin(-1.0)
  for (let i = 0; i < N; i++) {
    let arm = i % 3
    let r = Math.pow(rnd(), 0.62) * 9.2
    let ang = arm * ((2 * Math.PI) / 3) + r * 0.55 + gauss() * 0.2
    let x = Math.cos(ang) * r
    let z0 = Math.sin(ang) * r
    let y0 = gauss() * 0.16 * (1.3 - r / 10)
    put(D, i, x, y0 * ct - z0 * st, y0 * st + z0 * ct)
    size[i * 4 + 3] = 0.38 + rnd() * 0.5
    weight[i * 4 + 3] = 1
  }

  return { A, B, C, D, R, size, weight, planeLines, graphLines, signalStart, signalEnd, signalOffset }
}

/**
 * Builds the scene on `canvas`. Throws if WebGL cannot be created; the
 * caller treats that as "no field" and leaves the static graph paper.
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

  // The accents, as the page has them right now (lane-independent: a token
  // change recolours the field with no code change). Shader uniforms take
  // the sRGB floats as they are: a ShaderMaterial writes them unconverted,
  // so the cells match the CSS exactly.
  let tokens = readTokenColors(canvas, sceneTokens)
  let raw = (c: Rgb) => new T.Color().setRGB(c[0], c[1], c[2], T.LinearSRGBColorSpace)
  let managed = (c: Rgb) => new T.Color().setRGB(c[0], c[1], c[2], T.SRGBColorSpace)
  let buildPalette = (t: SceneTokens) =>
    [
      [t['--volt'], t['--ion']],
      [t['--ion'], t['--synapse']],
      [t['--synapse'], t['--volt']],
      [t['--volt-soft'], t['--synapse']],
    ].map(([a, b]) => [raw(a!), raw(b!)] as const)
  let palette = buildPalette(tokens)

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
  geo.setAttribute('aSz', new T.BufferAttribute(f.size, 4))
  geo.setAttribute('aW', new T.BufferAttribute(f.weight, 4))
  let mat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uMorph: { value: 0 },
      uTime: { value: 0 },
      uPx: { value: px },
      uCell: { value: CELL_PX },
      uStream: { value: 0 },
      uClear: { value: 1 },
      uC1: { value: palette[0]![0].clone() },
      uC2: { value: palette[0]![1].clone() },
      uAlpha: { value: 0.92 },
    },
    vertexShader: pointsVertex,
    fragmentShader: pointsFragment,
  })
  let points = new T.Points(geo, mat)
  points.frustumCulled = false
  group.add(points)

  let lineMaterial = (c: Rgb) =>
    new T.LineBasicMaterial({ color: managed(c), transparent: true, opacity: 0, depthWrite: false })
  let planeGeo = new T.BufferGeometry()
  planeGeo.setAttribute('position', new T.BufferAttribute(f.planeLines, 3))
  let planeMat = lineMaterial(tokens['--ion'])
  let planeLines = new T.LineSegments(planeGeo, planeMat)
  group.add(planeLines)

  let graphGeo = new T.BufferGeometry()
  graphGeo.setAttribute('position', new T.BufferAttribute(f.graphLines, 3))
  let graphMat = lineMaterial(tokens['--synapse'])
  let graphLines = new T.LineSegments(graphGeo, graphMat)
  group.add(graphLines)

  let signalGeo = new T.BufferGeometry()
  signalGeo.setAttribute('position', new T.BufferAttribute(f.signalStart, 3))
  signalGeo.setAttribute('aEnd', new T.BufferAttribute(f.signalEnd, 3))
  signalGeo.setAttribute('aOff', new T.BufferAttribute(f.signalOffset, 1))
  let signalMat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uPx: { value: px },
      uCell: { value: CELL_PX },
      uAlpha: { value: 0 },
      uColor: { value: raw(tokens['--volt-soft']) },
    },
    vertexShader: signalVertex,
    fragmentShader: signalFragment,
  })
  let signals = new T.Points(signalGeo, signalMat)
  signals.frustumCulled = false
  group.add(signals)

  let c1 = new T.Color()
  let c2 = new T.Color()

  // The theme flipped (decision 062): read the accents again and redraw.
  let stopThemeWatch = onThemeChange(() => {
    tokens = readTokenColors(canvas, sceneTokens)
    palette = buildPalette(tokens)
    planeMat.color = managed(tokens['--ion'])
    graphMat.color = managed(tokens['--synapse'])
    signalMat.uniforms.uColor!.value = raw(tokens['--volt-soft'])
    if (!raf) draw()
  })

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
    mat.uniforms.uStream!.value = bell(morph, 1, 0.8)
    // The planes sit behind the hero copy, so they are the quietest stage
    // and keep clear of the middle of the screen.
    let planeAlpha = bell(morph, 0, 0.7)
    let phone = width < 760
    mat.uniforms.uAlpha!.value = 0.95 - (phone ? 0.45 : 0.3) * bell(morph, 0, 1)
    mat.uniforms.uClear!.value = planeAlpha
    // On a phone the hero copy fills the middle of the screen, so the deck
    // sits low, under the prompt bar, instead of behind the paragraph.
    group.position.y = phone ? -3.2 * planeAlpha : 0
    signalMat.uniforms.uTime!.value = time

    // Each stage's lines show only around it: the plane outlines at 01,
    // the graph's edges and signals at 03.
    planeMat.opacity = 0.28 * planeAlpha
    planeLines.visible = planeAlpha > 0.01
    let graphAlpha = bell(morph, 2, 0.7)
    graphMat.opacity = 0.3 * graphAlpha
    graphLines.visible = graphAlpha > 0.01
    signalMat.uniforms.uAlpha!.value = graphAlpha
    signals.visible = graphAlpha > 0.01

    // Cursor parallax plus a slow drift; the graph turns and the galaxy
    // spins once it forms. Reduced motion keeps the spec's ¼-speed drift
    // but drops cursor parallax: motion that follows the pointer is the
    // vestibular trigger the setting exists for (decision 031).
    let k = reducedMotion || still ? 0 : ease(PARALLAX_EASE, dt)
    mouse.x += (input.pointer.x - mouse.x) * k
    mouse.y += (input.pointer.y - mouse.y) * k
    let spin = morph > 2 ? (morph - 2) * time * 0.04 : 0
    // The stack of planes tilts away like a deck seen from above, so each
    // plane shows; the graph turns slowly; the galaxy spins once it forms.
    group.rotation.y = Math.sin(time * 0.09) * 0.42 + mouse.x * 0.3 + spin + graphAlpha * time * 0.03
    group.rotation.x = mouse.y * 0.16 + Math.sin(time * 0.07) * 0.07 + planeAlpha * 0.62
    camera.position.z = (width < 760 ? 25 : 16) + Math.sin(Math.min(3, morph) * Math.PI) * 1.4 + planeAlpha * 2.5

    renderer.render(scene, camera)

    let next = Math.max(0, Math.min(3, Math.round(morph)))
    if (next !== stage) {
      stage = next
      onStage(stage)
    }
  }

  function draw() {
    if (raf || stillRaf) return
    stillRaf = requestAnimationFrame(() => {
      stillRaf = 0
      step(0, true)
    })
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
    draw,
    resize(w, h) {
      if (!w || !h) return
      width = w
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    },
    dispose() {
      stopThemeWatch()
      cancelAnimationFrame(raf)
      cancelAnimationFrame(stillRaf)
      raf = 0
      stillRaf = 0
      for (let d of [geo, mat, planeGeo, planeMat, graphGeo, graphMat, signalGeo, signalMat]) d.dispose()
      renderer.dispose()
    },
  }
}
