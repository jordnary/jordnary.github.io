export type CompanionReaction = 'headpat' | 'greeting' | 'complete'
export type CompanionPhase = 'idle' | 'noticing' | 'responding' | 'recovering'
export type CompanionState = { phase: CompanionPhase; reaction: CompanionReaction | null; text: string }

export const companionMotions = {
  headpat: { group: 'HeadPat', duration: 10300 },
  greeting: { group: 'Greeting', duration: 7870 },
  complete: { group: 'Complete', duration: 6100 },
} as const

type Driver = {
  prepare: (reaction: CompanionReaction) => Promise<boolean>
  play: (reaction: CompanionReaction) => Promise<boolean>
  idle: () => void
  reducedMotion: () => boolean
  change: (state: CompanionState) => void
}

/** One response at a time; suspended scenes discard delayed loads and old replies. */
export function createCompanionBehavior(driver: Driver) {
  let state: CompanionState = { phase: 'idle', reaction: null, text: '' }
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  let lastCompletion = -Infinity
  const publish = (next: CompanionState) => { state = next; driver.change(next) }
  const clear = () => { clearTimeout(timer); timer = undefined }
  const recover = () => {
    if (disposed || state.phase === 'idle' || state.phase === 'recovering') return
    generation++
    clear()
    driver.idle()
    publish({ ...state, phase: 'recovering', text: '' })
    timer = setTimeout(() => publish({ phase: 'idle', reaction: null, text: '' }), driver.reducedMotion() ? 0 : 450)
  }
  const reset = () => {
    generation++
    clear()
    driver.idle()
    publish({ phase: 'idle', reaction: null, text: '' })
  }
  return {
    get state() { return state },
    request(reaction: CompanionReaction, text: string) {
      if (disposed || state.phase !== 'idle') return false
      if (reaction === 'complete' && performance.now() - lastCompletion < 15000) return false
      if (reaction === 'complete') lastCompletion = performance.now()
      const token = ++generation
      publish({ phase: 'noticing', reaction, text: '' })
      // Bound slow/failed asset loads; a late result cannot restart a cancelled response.
      timer = setTimeout(recover, 8000)
      const quiet = driver.reducedMotion()
      const prepare = quiet ? Promise.resolve(true) : driver.prepare(reaction).catch(() => false)
      void Promise.all([prepare, new Promise<void>((resolve) => setTimeout(resolve, quiet ? 0 : 240))])
        .then(async ([ready]) => {
          if (disposed || token !== generation) return
          clear()
          publish({ phase: 'responding', reaction, text })
          // Text remains useful if a response asset is unavailable.
          timer = setTimeout(recover, quiet || !ready ? 1800 : companionMotions[reaction].duration + 2000)
          if (!quiet && ready) {
            const started = await driver.play(reaction).catch(() => false)
            if (!disposed && token === generation && !started) {
              clear()
              timer = setTimeout(recover, 1800)
            }
          }
        })
      return true
    },
    finish() { if (state.phase === 'responding') recover() },
    reset,
    destroy() { disposed = true; generation++; clear() },
  }
}
