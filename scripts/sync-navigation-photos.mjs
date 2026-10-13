import { mkdir, writeFile } from 'node:fs/promises'
import { imageSize } from 'image-size'
import { navigationPhotos } from '../src/data/navigation-photos.ts'

// Run manually; builds and page visits never depend on an external image service.
await mkdir('public/images/navigation', { recursive: true })
await Promise.all(Object.values(navigationPhotos).map(async photo => {
  for (const width of [640, 1920]) {
    const height = width * 5 / 8
    const url = new URL(photo.download)
    url.search = new URLSearchParams({ w: String(width), h: String(height), fit: 'crop', fm: 'webp', q: '86' }).toString()
    const response = await fetch(url, { signal: AbortSignal.timeout(45000) })
    if (!response.ok) throw new Error(`Photo download failed: ${photo.file} (${response.status})`)
    const buffer = Buffer.from(await response.arrayBuffer())
    const dimensions = imageSize(buffer)
    if (dimensions.type !== 'webp' || dimensions.width !== width || dimensions.height !== height) {
      throw new Error(`Unexpected photo format or size: ${photo.file}`)
    }
    const file = `${photo.file}-${width}.webp`
    await writeFile(`public/images/navigation/${file}`, buffer)
    console.log(`${file}: ${width} x ${height}, ${Math.round(buffer.length / 1024)} KB`)
  }
}))
