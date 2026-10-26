import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'

const defaultOutput = new URL('../src/assets/github-avatar.webp', import.meta.url)

export async function syncGitHubAvatar({
  avatarUrl,
  outputPath = defaultOutput,
  fetchImpl = fetch,
} = {}) {
  const target = outputPath instanceof URL ? outputPath : pathToFileURL(resolve(outputPath))
  const temporary = new URL(`${target.href}.tmp`)
  const previous = await readFile(target).catch(error => {
    if (error.code === 'ENOENT') return null
    throw error
  })

  try {
    if (!avatarUrl || !/^https:\/\/avatars\.githubusercontent\.com\//.test(avatarUrl)) {
      throw new Error('No valid GitHub avatar URL is available')
    }
    const url = new URL(avatarUrl)
    url.searchParams.set('s', '256')
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new Error(`Avatar request failed (${response.status})`)
    const image = await sharp(Buffer.from(await response.arrayBuffer()), { limitInputPixels: 16777216 })
      .rotate()
      .resize(256, 256, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 90, effort: 6 })
      .toBuffer()

    // Compare image content: GitHub can change an avatar without changing its URL.
    if (previous?.equals(image)) return { status: 'unchanged', bytes: image.length }
    await mkdir(dirname(fileURLToPath(target)), { recursive: true })
    await writeFile(temporary, image)
    await rename(temporary, target)
    return { status: 'updated', bytes: image.length }
  } catch {
    if (previous) return { status: 'retained', bytes: previous.length }
    throw new Error('GitHub avatar sync failed and no local avatar is available.')
  } finally {
    await rm(temporary, { force: true })
  }
}
