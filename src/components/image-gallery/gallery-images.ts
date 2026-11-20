import { preloadImage } from '../../lib/page-images'

export type GalleryImageState = {
  status: 'loading' | 'ready' | 'error'
  width?: number
  height?: number
  pendingImage?: HTMLImageElement
}

/** Keep load status and dimensions for this gallery. The browser owns the image data. */
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
  retry(src: string) {
    // A stalled download continues until the visitor explicitly requests a new attempt.
    this.entries.get(src)?.pendingImage?.removeAttribute('src')
    this.entries.delete(src)
    this.request(src, true)
  }
  request(src: string, required = false) {
    const existing = this.entries.get(src)
    if (existing) {
      if (required && existing.pendingImage) existing.pendingImage.fetchPriority = 'high'
      return
    }
    const image = preloadImage({ src }, required ? 'high' : 'low')
    const entry: GalleryImageState = { status: 'loading', pendingImage: image }
    this.entries.set(src, entry)
    const retryTimer = window.setTimeout(() => {
      entry.status = 'error'
      this.emit()
    }, 8000)
    const finish = (status: 'ready' | 'error') => {
      window.clearTimeout(retryTimer)
      if (this.entries.get(src) !== entry) return
      delete entry.pendingImage
      entry.status = status
      if (status === 'ready') {
        entry.width = image.naturalWidth
        entry.height = image.naturalHeight
      }
      this.emit()
    }
    void image.decode().then(() => finish('ready'), () => finish('error'))
    this.emit()
  }
}
