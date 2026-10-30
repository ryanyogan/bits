import type { Handle } from 'remix/component'
import { clientEntry, css, ref } from 'remix/component'

import { afterLoadAndIdle, bitGlsl, canDrawScene, readTokenColors, sceneTokens } from '../../public/bits-gl.ts'

/**
 * BrainCanvas (Auth spec, left pane; decision 057): a sphere of bits being
 * written, "your neurons, saved". 2,600 cells on a Fibonacci sphere turn
 * from 0 to 1 in a sweep from the top, while a ring of bytes orbits once
 * and locks. The write is over in under five seconds and then the scene
 * rests still, so it needs no pause control (WCAG 2.2.2, as decision 041).
 *
 * Decorative and progressive: the server renders an empty canvas, and the
 * browser loads three.js only when the pane is visible at ≥760px, after the
 * page's load event and an idle moment, and fades the first frame in.
 * Reduced motion draws the written sphere once. Caps DPR at 2 and disposes
 * everything when removed. Client navigation between the auth pages keeps
 * this node (and its GL context) in place; `data-ready` is client-owned, so
 * reconciliation leaves it alone.
 */
export const BrainCanvas = clientEntry(import.meta.url, function BrainCanvas(_handle: Handle) {
  return () => (
    <canvas
      aria-hidden="true"
      data-rmx-preserve-attrs="data-ready"
      mix={[canvasStyle, ref((canvas, signal) => void start(canvas as HTMLCanvasElement, signal))]}
    />
  )
})

const canvasStyle = css({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  display: 'block',
  opacity: 0,
  transition: 'opacity var(--duration-pop) var(--ease-out)',
  '&[data-ready]': { opacity: 1 },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  '@media (max-width: 759px)': { display: 'none' },
  '@media (forced-colors: active)': { display: 'none' },
})

/** The write is done by here (seconds); then the loop stops. */
const END = 4.6

