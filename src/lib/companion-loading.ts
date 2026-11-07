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
  available?: () => boolean
  online?: () => boolean
  contentReady?: () => boolean
  schedule?: (start: () => void) => () => void
}

// This controller owns attempts; React only renders its current state.
export function createCompanionLoader<T extends Scene>(options: Options<T>) {
  let disposed = false
  let generation = 0
  let controller: AbortController | undefined
  let scene: T | undefined
  let deadline: ReturnType<typeof setTimeout> | undefined
  let slowTimer: ReturnType<typeof setTimeout> | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let contextTimer: ReturnType<typeof setTimeout> | undefined
  let pending = false
  let initial = true
  let deferred = false
  let cancelStart: (() => void) | undefined
  let retryAt = 0
  let retries = 0
  let contextWaiting = false
  let contextRecovery = false
  let contextAttempts: number[] = []
  const online = () => options.online?.() ?? true
  const available = () => options.available?.() ?? true
  let state: LoadState = { status: 'waiting', stage: 'runtime', slow: false }
  const diagnostics: { stage: LoadStage; elapsed: number; retries: number; failure?: LoadFailure }[] = []
  const publish = (next: LoadState) => { state = next; if (!disposed) options.change(next) }
  const clearTimers = () => { clearTimeout(deadline); clearTimeout(slowTimer) }
  const release = () => {
    clearTimers()
    scene?.destroy()
    scene = undefined
    controller?.abort()
    controller = undefined
  }
  const sync = () => {
    clearTimeout(retryTimer)
    if (disposed || !pending || contextWaiting) return
    if (!available() || (initial && deferred && options.contentReady?.() === false)) {
      cancelStart?.(); cancelStart = undefined
      return
    }
    if (!online()) { cancelStart?.(); cancelStart = undefined; publish({ ...state, status: 'offline' }); return }
    if (initial) {
      if (deferred && options.schedule) {
        if (!cancelStart) cancelStart = options.schedule(() => { cancelStart = undefined; begin() })
      } else begin()
      return
    }
    publish({ ...state, status: 'recovering' })
    retryTimer = setTimeout(() => {
      if (!disposed && pending && available() && online()) begin()
    }, Math.max(0, retryAt - Date.now()))
  }
  const begin = () => {
    if (disposed || !pending || state.status === 'loading') return
    if (!available() || !online() || (initial && deferred && options.contentReady?.() === false)) { sync(); return }
    cancelStart?.(); cancelStart = undefined
    initial = false
    pending = false
    clearTimeout(retryTimer)
    clearTimeout(contextTimer)
    contextWaiting = false
    release()
    const token = ++generation
    const attempt = controller = new AbortController()
    const started = performance.now()
    const active = () => !disposed && token === generation && !attempt.signal.aborted
    const record = (failure?: LoadFailure) => {
      diagnostics.push({ stage: state.stage, elapsed: Math.round(performance.now() - started), retries, failure })
      if (diagnostics.length > 20) diagnostics.shift()
    }
    const fail = (error: unknown) => {
      if (!active()) return
      const failure = classifyLoadError(error)
      record(failure)
      release()
      publish({ ...state, status: 'error', failure })
      const limit = contextRecovery ? 0 : failure === 'network' || failure === 'timeout' ? 2 : failure === 'unknown' ? 1 : 0
      if (retries < limit) {
        retryAt = Date.now() + [2000, 5000][retries]
        retries++
        pending = true
        sync()
      }
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
      contextRecovery = false
      publish({ ...state, status: 'ready', slow: false })
      options.ready(loaded)
    }).catch(fail)
  }
  return {
    start(remembered = false) {
      if (disposed || state.status === 'loading' || state.status === 'ready') return
      deferred = remembered
      pending = true
      if (!deferred) { cancelStart?.(); cancelStart = undefined }
      sync()
    },
    retry() {
      if (disposed || state.status === 'loading' || contextWaiting) return
      retries = 0
      contextRecovery = false
      pending = true
      retryAt = Date.now()
      deferred = false
      if (available() && online()) begin()
      else sync()
    },
    sync,
    connected() {
      if (pending && !contextWaiting) { retryAt = Date.now(); sync() }
    },
    contextLost() {
      if (disposed || contextWaiting || (state.status !== 'ready' && state.status !== 'loading')) return
      generation++
      contextRecovery = true
      release()
      clearTimeout(retryTimer)
      contextAttempts = contextAttempts.filter((time) => Date.now() - time < 60000)
      if (contextAttempts.length >= 2) {
        pending = false
        publish({ ...state, status: 'error', failure: 'webgl' })
        return
      }
      contextAttempts.push(Date.now())
      contextWaiting = true
      pending = true
      publish({ ...state, status: 'recovering', failure: 'webgl', slow: false })
      contextTimer = setTimeout(() => {
        contextWaiting = false
        retryAt = Date.now()
        sync()
      }, 10000)
    },
    contextRestored() {
      if (!contextWaiting || disposed) return
      clearTimeout(contextTimer)
      contextWaiting = false
      retryAt = Date.now()
      sync()
    },
    get state() { return state },
    get diagnostics() { return [...diagnostics] },
    destroy() {
      disposed = true; generation++; pending = false
      cancelStart?.(); cancelStart = undefined
      clearTimeout(retryTimer); clearTimeout(contextTimer); release()
    },
  }
}
