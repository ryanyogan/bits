import type { Handle } from 'remix/component'
import { clientEntry, css, ref } from 'remix/component'

import { afterLoadAndIdle, bitGlsl, canDrawScene, onThemeChange, readTokenColors, sceneTokens, seeded } from '../../public/bits-gl.ts'

const FORCED_COLORS = '@media (forced-colors: active)'

export interface CatalogCourseNode {
  tone: 'volt' | 'ion' | 'synapse'
  lessons: number
}

export interface CatalogBackgroundProps {
  /** Changing it replays the assembly (a new track is a new graph). */
  replayKey: string
  /** The courses on the page, in path order: each becomes a chip in its tone, with a trail of lesson bits. */
  courses: CatalogCourseNode[]
}

/**
 * The catalog's background (decision 057, replacing 041's CSS rabbit hole):
 * the courses as a graph. Each course is a chip of bits in its track's
 * colour, sized by its lesson count, its lessons trailing off it as a
 * string of cells, and the chips are chained in path order with trails of
 * bits that write themselves in. The graph assembles over about four
 * seconds, then rests, so it needs no pause control (WCAG 2.2.2); picking a
 * track remounts the layer and plays it again.
 *
 * Server-rendered as the landing's graph paper (also the fallback). The
 * browser waits for load and an idle moment, checks WebGL 2, loads three
 * and draws. Reduced motion draws the assembled graph once. Forced colours
 * hide the layer. Decorative only: `aria-hidden`, no pointer events.
 */
export const CatalogBackground = clientEntry(import.meta.url, function CatalogBackground(handle: Handle<CatalogBackgroundProps>) {
  let courses = handle.props.courses
  return () => (
    <div aria-hidden="true" data-rmx-key={handle.props.replayKey} mix={layerStyle}>
      <div mix={gridStyle} />
      {/* The art stays inside the ruled column: the graph paper runs full
       * bleed, the graph is clipped at the rails. */}
      <div mix={columnStyle}>
        <canvas
          data-catalog-graph=""
          data-rmx-preserve-attrs="data-ready"
          mix={[canvasStyle, ref((canvas, signal) => void start(canvas as HTMLCanvasElement, courses, signal))]}
        />
      </div>
    </div>
  )
})

/** The sequence is over by here (seconds); then the loop stops. */
const END = 4.4