async function start(canvas: HTMLCanvasElement, signal: AbortSignal) {
  let wide = window.matchMedia('(min-width: 760px)')
  if (!wide.matches) {
    // Start later if the window grows past the breakpoint.
    wide.addEventListener('change', () => wide.matches && start(canvas, signal), { once: true, signal })
    return
  }

  // Decorative: never compete with first paint or the form. Wait for the
  // page's load, then an idle moment, before fetching three.js (decision 044).
  await afterLoadAndIdle(2000)
  if (signal.aborted || !canDrawScene()) return

  let T: typeof import('../../public/three.ts')
  try {
    T = await import('../../public/three.ts')
  } catch {
    return
  }
  if (signal.aborted) return

  let renderer: InstanceType<typeof T.WebGLRenderer>
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true })
  } catch {
    return
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0)

  let tokens = readTokenColors(canvas, sceneTokens)
  let raw = (c: readonly [number, number, number]) => new T.Color().setRGB(c[0], c[1], c[2], T.LinearSRGBColorSpace)

  let scene = new T.Scene()
  let camera = new T.PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.set(0, 0, 12)
  let group = new T.Group()
  group.position.y = 0.7
  scene.add(group)

  // The sphere: a Fibonacci lattice of cells, each with a write moment
  // that runs top to bottom, jittered, so the sweep has a ragged edge.
  let N = 2600
  let R = 3.4
  let pos = new Float32Array(N * 3)
  let at = new Float32Array(N)
  let rr = new Float32Array(N)
  let golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < N; i++) {
    let y = 1 - (i / (N - 1)) * 2
    let r = Math.sqrt(1 - y * y)
    let th = golden * i
    pos[i * 3] = Math.cos(th) * r * R
    pos[i * 3 + 1] = y * R
    pos[i * 3 + 2] = Math.sin(th) * r * R
    let h = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1
    rr[i] = h
    at[i] = 0.4 + ((1 - y) / 2) * 2.6 + h * 0.5
  }
  let geo = new T.BufferGeometry()
  geo.setAttribute('position', new T.BufferAttribute(pos, 3))
  geo.setAttribute('aAt', new T.BufferAttribute(at, 1))
  geo.setAttribute('aR', new T.BufferAttribute(rr, 1))
  let mat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uPx: { value: renderer.getPixelRatio() },
      uC1: { value: raw(tokens['--ion']) },
      uC2: { value: raw(tokens['--volt']) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uPx; attribute float aAt; attribute float aR;
      varying float vOn; varying float vSmall; varying float vFront; varying float vMix;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        // Written cells are 1s; a few stay 0 so it reads as data, not a shell.
        float written = step(aAt, uTime);
        vOn = written * step(0.18, aR);
        float size = (0.46 + 0.16 * written) * uPx * (160.0 / -mv.z);
        gl_PointSize = size;
        vSmall = 1.0 - smoothstep(6.0 * uPx, 9.0 * uPx, size);
        // Cells on the far side fade, so the sphere reads as a solid.
        vec3 n = normalize((modelViewMatrix * vec4(normalize(position), 0.0)).xyz);
        vFront = smoothstep(-0.6, 0.5, n.z);
        vMix = smoothstep(-0.9, 0.9, normalize(position).y);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uC1; uniform vec3 uC2;
      varying float vOn; varying float vSmall; varying float vFront; varying float vMix;
      ${bitGlsl}
      void main() {
        float a = bitAlpha(vOn, vSmall);
        if (a < 0.004) discard;
        vec3 c = mix(uC1, uC2, vMix);
        gl_FragColor = vec4(c, a * (0.25 + 0.75 * vFront) * 0.9);
      }`,
  })
  group.add(new T.Points(geo, mat))

  // The orbit: 40 bytes (8 cells each) on a tilted ring, in synapse.
  let bytes = 40
  let M = bytes * 8
  let rp = new Float32Array(M * 3)
  let ro = new Float32Array(M)
  for (let b = 0; b < bytes; b++) {
    for (let k = 0; k < 8; k++) {
      let i = b * 8 + k
      let a = (b / bytes) * Math.PI * 2 + (k - 3.5) * 0.018
      let r = 4.7
      rp[i * 3] = Math.cos(a) * r
      rp[i * 3 + 1] = 0
      rp[i * 3 + 2] = Math.sin(a) * r
      ro[i] = Math.abs(Math.sin((b * 8 + k) * 7.13) * 1000) % 1
    }
  }
  let rgeo = new T.BufferGeometry()
  rgeo.setAttribute('position', new T.BufferAttribute(rp, 3))
  rgeo.setAttribute('aR', new T.BufferAttribute(ro, 1))
  let rmat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uPx: { value: renderer.getPixelRatio() }, uColor: { value: raw(tokens['--synapse']) }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uPx; uniform float uTime; attribute float aR; varying float vOn; varying float vSmall;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = 0.34 * uPx * (160.0 / -mv.z);
        gl_PointSize = size;
        vSmall = 1.0 - smoothstep(6.0 * uPx, 9.0 * uPx, size);
        vOn = step(0.45, aR);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying float vOn; varying float vSmall;
      ${bitGlsl}
      void main() {
        float a = bitAlpha(vOn, vSmall);
        if (a < 0.004) discard;
        gl_FragColor = vec4(uColor, a * 0.8);
      }`,
  })
  let ring = new T.Points(rgeo, rmat)
  ring.rotation.x = 1.15
  ring.rotation.z = 0.3
  group.add(ring)

  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // The write runs on the wall clock from its first frame, so it ends at
  // END seconds whatever the frame rate (a slow GPU skips ahead, never
  // stretches past five seconds).
  let startedAt = 0
  let time = reduced ? END : 0
  let onScreen = true
  let observer = new IntersectionObserver(([entry]) => {
    onScreen = entry?.isIntersecting ?? true
    if (onScreen) schedule()
  })
  observer.observe(canvas)

  let width = 0
  let height = 0
  let raf = 0

  function schedule() {
    if (!raf && !signal.aborted && time < END) raf = requestAnimationFrame(frame)
  }

  function frame(now: number) {
    raf = 0
    if (signal.aborted || !onScreen || document.hidden) return
    if (!reduced) {
      startedAt ||= now
      time = Math.min(END, (now - startedAt) / 1000)
    }
    let w = canvas.clientWidth
    let h = canvas.clientHeight
    if (w && h && (w !== width || h !== height)) {
      width = w
      height = h
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      // Keep the ring (radius 4.7) inside a tall, narrow cell: back the
      // camera off until the sphere fits the width (tan 22.5° ≈ 0.414).
      camera.position.z = Math.max(12, 5.2 / camera.aspect / 0.414)
      camera.updateProjectionMatrix()
    }
    // One ease-out turn for the sphere and the orbit, settling as the write ends.
    let e = 1 - Math.pow(1 - time / END, 3)
    mat.uniforms.uTime!.value = time
    group.rotation.y = -0.5 + e * 0.9
    ring.rotation.y = 1.2 - e * (Math.PI * 2)
    renderer.render(scene, camera)
    // Fade in once there is a first frame, so the sphere never pops in.
    if (!('ready' in canvas.dataset)) canvas.dataset.ready = ''
    if (time < END) schedule()
    else canvas.dataset.rest = ''
  }

  document.addEventListener('visibilitychange', () => !document.hidden && schedule(), { signal })
  let resize = new ResizeObserver(() => {
    // At rest, a resize redraws the final frame once.
    if (time >= END && !raf) raf = requestAnimationFrame(frame)
  })
  resize.observe(canvas)
  signal.addEventListener('abort', () => {
    cancelAnimationFrame(raf)
    observer.disconnect()
    resize.disconnect()
    for (let disposable of [geo, mat, rgeo, rmat, renderer]) disposable.dispose()
  })
  schedule()
  if (reduced) raf ||= requestAnimationFrame(frame)
}
