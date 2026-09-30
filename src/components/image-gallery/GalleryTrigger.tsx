import { GalleryIcon } from './GalleryIcon'
import './GalleryTrigger.css'

/** Place inside a positioned image wrapper; only the button opens the viewer. */
export function GalleryTrigger({ onClick, label = '打开图片浏览器' }: {
  onClick: () => void
  label?: string
}) {
  return <button type="button" className="gallery-trigger" onClick={onClick} aria-label={label} aria-haspopup="dialog" title={label}>
    <GalleryIcon name="expand" />
  </button>
}
