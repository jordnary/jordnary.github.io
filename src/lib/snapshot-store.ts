export const SNAPSHOT_FRESH_MS = 5 * 60 * 1000
export const SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const futureToleranceMs = 5 * 60 * 1000

export type SnapshotState<T> = {
  data: T | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  stale: boolean
}
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
type SnapshotOptions<T> = {
  key: string
  url: string
  validate: (value: unknown) => value is T
  sourceTime: (value: T) => string
  legacyKey?: string
  now?: () => number
  storage?: () => Storage
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

/** One bounded JSON value and one shared request per source; no polling. */
export function createSnapshotStore<T>(options: SnapshotOptions<T>) {
  const now = options.now ?? Date.now
  const storage = options.storage ?? (() => window.localStorage)
  const listeners = new Set<() => void>()
  let state: SnapshotState<T> = { data: null, status: 'idle', stale: true }
  let hydrated = false
  let checkedAt = -Infinity
  let pending: Promise<boolean> | null = null
  const usable = (value: unknown): value is T => {
    if (!options.validate(value)) return false
    const age = now() - Date.parse(options.sourceTime(value))
    return Number.isFinite(age) && age >= -futureToleranceMs && age <= SNAPSHOT_MAX_AGE_MS
  }
  const publish = (next: SnapshotState<T>) => {
    state = next
    listeners.forEach(listener => listener())
  }
  const hydrate = () => {
    if (hydrated) return
    hydrated = true
    try {
      const record = JSON.parse(storage().getItem(options.key) ?? 'null')
      if (record?.version === 1 && usable(record.data) && record.sourceUpdatedAt === options.sourceTime(record.data)) {
        state = { data: record.data, status: 'idle', stale: true }
        return
      }
    } catch { /* Disabled, corrupt or unavailable storage never blocks the network. */ }
    if (options.legacyKey) try {
      const previous: unknown = JSON.parse(storage().getItem(options.legacyKey) ?? 'null')
      if (usable(previous)) state = { data: previous, status: 'idle', stale: true }
    } catch { /* Ignore invalid legacy data; migrate only after a successful check. */ }
  }
  const getSnapshot = () => {
    hydrate()
    if (state.data && !usable(state.data)) state = { data: null, status: state.status === 'loading' ? 'loading' : 'idle', stale: true }
    return state
  }
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }
  const refresh = (force = false): Promise<boolean> => {
    hydrate()
    if (pending) return pending
    const data = usable(state.data) ? state.data : null
    const elapsed = now() - checkedAt
    if (!force && data && state.status === 'ready' && elapsed >= 0 && elapsed < SNAPSHOT_FRESH_MS) return Promise.resolve(true)
    // Assign the shared promise before notifying subscribers or calling fetch.
    pending = Promise.resolve().then(async () => {
      try {
        const response = await (options.fetchImpl ?? fetch)(options.url, {
          cache: 'no-cache', signal: AbortSignal.timeout(options.timeoutMs ?? 10000),
        })
        if (!response.ok) throw new Error('Snapshot request failed')
        const value: unknown = await response.json()
        if (!usable(value)) throw new Error('Invalid or expired snapshot')
        if (data && Date.parse(options.sourceTime(value)) < Date.parse(options.sourceTime(data))) throw new Error('Older snapshot')
        checkedAt = now()
        try {
          storage().setItem(options.key, JSON.stringify({ version: 1, sourceUpdatedAt: options.sourceTime(value), data: value }))
          if (options.legacyKey) storage().removeItem(options.legacyKey)
        } catch { /* A successful network value remains usable in memory. */ }
        publish({ data: value, status: 'ready', stale: false })
        return true
      } catch {
        publish({ data: usable(data) ? data : null, status: 'error', stale: true })
        return false
      } finally { pending = null }
    })
    publish({ data, status: 'loading', stale: true })
    return pending
  }
  return { getSnapshot, subscribe, refresh }
}

export type SnapshotStore<T> = ReturnType<typeof createSnapshotStore<T>>
