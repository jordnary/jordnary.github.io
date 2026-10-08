import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { test } from 'node:test'
import { imageSize } from 'image-size'
import { projects } from '../src/data/projects.ts'
import { projectIntroductions } from '../src/data/project-introductions.ts'

test('project images have valid local references, intrinsic dimensions and no embedded metadata', async () => {
  const files = new Set()
  for (const project of projects) {
    const cover = project.image?.cover ?? project.image
    assert.ok(cover, `${project.id}: missing cover`)
    assert.equal(cover.width, 1600)
    assert.equal(cover.height, 1000)
    const figures = projectIntroductions[project.id].sections.flatMap(section => section.figures ?? [])
    if (project.category !== 'Web 应用') assert.ok(figures.length >= 3, `${project.id}: insufficient visual evidence`)
    const images = [cover, project.image, ...figures]
    for (const image of images) {
      assert.match(image.file, /^[a-z0-9-]+\.webp$/)
      assert.ok(image.alt.length > 12 && image.caption.length > 10)
      const data = await readFile(new URL(`../public/images/projects/${image.file}`, import.meta.url))
      const size = imageSize(data)
      assert.equal(size.width, image.width, image.file)
      assert.equal(size.height, image.height, image.file)
      assert.ok(data.length < 500_000, `${image.file}: excessive asset size`)
      assert.equal(data.toString('ascii', 0, 4), 'RIFF')
      assert.equal(data.toString('ascii', 8, 12), 'WEBP')
      for (let offset = 12; offset + 8 <= data.length;) {
        const chunk = data.toString('ascii', offset, offset + 4)
        assert.ok(!['EXIF', 'XMP '].includes(chunk), `${image.file}: embedded metadata`)
        const length = data.readUInt32LE(offset + 4)
        offset += 8 + length + (length % 2)
      }
      files.add(image.file)
    }
  }
  const published = await readdir(new URL('../public/images/projects/', import.meta.url))
  assert.deepEqual([...files].sort(), published.filter(file => file.endsWith('.webp')).sort(), 'Every published image is used by a project')
})

test('published project copy and asset documentation omit local identities and participant IDs', async () => {
  const sources = [JSON.stringify(projects), JSON.stringify(projectIntroductions), await readFile(new URL('../public/images/projects/README.md', import.meta.url), 'utf8')]
  for (const source of sources) {
    assert.ok(!/\b[A-Z]:[\\/]|\/(?:home|Users)\/|\bP00[1-4]\b|conda activate|(?:password|api_key|access_token)\s*[:=]/i.test(source), 'Published content contains a private identifier; inspect locally without logging it')
  }
})
