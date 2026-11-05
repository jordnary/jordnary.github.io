const recentKey = 'home-now-font-ranges:v1'
const MAX_RECENT = 3

function recentRanges(): string[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(recentKey) ?? '[]')
    return Array.isArray(value) ? value.filter((range): range is string => typeof range === 'string'
      && range.length <= 2048 && /^U\+[\dA-F]+(?:-[\dA-F]+)?(?:,\s*U\+[\dA-F]+(?:-[\dA-F]+)?)*$/i.test(range)).slice(0, MAX_RECENT) : []
  } catch { return [] }
}

function commonSlice(face: FontFace) {
  if (face.family !== 'Woodland WenKai') return false
  const points = face.unicodeRange.split(',').reduce((count, range) => {
    const match = /^U\+([\dA-F]+)(?:-([\dA-F]+))?$/i.exec(range.trim())
    return count + (match ? parseInt(match[2] ?? match[1], 16) - parseInt(match[1], 16) + 1 : Infinity)
  }, 0)
  return points > 0 && points <= 128
}

/** Store only bounded range identifiers, never article text or remote content. */
export function rememberReaderFonts() {
  const loaded = (event: FontFaceSetLoadEvent) => {
    const ranges = event.fontfaces.filter(face => face.status === 'loaded' && commonSlice(face)).map(face => face.unicodeRange)
    if (!ranges.length) return
    try { sessionStorage.setItem(recentKey, JSON.stringify([...new Set([...ranges, ...recentRanges()])].slice(0, MAX_RECENT))) }
    catch { /* Font loading works when session storage is unavailable. */ }
  }
  document.fonts.addEventListener('loadingdone', loaded)
  return () => document.fonts.removeEventListener('loadingdone', loaded)
}

/** Preserve the reader lead-in, without requesting the former 1.58 MiB base. */
export function prepareReaderFonts() {
  void document.fonts.load('18px "Woodland WenKai"', '林间手记').catch(() => {})
  void document.fonts.load('48px "Woodland Display"', 'NOW & NOTES').catch(() => {})
  // A reload should not add a font waterfall for characters already read.
  // Only common slices (at most 48 KiB each) qualify; extended slices stay on demand.
  const recent = new Set(recentRanges())
  for (const face of document.fonts) {
    if (commonSlice(face) && recent.has(face.unicodeRange)) void face.load().catch(() => {})
  }
}
