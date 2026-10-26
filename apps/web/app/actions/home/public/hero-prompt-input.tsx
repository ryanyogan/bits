import { clientEntry, css, on, type Handle } from 'remix/component'

export interface HeroPromptInputProps {
  id: string
  name: string
  /** Placeholder prompts the typewriter cycles through; the first is server-rendered. */
  prompts: string[]
}

const TICK_MS = 55
const HOLD_FULL = 34
const HOLD_NEXT = 6

/**
 * The hero prompt input with a typewriter placeholder (Main.md §2,
 * components §7.4). Server-rendered with the first prompt as a static
 * placeholder; in the browser it types each prompt (+1 char per 55ms tick),
 * holds, deletes 2 chars per tick and moves on. It pauses while focused or
 * non-empty, and stays static under reduced motion.
 */
export const HeroPromptInput = clientEntry(
  import.meta.url,
  function HeroPromptInput(handle: Handle<HeroPromptInputProps>) {
    let placeholder = handle.props.prompts[0] ?? ''
    let focused = false
    let filled = false

    if (typeof window !== 'undefined' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let state = { i: 0, c: 0, dir: 1, hold: 0 }
      let timer = setInterval(() => {
        if (focused || filled) return
        if (state.hold > 0) {
          state.hold--
          return
        }
        let prompts = handle.props.prompts
        let prompt = prompts[state.i] ?? ''
        if (state.dir > 0) {
          state.c++
          if (state.c >= prompt.length) {
            state.dir = -1
            state.hold = HOLD_FULL
          }
        } else {
          state.c -= 2
          if (state.c <= 0) {
            state.c = 0
            state.dir = 1
            state.i = (state.i + 1) % prompts.length
            state.hold = HOLD_NEXT
          }
        }
        placeholder = `${prompt.slice(0, state.c)}▍`
        handle.update()
      }, TICK_MS)
      handle.signal.addEventListener('abort', () => clearInterval(timer))
    }

    return () => {
      let { id, name } = handle.props
      return (
        <input
          id={id}
          name={name}
          type="text"
          autoComplete="off"
          enterKeyHint="go"
          placeholder={placeholder}
          mix={[
            inputStyle,
            on('focus', () => {
              focused = true
            }),
            on('blur', () => {
              focused = false
            }),
            on('input', (event) => {
              filled = event.currentTarget.value !== ''
            }),
          ]}
        />
      )
    }
  },
)

const inputStyle = css({
  flex: 1,
  minWidth: 0,
  height: '52px',
  padding: 0,
  background: 'transparent',
  border: 0,
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--fs-17)',
  '&::placeholder': { color: 'var(--dim)', opacity: 1 },
  // The bar shows focus (focus-within border + glow); the input itself does not.
  '&:focus, &:focus-visible': { outline: 'none', boxShadow: 'none' },
  '@media (max-width: 480px)': { fontSize: 'var(--fs-16)' },
})
