const paths = {
  expand: 'M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5',
  collapse: 'M3 8h5V3M21 8h-5V3M16 21v-5h5M8 21v-5H3',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  reset: 'M3 10a9 9 0 1 1 2.5 8M3 4v6h6',
  previous: 'm14 6-6 6 6 6',
  next: 'm10 6 6 6-6 6',
  close: 'm6 6 12 12M6 18 18 6',
  thumbnails: 'M3 4h18v10H3zM3 18h4v3H3zM10 18h4v3h-4zM17 18h4v3h-4z',
  external: 'M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5',
  error: 'M4 4h16v16H4zM8 8l8 8m0-8-8 8',
} as const

export function GalleryIcon({ name }: { name: keyof typeof paths }) {
  return <svg className="gallery-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d={paths[name]} />
  </svg>
}
