// Shared pieces of the decorative three.js scenes (decision 057): the
// landing field, the catalog graph and the sign-in sphere. They draw the
// same vocabulary, bits as square cells that read 0 (an outline) or 1 (a
// fill), in the site's accent colours read from the CSS tokens at run time.
//
// Nothing here imports three: the scenes receive it after their dynamic
// import, so this module costs nothing on the initial page load.

export type Rgb = readonly [number, number, number]

/**
 * Reads CSS custom properties off `el` as sRGB floats (0–1). Any colour
 * syntax works (hex, rgb(), oklch(): the browser resolves it on a 2D canvas),
 * and a token that is missing or unparsable takes its `fallback`.
 */
export function readTokenColors<K extends string>(el: Element, fallback: Record<K, string>): Record<K, Rgb> {
  let styles = getComputedStyle(el)
  let ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  let out = {} as Record<K, Rgb>
  for (let name of Object.keys(fallback) as K[]) {
    let value = styles.getPropertyValue(name).trim()
    out[name] = parseColor(ctx, value) ?? parseColor(ctx, fallback[name]) ?? [1, 1, 1]
  }
  return out
}

const SENTINEL = '#010203'

function parseColor(ctx: CanvasRenderingContext2D | null, value: string): Rgb | undefined {
  if (!ctx || !value) return undefined
  ctx.fillStyle = SENTINEL
  ctx.fillStyle = value
  // An invalid string leaves the sentinel in place.
  if (ctx.fillStyle === SENTINEL && value.toLowerCase() !== SENTINEL) return undefined
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillRect(0, 0, 1, 1)
  let [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data as unknown as [number, number, number, number]
  if (a === 0) return undefined
  return [r / 255, g / 255, b / 255]
}

/** The accent tokens every scene reads, with decision 047's values as the fallback. */
export const sceneTokens = {
  '--volt': '#b8e05a',
  '--volt-soft': '#d9eeaa',
  '--ion': '#5ec8dc',
  '--synapse': '#9b8ce6',
  '--text': '#eceef5',
} as const

export type SceneTokens = Record<keyof typeof sceneTokens, Rgb>

/** Resolves after the page's `load` event and the next idle moment: decorative work never races first paint. */
export function afterLoadAndIdle(timeout = 1500): Promise<void> {
  return new Promise((resolve) => {
    let idle = () =>
      'requestIdleCallback' in window ? requestIdleCallback(() => resolve(), { timeout }) : setTimeout(resolve, 200)
    if (document.readyState === 'complete') idle()
    else window.addEventListener('load', idle, { once: true })
  })
}

/**
 * Whether a scene should draw at all: WebGL 2 (three r163+ needs it), and
 * not forced colours, where a decorative canvas in the site's accents is
 * noise the viewer asked to be rid of (decision 041 hid the catalog's art
 * there; 057 extends that to every scene). The probe uses a throwaway
 * canvas so a failure logs nothing.
 */
export function canDrawScene(): boolean {
  if (matchMedia('(forced-colors: active)').matches) return false
  try {
    let gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

/** Park–Miller PRNG with a Box–Muller gaussian: deterministic shapes, as the artboard had. */
export function seeded(seed: number) {
  let s = seed
  let rnd = () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
  let gauss = () => {
    let u = 0
    let v = 0
    while (!u) u = rnd()
    while (!v) v = rnd()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  return { rnd, gauss }
}

/** Frame-rate independent `value += (target − value) * k` (k is the per-frame factor at 60 fps). */
export function ease(k: number, dt: number) {
  return 1 - Math.pow(1 - k, dt * 60)
}

export function smooth(a: number, b: number, x: number) {
  let t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** 1 at `centre`, falling to 0 one `width` away: how much a stage is "on". */
export function bell(x: number, centre: number, width = 0.65) {
  return Math.max(0, 1 - Math.abs(x - centre) / width)
}

/** GLSL: a cheap 2D hash, for vertex shaders that pick a bit's state. */
export const hashGlsl = /* glsl */ `
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`

/**
 * GLSL for the bit sprite (fragment only: it reads `gl_PointCoord`).
 * `bitAlpha(on, small)` shades the point as a square: a 1 is a filled cell,
 * a 0 a hairline outline (a cell under ~7px can't show the outline, so it
 * dims instead). Flat (decision 047): no core highlight, a one-pixel soft
 * edge.
 */
export const bitGlsl = /* glsl */ `
float bitAlpha(float on, float small) {
  vec2 c = abs(gl_PointCoord - 0.5);
  float d = max(c.x, c.y);
  float fill = 1.0 - smoothstep(0.42, 0.5, d);
  float ring = smoothstep(0.26, 0.34, d) * (1.0 - smoothstep(0.44, 0.5, d));
  float zero = mix(ring * 0.75, fill * 0.28, small);
  return mix(zero, fill, on);
}
`
