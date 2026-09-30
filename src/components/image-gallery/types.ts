export type GalleryImage = {
  src: string
  alt: string
  title?: string
  caption?: string
  thumbnail?: string
  width?: number
  height?: number
  source?: string
}

export type ImageGalleryProps = {
  images: readonly GalleryImage[]
  activeIndex: number | null
  onIndexChange: (index: number) => void
  onClose: () => void
}
