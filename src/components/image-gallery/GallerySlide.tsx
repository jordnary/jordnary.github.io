import { useCallback, useContext, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { useController, type RenderSlideProps, type SlideImage } from 'yet-another-react-lightbox'
import { GalleryImagesContext } from './useGalleryImages'
import { GalleryIcon } from './GalleryIcon'

function Preview({ src, fallback, originalFallback, alt, style }: { src?: string; fallback?: string; originalFallback: boolean; alt: string; style: CSSProperties }) {
  const [ready, setReady] = useState(false)
  const loaded = useCallback((image: HTMLImageElement | null) => {
    if (!image?.complete || !image.naturalWidth) return
    void image.decode().then(() => { if (image.isConnected) setReady(true) }).catch(() => {})
  }, [])
  return <>
    {src && <img className="yarl__slide_image gallery-preview" src={src} alt={ready ? alt : ''} draggable={false}
      style={{ ...style, ...(!ready ? { position: 'absolute', visibility: 'hidden' } : {}) }}
      ref={loaded} onLoad={event => loaded(event.currentTarget)} />}
    {!ready && fallback && fallback !== src && <img className={`yarl__slide_image ${originalFallback ? 'gallery-original' : 'gallery-preview'}`}
      src={fallback} alt={originalFallback ? '上一张图片（当前图片加载中）' : alt} draggable={false} style={originalFallback ? { maxWidth: '100%', maxHeight: '100%' } : style} />}
  </>
}

export function GallerySlide({ slide, offset, rect, fallback }: RenderSlideProps & { fallback?: string }) {
  const { focus } = useController()
  const images = useContext(GalleryImagesContext)!
  useSyncExternalStore(images.subscribe, images.getSnapshot)
  const image = slide as SlideImage
  const state = images.get(image.src)
  const current = offset === 0
  const ready = state?.status === 'ready'
  const width = image.width ?? state?.width
  const height = image.height ?? state?.height
  const scale = width && height ? Math.min(1, rect.width / width, rect.height / height) : undefined
  const style: CSSProperties = scale && width && height
    ? { width: width * scale, height: height * scale }
    : { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }
  const preview = image.thumbnail && image.thumbnail !== image.src ? image.thumbnail : undefined
  const originalFallback = Boolean(current && images.fallback && images.get(images.fallback)?.status === 'ready')
  return <>
    {ready ? <img className="yarl__slide_image gallery-original" src={image.src} alt={image.alt ?? ''} draggable={false} style={style} />
      : <Preview key={preview} src={preview} fallback={originalFallback ? images.fallback : fallback} originalFallback={originalFallback} alt={image.alt ?? ''} style={style} />}
    {current && !ready && <div className="gallery-image-status" role="status" aria-live="polite"
      onPointerDown={event => event.stopPropagation()} onPointerMove={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}>
      {state?.status === 'error'
        ? <div className="gallery-error"><GalleryIcon name="error" /><p>图片暂时未能加载</p>
          <button className="yarl__button" type="button" onClick={() => { focus(); images.retry(image.src) }}>重试原图</button></div>
        : <span>正在加载原图…</span>}
    </div>}
  </>
}
