import { useEffect, useSyncExternalStore } from 'react'
import type { SnapshotStore } from './snapshot-store'

export function useSnapshot<T>(store: SnapshotStore<T>) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  useEffect(() => {
    const check = () => { if (!document.hidden) void store.refresh() }
    check()
    document.addEventListener('visibilitychange', check)
    window.addEventListener('online', check)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('online', check)
      // The bounded request belongs to the store, including other consumers.
    }
  }, [store])
  return state
}
