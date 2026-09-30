import './ImageGalleryDialog.css'
import { useEffect, useRef, useState } from 'react'
import { SmartLink } from './SmartLink'

export type GalleryImage = {
  src: string
  alt: string
  title: string
  caption: string
  source?: string
}

type ImageGalleryDialogProps = {
  images: GalleryImage[]
  activeIndex: number | null
  onIndexChange: (index: number) => void
  onClose: () => void
}

/** Native modal semantics provide Escape and focus return; Tab stays in the gallery. */
export function ImageGalleryDialog({
  images,
  activeIndex,
  onIndexChange,
  onClose,
}: ImageGalleryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const currentImage = activeIndex === null ? undefined : images[activeIndex]
  const isOpen = Boolean(currentImage)
  const move = (direction: number) => {
    if (activeIndex !== null && images.length > 1)
      onIndexChange((activeIndex + direction + images.length) % images.length)
  }

  useEffect(() => {
    if (!isOpen) return
    const dialog = dialogRef.current
    const previousOverflow = document.body.style.overflow
    dialog?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  return (
    <dialog
      aria-label={
        currentImage ? `${currentImage.title} 图片预览` : '项目图片预览'
      }
      className="image-gallery-dialog"
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close()
      }}
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Tab') {
          const focusable = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), a[href], [tabindex="0"]',
            ),
          ).filter((element) => element.getClientRects().length > 0)
          const first = focusable[0]
          const last = focusable.at(-1)
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first?.focus()
          }
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault()
          move(event.key === 'ArrowLeft' ? -1 : 1)
        }
      }}
      ref={dialogRef}
    >
      {currentImage && (
        <div className="image-gallery-dialog-content">
          <header>
            <div>
              <p>
                PROJECT GALLERY /{' '}
                {String((activeIndex ?? 0) + 1).padStart(2, '0')}
              </p>
              <h2>{currentImage.title}</h2>
            </div>
            <button
              aria-label="关闭图片预览"
              onClick={() => dialogRef.current?.close()}
              type="button"
              autoFocus
            >
              关闭 <span aria-hidden="true">×</span>
            </button>
          </header>
          <figure>
            <GalleryViewport image={currentImage} />
            <figcaption aria-live="polite">{currentImage.caption}</figcaption>
          </figure>
          <footer>
            {currentImage.source && (
              <SmartLink href={currentImage.source}>
                查看项目来源 <span aria-hidden="true">↗</span>
              </SmartLink>
            )}
            {images.length > 1 && (
              <div className="image-gallery-controls">
                <button
                  aria-label="上一张图片"
                  onClick={() => move(-1)}
                  type="button"
                >
                  ←
                </button>
                <span>
                  {(activeIndex ?? 0) + 1} / {images.length}
                </span>
                <button
                  aria-label="下一张图片"
                  onClick={() => move(1)}
                  type="button"
                >
                  →
                </button>
              </div>
            )}
          </footer>
        </div>
      )}
    </dialog>
  )
}

function GalleryViewport({ image }: { image: GalleryImage }) {
  const [source, setSource] = useState(image.src)
  const [zoom, setZoom] = useState(1)
  const [failed, setFailed] = useState(false)
  if (source !== image.src) {
    setSource(image.src)
    setZoom(1)
    setFailed(false)
  }
  return <>
    <div className="image-gallery-zoom" aria-label="图片缩放">
      <button type="button" aria-label="缩小图片" disabled={zoom === 1} onClick={() => setZoom(value => Math.max(1, value - .5))}>−</button>
      <button type="button" aria-label="重置图片缩放" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
      <button type="button" aria-label="放大图片" disabled={zoom === 3} onClick={() => setZoom(value => Math.min(3, value + .5))}>+</button>
    </div>
    <div className="image-gallery-viewport" tabIndex={0} aria-label="图片预览区域，可滚动查看放大后的图片">
      {failed ? <p role="status">图片暂时未能加载。</p> : <div className="image-gallery-canvas" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
        <img alt={image.alt} src={image.src} onError={() => setFailed(true)} />
      </div>}
    </div>
  </>
}
