export type GalleryImageState = {
  status: 'loading' | 'ready' | 'error'
  width?: number
  height?: number
  cancel?: () => void
  promote?: () => void
}

export const GALLERY_IMAGE_TIMEOUT = 8000

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
    const image = new Image()
    image.decoding = 'async'
    image.fetchPriority = required ? 'high' : 'low'
    const entry: GalleryImageState = { status: 'loading' }
    this.entries.set(src, entry)
    const current = () => this.entries.get(src) === entry && entry.status === 'loading'
    const detach = () => {
      clearTimeout(timer)
      image.onload = null
      image.onerror = null
      delete entry.cancel
      delete entry.promote
    }
    const fail = () => {
      if (!current()) return
      entry.status = 'error'
      detach()
      image.removeAttribute('src')
      this.emit()
    }
    const timer = window.setTimeout(fail, GALLERY_IMAGE_TIMEOUT)
    entry.cancel = () => { detach(); image.removeAttribute('src') }
    entry.promote = () => { image.fetchPriority = 'high' }
    image.onerror = fail
    image.onload = async () => {
      try { await image.decode() } catch { fail(); return }
      if (!current()) return
      entry.status = 'ready'
      entry.width = image.naturalWidth
      entry.height = image.naturalHeight
      detach()
      this.emit()
    }
    image.src = src
    this.emit()
  }
}
