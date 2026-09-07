export type LoadStage = 'runtime' | 'assets' | 'motions' | 'frame'
export type LoadFailure = 'network' | 'timeout' | 'resource' | 'webgl' | 'module' | 'unknown'
export type LoadState = {
  status: 'waiting' | 'loading' | 'ready' | 'offline' | 'recovering' | 'error'
  stage: LoadStage
  slow: boolean
  failure?: LoadFailure
}

export class CompanionLoadError extends Error {
  kind: LoadFailure
  constructor(kind: LoadFailure) { super(`Companion load failed: ${kind}`); this.kind = kind }
}

export function classifyLoadError(error: unknown): LoadFailure {
  if (error instanceof CompanionLoadError) return error.kind
  if (error instanceof SyntaxError) return 'resource'
  if (error && typeof error === 'object' && 'status' in error) {
    const status = Number(error.status)
    return status === 0 || status === 408 || status === 429 || status >= 500 ? 'network' : 'resource'
  }
  return 'unknown'
}

type Scene = { destroy: () => void }
type Options<T extends Scene> = {
  load: (signal: AbortSignal, stage: (stage: LoadStage) => void) => Promise<T>
  change: (state: LoadState) => void
  ready: (scene: T) => void
}

// This controller owns attempts; React only renders its current state.
export function createCompanionLoader<T extends Scene>(options: Options<T>) {
  let disposed = false
  let generation = 0
  let controller: AbortController | undefined
  let scene: T | undefined
  let deadline: ReturnType<typeof setTimeout> | undefined
  let slowTimer: ReturnType<typeof setTimeout> | undefined
  let state: LoadState = { status: 'waiting', stage: 'runtime', slow: false }
  const diagnostics: { stage: LoadStage; elapsed: number; failure?: LoadFailure }[] = []
  const publish = (next: LoadState) => { state = next; if (!disposed) options.change(next) }
  const clearTimers = () => { clearTimeout(deadline); clearTimeout(slowTimer) }
  const release = () => {
    clearTimers()
    controller?.abort()
    scene?.destroy()
    scene = undefined
  }
  const start = () => {
    if (disposed || state.status === 'loading') return
    release()
    const token = ++generation
    const attempt = controller = new AbortController()
    const started = performance.now()
    const active = () => !disposed && token === generation && !attempt.signal.aborted
    const record = (failure?: LoadFailure) => {
      diagnostics.push({ stage: state.stage, elapsed: Math.round(performance.now() - started), failure })
      if (diagnostics.length > 20) diagnostics.shift()
    }
    const fail = (error: unknown) => {
      if (!active()) return
      const failure = classifyLoadError(error)
      record(failure)
      release()
      publish({ ...state, status: 'error', failure })
    }
    publish({ status: 'loading', stage: 'runtime', slow: false })
    deadline = setTimeout(() => fail(new CompanionLoadError('timeout')), 30000)
    slowTimer = setTimeout(() => { if (active()) publish({ ...state, slow: true }) }, 5000)
    void Promise.resolve().then(() => {
      attempt.signal.throwIfAborted()
      return options.load(attempt.signal, (stage) => { if (active()) publish({ ...state, stage }) })
    }).then((loaded) => {
      if (!active()) { loaded.destroy(); return }
      clearTimers()
      scene = loaded
      record()
      publish({ ...state, status: 'ready', slow: false })
      options.ready(loaded)
    }).catch(fail)
  }
  return {
    start,
    retry: start,
    get state() { return state },
    get diagnostics() { return [...diagnostics] },
    destroy() { disposed = true; generation++; release() },
  }
}
