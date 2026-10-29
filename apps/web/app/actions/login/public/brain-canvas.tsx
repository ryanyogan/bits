import type { Handle } from 'remix/component'
import { clientEntry, css, ref } from 'remix/component'

/**
 * BrainCanvas (Auth spec, "BrainCanvas logic"): a breathing Fibonacci sphere
 * of 2,800 points with an orbiting synapse ring, drawn with three.js.
 *
 * Decorative and progressive: the server renders an empty canvas, and the
 * browser loads three.js only when the pane is visible at ≥760px, after the
 * page's load event and an idle moment, and fades the first frame in. Pauses
 * when the tab or pane is hidden, runs at quarter speed for reduced motion,
 * caps DPR at 2 and disposes everything when removed. Client navigation
 * between the auth pages keeps this node (and its GL context) in place;
 * `data-ready` is client-owned, so reconciliation leaves it alone.
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
})

function afterLoadAndIdle() {
  return new Promise<void>((resolve) => {
    let idle = () =>
      'requestIdleCallback' in window ? requestIdleCallback(() => resolve(), { timeout: 2000 }) : setTimeout(resolve, 200)
    if (document.readyState === 'complete') idle()
    else window.addEventListener('load', idle, { once: true })
  })
}

async function start(canvas: HTMLCanvasElement, signal: AbortSignal) {
  let wide = window.matchMedia('(min-width: 760px)')
  if (!wide.matches) {
    // Start later if the window grows past the breakpoint.
    wide.addEventListener('change', () => wide.matches && start(canvas, signal), { once: true, signal })
    return
  }

  // Decorative: never compete with first paint or the form. Wait for the
  // page's load, then an idle moment, before fetching three.js (decision 044).
  await afterLoadAndIdle()
  if (signal.aborted) return

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

  let scene = new T.Scene()
  let camera = new T.PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.set(0, 0, 12)
  let group = new T.Group()
  group.position.y = 0.6
  scene.add(group)

  // Fibonacci sphere that breathes like a thinking brain.
  let N = 2800
  let pos = new Float32Array(N * 3)
  let rr = new Float32Array(N)
  let golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < N; i++) {
    let y = 1 - (i / (N - 1)) * 2
    let r = Math.sqrt(1 - y * y)
    let th = golden * i
    pos[i * 3] = Math.cos(th) * r * 3
    pos[i * 3 + 1] = y * 3
    pos[i * 3 + 2] = Math.sin(th) * r * 3
    rr[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1
  }
  let geo = new T.BufferGeometry()
  geo.setAttribute('position', new T.BufferAttribute(pos, 3))
  geo.setAttribute('aR', new T.BufferAttribute(rr, 1))
  let mat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: `
      uniform float uTime; uniform float uPx; attribute float aR; varying float vH; varying float vR;
      void main() {
        vec3 n = normalize(position);
        float w = sin(n.x * 4.0 + uTime * 0.9) * sin(n.y * 5.0 + uTime * 0.7) * sin(n.z * 3.0 + uTime * 1.1);
        vec3 p = position * (1.0 + w * 0.16);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPx * (1.0 + max(w, 0.0) * 3.0) * (26.0 / -mv.z);
        vH = w; vR = abs(aR);
      }`,
    // Ion → volt by wave height: the toned accents of decision 047 (#5EC8DC /
    // #B8E05A), a little dimmer at rest so the cloud stays a backdrop.
    fragmentShader: `
      varying float vH; varying float vR;
      void main() {
        float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.0, d); a *= a;
        vec3 c = mix(vec3(0.369, 0.784, 0.863), vec3(0.722, 0.878, 0.353), smoothstep(-0.2, 0.6, vH));
        gl_FragColor = vec4(c, a * 0.85 * (0.3 + max(vH, 0.0) * 0.8 + vR * 0.18));
      }`,
  })
  group.add(new T.Points(geo, mat))

  // Orbit ring in synapse (#9B8CE6, decision 047).
  let M = 900
  let rp = new Float32Array(M * 3)
  for (let i = 0; i < M; i++) {
    let a = (i / M) * Math.PI * 2
    let r = 4.4 + Math.sin(i * 7.1) * 0.08
    rp[i * 3] = Math.cos(a) * r
    rp[i * 3 + 1] = Math.sin(i * 3.3) * 0.05
    rp[i * 3 + 2] = Math.sin(a) * r
  }
  let rgeo = new T.BufferGeometry()
  rgeo.setAttribute('position', new T.BufferAttribute(rp, 3))
  let rmat = new T.PointsMaterial({
    color: 0x9b8ce6,
    size: 0.045,
    transparent: true,
    opacity: 0.55,
    blending: T.AdditiveBlending,
    depthWrite: false,
  })
  let ring = new T.Points(rgeo, rmat)
  ring.rotation.x = 1.15
  ring.rotation.z = 0.3
  group.add(ring)

  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  let onScreen = true
  let observer = new IntersectionObserver(([entry]) => {
    onScreen = entry?.isIntersecting ?? true
    if (onScreen) schedule()
  })
  observer.observe(canvas)

  let t = 0
  let last = performance.now()
  let width = 0
  let height = 0
  let raf = 0

  function schedule() {
    if (!raf && !signal.aborted) {
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
  }

  function frame(now: number) {
    raf = 0
    if (signal.aborted || !onScreen || document.hidden) return
    t += Math.min(0.05, (now - last) / 1000) * (reduced.matches ? 0.25 : 1)
    last = now
    let w = canvas.clientWidth
    let h = canvas.clientHeight
    if (w && h && (w !== width || h !== height)) {
      width = w
      height = h
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      // Keep the ring (radius 4.4) inside a tall, narrow cell: back the
      // camera off until the cloud fits the width (tan 22.5° ≈ 0.414).
      camera.position.z = Math.max(12, 5 / camera.aspect / 0.414)
      camera.updateProjectionMatrix()
    }
    mat.uniforms.uTime!.value = t
    group.rotation.y = t * 0.12
    ring.rotation.y = -t * 0.3
    renderer.render(scene, camera)
    // Fade in once there is a first frame, so the cloud never pops in.
    if (!('ready' in canvas.dataset)) canvas.dataset.ready = ''
    schedule()
  }

  document.addEventListener('visibilitychange', () => !document.hidden && schedule(), { signal })
  signal.addEventListener('abort', () => {
    cancelAnimationFrame(raf)
    observer.disconnect()
    for (let disposable of [geo, mat, rgeo, rmat, renderer]) disposable.dispose()
  })
  schedule()
}
