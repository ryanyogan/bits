import { clientEntry, css, ref, type Handle } from 'remix/component'

import type { Field, FieldInput } from './field-scene.ts'
import { createField } from './field-scene.ts'

const stages = [
  ['01', 'Neurons'],
  ['02', 'Tokens'],
  ['03', 'Agents'],
  ['04', 'You'],
] as const

/**
 * The landing page's sticky 3D field layer (Main.md §NeuralField,
 * components §12.6–12.7): canvas + static dot grid + vignette + StageHud.
 *
 * Server-rendered as the static dot grid, which is also the fallback. In the
 * browser it waits until the page has loaded and the main thread is idle,
 * checks for WebGL 2, then dynamically imports `three` and starts the scene.
 * Any failure leaves the dot grid alone, silently. The whole layer is
 * `aria-hidden` and ignores the pointer.
 */
export const NeuralField = clientEntry(import.meta.url, function NeuralField(handle: Handle) {
  let stage = 0
  let live = false
  let layer: HTMLElement | undefined
  let canvas: HTMLCanvasElement | undefined

  handle.queueTask(() => {
    void boot()
  })

  async function boot() {
    let signal = handle.signal
    await afterLoadAndIdle()
    if (signal.aborted || !canvas || !layer || !hasWebGL2()) return

    let THREE: typeof import('three')
    try {
      THREE = await import('three')
    } catch {
      return
    }
    if (signal.aborted) return

    let root = layer.parentElement ?? document.body
    let doc = document.documentElement
    let metrics = { top: 0, height: 1, docHeight: 0, viewport: 1 }
    let scrollY = window.scrollY
    let measure = () => {
      metrics.top = root.getBoundingClientRect().top + window.scrollY
      metrics.height = root.offsetHeight
      metrics.docHeight = doc.scrollHeight
      metrics.viewport = window.innerHeight || 1
    }
    measure()

    let input: FieldInput = {
      pointer: { x: 0, y: 0 },
      progress() {
        // No scrollable page (an embedded preview): let the field cycle.
        if (metrics.docHeight - metrics.viewport <= 40) return null
        let p = (scrollY - metrics.top) / Math.max(1, metrics.height - metrics.viewport)
        return Math.min(1, Math.max(0, p))
      },
    }

    let field: Field
    try {
      field = createField(THREE, {
        canvas,
        input,
        count: window.innerWidth < 760 ? 1500 : 3400,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        onStage(next) {
          stage = next
          handle.update()
        },
      })
    } catch {
      return
    }
    field.resize(canvas.clientWidth, canvas.clientHeight)

    let pageVisible = document.visibilityState === 'visible'
    let onScreen = true
    let lost = false
    let sync = () => (pageVisible && onScreen && !lost ? field.start() : field.stop())

    let options = { signal, passive: true }
    window.addEventListener('scroll', () => (scrollY = window.scrollY), options)
    window.addEventListener(
      'pointermove',
      (event) => {
        input.pointer.x = (event.clientX / (window.innerWidth || 1)) * 2 - 1
        input.pointer.y = (event.clientY / (window.innerHeight || 1)) * 2 - 1
      },
      options,
    )
    window.addEventListener('resize', measure, options)
    document.addEventListener(
      'visibilitychange',
      () => {
        pageVisible = document.visibilityState === 'visible'
        sync()
      },
      { signal },
    )
    canvas.addEventListener(
      'webglcontextlost',
      () => {
        lost = true
        live = false
        sync()
        handle.update()
      },
      { signal },
    )

    let resizeObserver = new ResizeObserver(() => {
      if (canvas) field.resize(canvas.clientWidth, canvas.clientHeight)
    })
    resizeObserver.observe(canvas)
    let rootObserver = new ResizeObserver(measure)
    rootObserver.observe(root)
    let intersection = new IntersectionObserver((entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting)
      sync()
    })
    intersection.observe(layer)

    signal.addEventListener('abort', () => {
      resizeObserver.disconnect()
      rootObserver.disconnect()
      intersection.disconnect()
      field.dispose()
    })

    live = true
    sync()
    handle.update()
  }

  return () => (
    <div aria-hidden="true" mix={[layerStyle, ref((node) => (layer = node))]}>
      <canvas
        data-field=""
        data-live={live ? 'true' : undefined}
        mix={[canvasStyle, ref((node) => (canvas = node))]}
      />
      <div mix={dotGridStyle} />
      <div mix={vignetteStyle} />
      <div mix={hudStyle}>
        {stages.map(([n, label], index) => (
          <div key={n} data-on={index === stage ? 'true' : undefined} mix={hudItem}>
            <span>{`${n} · ${label}`}</span>
            <span data-on={index === stage ? 'true' : undefined} mix={hudBar} />
          </div>
        ))}
      </div>
    </div>
  )
})

function afterLoadAndIdle(): Promise<void> {
  return new Promise((resolve) => {
    let idle = () =>
      'requestIdleCallback' in window
        ? requestIdleCallback(() => resolve(), { timeout: 1500 })
        : setTimeout(resolve, 200)
    if (document.readyState === 'complete') idle()
    else window.addEventListener('load', idle, { once: true })
  })
}

/** three r163+ needs WebGL 2. Probe on a throwaway canvas so a failure logs nothing. */
function hasWebGL2(): boolean {
  try {
    let gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

const FIELD_HEIGHT = 'min(100vh, 960px)'

const layerStyle = css({
  position: 'sticky',
  top: 0,
  height: FIELD_HEIGHT,
  marginBottom: `calc(-1 * ${FIELD_HEIGHT})`,
  zIndex: 0,
  pointerEvents: 'none',
  overflow: 'hidden',
})

const canvasStyle = css({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  display: 'block',
  opacity: 0,
  transition: 'opacity 900ms var(--ease)',
  '&[data-live="true"]': { opacity: 1 },
})

const dotGridStyle = css({
  position: 'absolute',
  inset: 0,
  backgroundImage: 'radial-gradient(var(--dot-grid-field) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
  WebkitMaskImage: 'radial-gradient(ellipse at 50% 40%, #000 0%, transparent 75%)',
  maskImage: 'radial-gradient(ellipse at 50% 40%, #000 0%, transparent 75%)',
})

const vignetteStyle = css({
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(ellipse 70% 60% at 50% 45%, rgb(7 8 13 / 0) 0%, rgb(7 8 13 / 0.35) 60%, rgb(7 8 13 / 0.94) 100%)',
})

const hudStyle = css({
  position: 'absolute',
  right: 'var(--space-8)',
  top: '50%',
  transform: 'translateY(-50%)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
  alignItems: 'flex-end',
  '@media (max-width: 820px)': { display: 'none' },
})

const hudItem = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-11)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  color: 'var(--dim)',
  transition: 'color 400ms',
  '&[data-on="true"]': { color: 'var(--volt)' },
})

const hudBar = css({
  display: 'block',
  height: '2px',
  width: '12px',
  background: 'var(--line-dashed-strong)',
  transition: 'width 500ms var(--ease), background-color 500ms',
  '&[data-on="true"]': { width: '36px', background: 'var(--volt)' },
})
