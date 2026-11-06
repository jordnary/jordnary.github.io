import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { launch } from './search-support.mjs'
import { projectIntroductions } from '../src/data/project-introductions.ts'

const baseURL = process.env.PROJECTS_TEST_URL || 'http://127.0.0.1:4196/'
const manifest = JSON.parse(await readFile('src/generated/responsive-images.json', 'utf8'))
const section = projectIntroductions['few-shot-learning'].sections.find(section => section.figures?.length)
const browser = await launch()
try {
  await mkdir('node_modules/.cache/project-media', { recursive: true })
  for (const width of [320, 390, 800, 1024, 1440, 2560]) for (const dpr of [1, 2, 3]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: dpr, reducedMotion: 'reduce' })
    const page = await context.newPage()
    try {
      await page.goto(new URL('projects/few-shot-learning/', baseURL).href)
      for (const kind of ['cover', 'figure']) {
        if (kind === 'figure') await page.goto(new URL(`projects/few-shot-learning/#project-${section.id}`, baseURL).href)
        const target = page.locator(kind === 'cover' ? '.project-reader-cover img' : '.project-introduction-figure img').first()
        await target.scrollIntoViewIfNeeded()
        const data = await target.evaluate(async image => {
          await image.decode()
          return { src: new URL(image.src).pathname.slice(1), selected: new URL(image.currentSrc).pathname.slice(1), width: image.getBoundingClientRect().width }
        })
        const entry = manifest[data.src]
        const actual = entry.variants.find(v => v.file === data.selected)?.width ?? entry.width
        assert.ok(actual >= Math.min(entry.width, data.width * dpr) * .97, `${width}px DPR ${dpr} ${kind}: insufficient display resolution`)
        if (width === 1440 && dpr === 2) await target.screenshot({ path: `node_modules/.cache/project-media/dpr2-${kind}.png` })
      }
      console.log(`PASS: ${width}px DPR ${dpr} cover and figure resolution`)
    } finally { await context.close() }
  }
} finally { await browser.close() }