async function start(canvas: HTMLCanvasElement, courses: CatalogCourseNode[], signal: AbortSignal) {
  await afterLoadAndIdle()
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
  let tones = { volt: 0, ion: 1, synapse: 2 } as const

  let scene = new T.Scene()
  let camera = new T.PerspectiveCamera(40, 1, 0.1, 100)
  camera.position.set(0, 0, 11)
  let group = new T.Group()
  scene.add(group)

  // Layout: the course chips on an arc, tilted toward the viewer; the
  // lessons trail outward from each chip; a trail of bits joins each chip
  // to the next. Every cell has a tone, a size and the moment it appears.
  let { rnd } = seeded(7)
  let nodes = courses.length ? courses : [{ tone: 'volt', lessons: 6 } as const]
  let pos: number[] = []
  let tone: number[] = []
  let size: number[] = []
  let delay: number[] = []
  let rand: number[] = []
  let cell = (x: number, y: number, z: number, t: number, s: number, d: number) => {
    pos.push(x, y, z)
    tone.push(t)
    size.push(s)
    delay.push(d)
    rand.push(rnd())
  }
  let K = nodes.length
  let centres = nodes.map((_, k) => {
    let a = K === 1 ? 0 : -1.9 + (k / (K - 1)) * 3.8
    let r = 3.6
    return { x: Math.sin(a) * r, y: 0.5 - k * 0.12, z: Math.cos(a) * r - r }
  })
  nodes.forEach((course, k) => {
    let c = centres[k]!
    let t = tones[course.tone]
    let at = k * 0.34
    let side = 2 + Math.min(4, Math.round(course.lessons / 3))
    let pitch = 0.17
    for (let row = 0; row < side; row++) {
      for (let col = 0; col < side; col++) {
        cell(c.x + (col - (side - 1) / 2) * pitch, c.y + (row - (side - 1) / 2) * pitch, c.z, t, 0.52, at + rnd() * 0.3)
      }
    }
    // Lessons: a string of cells curling up and out from the chip.
    let out = Math.sin(-1.9 + (K === 1 ? 0 : (k / (K - 1)) * 3.8))
    for (let j = 0; j < course.lessons; j++) {
      let d = 0.55 + j * 0.3
      let curl = j * 0.18
      cell(c.x + out * d * 0.35, c.y + d * 0.8 + curl * 0.1, c.z + Math.sin(curl) * 0.4, t, 0.42, at + 0.5 + j * 0.12)
    }
    // The path on to the next course, written bit by bit.
    let next = centres[k + 1]
    if (next) {
      let steps = 12
      for (let s = 1; s < steps; s++) {
        let u = s / steps
        cell(c.x + (next.x - c.x) * u, c.y + (next.y - c.y) * u + Math.sin(u * Math.PI) * 0.35, c.z + (next.z - c.z) * u, t, 0.3, at + 0.9 + u * 0.7)
      }
    }
  })

  let geo = new T.BufferGeometry()
  geo.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('aTone', new T.BufferAttribute(new Float32Array(tone), 1))
  geo.setAttribute('aSize', new T.BufferAttribute(new Float32Array(size), 1))
  geo.setAttribute('aDelay', new T.BufferAttribute(new Float32Array(delay), 1))
  geo.setAttribute('aR', new T.BufferAttribute(new Float32Array(rand), 1))
  let mat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uPx: { value: renderer.getPixelRatio() },
      uAlpha: { value: 1 },
      uTones: { value: [raw(tokens['--volt']), raw(tokens['--ion']), raw(tokens['--synapse'])] },
    },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uPx;
      attribute float aTone; attribute float aSize; attribute float aDelay; attribute float aR;
      varying float vTone; varying float vOn; varying float vSmall;
      void main() {
        float t = clamp((uTime - aDelay) / 0.5, 0.0, 1.0);
        float pop = t * t * (3.0 - 2.0 * t);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = aSize * pop * uPx * (150.0 / -mv.z);
        gl_PointSize = size;
        vSmall = 1.0 - smoothstep(6.0 * uPx, 9.0 * uPx, size);
        // Most bits settle as 1s; a few stay 0s so the chips read as data.
        vOn = step(0.3, aR);
        vTone = aTone;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTones[3]; uniform float uAlpha;
      varying float vTone; varying float vOn; varying float vSmall;
      ${bitGlsl}
      void main() {
        float a = bitAlpha(vOn, vSmall);
        if (a < 0.004) discard;
        vec3 c = vTone < 0.5 ? uTones[0] : (vTone < 1.5 ? uTones[1] : uTones[2]);
        gl_FragColor = vec4(c, a * uAlpha);
      }`,
  })
  let points = new T.Points(geo, mat)
  points.frustumCulled = false
  group.add(points)

  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // The assembly runs on the wall clock from its first frame, so it ends at
  // END seconds whatever the frame rate.
  let startedAt = 0
  let time = reduced ? END : 0
  let raf = 0
  let width = 0
  let height = 0

  function layout() {
    let w = canvas.clientWidth
    let h = canvas.clientHeight
    if (!w || !h || (w === width && h === height)) return
    width = w
    height = h
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    // Beside the title on wide screens (the right 45% of the view), behind
    // it and quieter on phones.
    let phone = w < 760
    let halfWidth = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z * camera.aspect
    group.position.x = phone ? 0 : halfWidth * 0.42
    group.position.y = phone ? 1.4 : 0.2
    let scale = phone ? Math.min(1, w / 520) : Math.min(1.05, w / 1200)
    group.scale.setScalar(scale)
    mat.uniforms.uAlpha!.value = phone ? 0.55 : 1
  }

  function frame(now: number) {
    raf = 0
    if (signal.aborted) return
    if (document.hidden) return
    if (!reduced) {
      startedAt ||= now
      time = Math.min(END, (now - startedAt) / 1000)
    }
    layout()
    let e = 1 - Math.pow(1 - time / END, 3)
    group.rotation.x = 0.32
    group.rotation.y = -0.85 + e * 0.6
    mat.uniforms.uTime!.value = time
    renderer.render(scene, camera)
    if (!('ready' in canvas.dataset)) canvas.dataset.ready = ''
    if (time < END) raf = requestAnimationFrame(frame)
    else canvas.dataset.rest = ''
  }

  let schedule = () => {
    if (!raf && !signal.aborted && time < END) raf = requestAnimationFrame(frame)
  }
  document.addEventListener('visibilitychange', () => !document.hidden && schedule(), { signal })
  let resize = new ResizeObserver(() => {
    if (time >= END) {
      // At rest, a resize redraws the final frame once.
      width = 0
      raf ||= requestAnimationFrame(frame)
    }
  })
  resize.observe(canvas)
  // The theme flipped (decision 062): the tones are read again and, at rest, the frame is redrawn.
  let stopThemeWatch = onThemeChange(() => {
    let t = readTokenColors(canvas, sceneTokens)
    mat.uniforms.uTones!.value = [raw(t['--volt']), raw(t['--ion']), raw(t['--synapse'])]
    if (time >= END) raf ||= requestAnimationFrame(frame)
  })
  signal.addEventListener('abort', () => {
    stopThemeWatch()
    cancelAnimationFrame(raf)
    resize.disconnect()
    for (let d of [geo, mat, renderer]) d.dispose()
  })
  raf = requestAnimationFrame(frame)
}

const layerStyle = css({
  position: 'absolute',
  insetInline: 0,
  top: 0,
  height: 'min(760px, 100%)',
  zIndex: -1,
  overflow: 'clip',
  pointerEvents: 'none',
  userSelect: 'none',
  // Fades out above the course grid, so cards always sit on plain ink.
  maskImage: 'linear-gradient(to bottom, black 0%, black 45%, transparent 100%)',
  [FORCED_COLORS]: { display: 'none' },
})

const gridStyle = css({
  position: 'absolute',
  inset: 0,
  // The landing field's graph paper (decision 047), so the two pages match.
  backgroundImage:
    'linear-gradient(var(--field-grid) 1px, transparent 1px), linear-gradient(90deg, var(--field-grid) 1px, transparent 1px)',
  backgroundSize: 'var(--field-grid-step) var(--field-grid-step)',
  backgroundPosition: 'center top',
  // The grid only shows around the graph.
  maskImage: 'radial-gradient(ellipse 60% 70% at 74% 30%, black, transparent 70%)',
  '@media (max-width: 760px)': {
    maskImage: 'radial-gradient(ellipse 90% 60% at 80% 18%, black, transparent 75%)',
  },
})

/** The PageFrame's column (rails included), as an absolute box over the full-bleed layer. */
const columnStyle = css({
  position: 'absolute',
  top: 0,
  bottom: 0,
  insetInline: 'max(var(--frame-inset), calc((100% - var(--frame-max)) / 2))',
  overflow: 'clip',
})

const canvasStyle = css({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  display: 'block',
  opacity: 0,
  transition: 'opacity var(--duration-pop) var(--ease-out)',
  '&[data-ready]': { opacity: 'var(--scene-strength)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  [FORCED_COLORS]: { display: 'none' },
})
