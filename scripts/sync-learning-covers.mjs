import { mkdir, writeFile } from 'node:fs/promises'
import { imageSize } from 'image-size'
import { learningPhotos } from '../src/data/note-covers.ts'

// Explicit maintenance command; builds and page views use the committed files.
await mkdir('public/images/learning', { recursive: true })
let bytes = 0
for (const photo of Object.values(learningPhotos)) {
  const url = new URL(photo.download)
  url.search = new URLSearchParams({ w: '960', h: '1280', fit: 'crop', crop: 'entropy', fm: 'webp', q: '78' }).toString()
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) })
  if (!response.ok) throw new Error(`Photo download failed: ${photo.file} (${response.status})`)
  const buffer = Buffer.from(await response.arrayBuffer())
  const dimensions = imageSize(buffer)
  if (dimensions.type !== 'webp' || dimensions.width !== 960 || dimensions.height !== 1280) {
    throw new Error(`Unexpected image format or dimensions: ${photo.file}`)
  }
  await writeFile(`public/images/learning/${photo.file}`, buffer)
  bytes += buffer.length
  console.log(`${photo.file}: ${Math.round(buffer.length / 1024)} KB`)
}
console.log(`Saved ${Object.keys(learningPhotos).length} local covers: ${Math.round(bytes / 1024)} KB total`)
