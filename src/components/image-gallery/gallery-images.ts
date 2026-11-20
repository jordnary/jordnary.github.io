import { prepareImage } from '../../lib/page-images'

export type GalleryImageState = {
  status: 'loading' | 'ready' | 'error'
  width?: number
  height?: number
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
    for (const src of this.entries.keys()) {
      if (sources.includes(src)) continue
      this.entries.delete(src)
      changed = true
    }
    if (changed) this.emit()
  }
  clear() { this.selected = undefined; this.fallback = undefined; this.retain([]) }
  retry(src: string) {
    this.entries.delete(src)
    this.request(src, true)
  }
  request(src: string, required = false) {
    const existing = this.entries.get(src)
    if (existing) {
      if (required) existing.promote?.()
      return
    }
    // Keep the retry control available if a full-size original stalls.
    const task = prepareImage({ src }, required ? 'high' : 'low', 8000)
    const entry: GalleryImageState = { status: 'loading' }
    this.entries.set(src, entry)
    const current = () => this.entries.get(src) === entry && entry.status === 'loading'
    const fail = () => {
      if (!current()) return
      entry.status = 'error'
      delete entry.promote
      this.emit()
    }
    entry.promote = task.promote
    void task.promise.then(result => {
      if (!current()) return
      entry.status = 'ready'
      entry.width = result.width
      entry.height = result.height
      delete entry.promote
      this.emit()
    }, fail)
    this.emit()
  }
}
