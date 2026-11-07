import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

// Keep originals for high-density screens and zoom; generate only display-sized copies.
const output = 'public/images/responsive'
await mkdir(output, { recursive: true })
await mkdir('src/generated', { recursive: true })
const manifest = {}
const groups = {
  contact: { widths: [1200], quality: 92, files: /^street-graffiti-cycle\.webp$/ },
  home: { widths: [480, 640, 768, 1024], files: /^(about|learning|projects|contact|now-building|now-following|now-woodland-frame|repository-flourish)\.webp$/ },
  navigation: { widths: [240, 480, 960, 1280], files: /-1920\.webp$/ },
  learning: { widths: [480, 768, 1024, 1440], files: /\.webp$/ },
  'project-studio': { widths: [480, 768, 1024], files: /\.webp$/ },
  projects: { widths: [240, 480, 768, 1024, 1440], files: /\.webp$/ },
}
let generated = 0
const existing = new Set(await readdir(output))
const required = new Set()
for (const [group, { widths, quality = 90, files }] of Object.entries(groups)) {
  for (const file of (await readdir(`public/images/${group}`)).sort().filter(file => files.test(file))) {
    const source = await readFile(`public/images/${group}/${file}`)
    const { width, height } = await sharp(source).metadata()
    const hash = createHash('sha256').update(source).update(JSON.stringify({ widths, quality, sharp: sharp.versions })).digest('hex').slice(0, 12)
    const variants = []
    for (const size of widths.filter(size => size < width)) {
      const name = `${file.replace('.webp', '')}-${hash}-${size}.webp`
      required.add(name)
      if (!existing.has(name)) {
        await sharp(source).resize({ width: size, withoutEnlargement: true })
          .webp({ quality, alphaQuality: 100, effort: 6 }).toFile(`${output}/${name}`)
        generated++
      }
      variants.push({ width: size, file: `images/responsive/${name}` })
    }
    if (group === 'navigation') {
      variants.push({ width: 640, file: `images/navigation/${file.replace('-1920.webp', '-640.webp')}` })
      variants.sort((a, b) => a.width - b.width)
    }
    if (group === 'contact') {
      for (const width of [768, 1536]) variants.push({ width, file: `images/contact/street-graffiti-cycle-${width}.webp` })
      variants.sort((a, b) => a.width - b.width)
    }
    manifest[`images/${group}/${file}`] = { width, height, variants }
  }
}
// Prune only files owned by this generator, never source artwork or other files.
for (const file of existing) {
  if (/^[a-z0-9-]+-[a-f0-9]{12}-\d+\.webp$/.test(file) && !required.has(file)) await unlink(`${output}/${file}`)
}
await writeFile('src/generated/responsive-images.json', `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Responsive images: ${Object.keys(manifest).length} originals, ${generated} copies generated`)
