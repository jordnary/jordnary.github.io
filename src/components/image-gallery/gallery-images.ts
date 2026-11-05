import { prepareImage } from '../../lib/page-images'

export type GalleryImageState = {
  status: 'loading' | 'ready' | 'error'
  width?: number
  height?: number
  cancel?: () => void
  promote?: () => void
}

/** Only the viewer's current working set is owned here; bytes stay in HTTP cache. */
export class GalleryImages {
  private entries = new Map<string, GalleryImageState>()
  private listeners = new Set<() => void>()
  private revision = 0
  private selected?: string
  fallback?: string
  getSnapshot = () => this.revision
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  private emit() {
    this.revision++
    this.listeners.forEach(listener => listener())
  }
  get(src: string) { return this.entries.get(src) }
  select(src: string) {
    if (src === this.selected) return
    if (this.selected && this.get(this.selected)?.status === 'ready') this.fallback = this.selected
    this.selected = src
  }
  retain(sources: string[]) {
    let changed = false
    for (const [src, entry] of this.entries) {
      if (sources.includes(src)) continue
      this.entries.delete(src)
      entry.cancel?.()
      changed = true
    }
    if (changed) this.emit()
  }
  clear() { this.selected = undefined; this.fallback = undefined; this.retain([]) }
  retry(src: string) {
    this.entries.get(src)?.cancel?.()
    this.entries.delete(src)
    this.request(src, true)
  }
  request(src: string, required = false) {
    const existing = this.entries.get(src)
    if (existing) {
      if (required) existing.promote?.()
      return
    }
    const task = prepareImage({ src }, required ? 'high' : 'low')
    const entry: GalleryImageState = { status: 'loading' }
    this.entries.set(src, entry)
    const current = () => this.entries.get(src) === entry && entry.status === 'loading'
    const detach = () => {
      task.release()
      delete entry.cancel
      delete entry.promote
    }
    const fail = () => {
      if (!current()) return
      entry.status = 'error'
      detach()
      this.emit()
    }
    entry.cancel = detach
    entry.promote = task.promote
    void task.promise.then(result => {
      if (!current()) return
      entry.status = 'ready'
      entry.width = result.width
      entry.height = result.height
      detach()
      this.emit()
    }, fail)
    this.emit()
  }
}
