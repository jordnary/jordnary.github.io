import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { projectPosterTemplates } from './project-posters/templates.mjs'

const root = new URL('../', import.meta.url)
const styles = await readFile(
  new URL('./project-posters/styles.css', import.meta.url),
  'utf8',
)
const asset = async (file) =>
  `data:image/webp;base64,${(await readFile(new URL(file, root))).toString('base64')}`
const [studio, vae, gaussian, colorfit] = await Promise.all([
  asset('public/images/control-deck-bg-1080.webp'),
  asset('public/images/projects/vae-grid.webp'),
  asset('public/images/projects/gaussian-initializers.webp'),
  asset('public/images/projects/colorfit-comparison.webp'),
])
const { chromium } = await import('playwright').catch(
  () => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'),
)
const browser = await chromium.launch(
  process.env.PROJECTS_BROWSER_EXECUTABLE
    ? { executablePath: process.env.PROJECTS_BROWSER_EXECUTABLE, headless: true }
    : { channel: process.env.PROJECTS_BROWSER_CHANNEL || 'msedge', headless: true },
)
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
  })
  // Poster rendering uses only embedded local assets and installed fonts.
  await page.route(/^https?:/, (route) => route.abort())
  // Reuse reviewed figure pixels for the decorative crops; full figures stay intact.
  const crops = await page.evaluate(async (sources) => {
    const crop = async (source, regions, width, height) => {
      const image = new Image()
      image.src = source
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      for (const { from, to } of regions) context.drawImage(image, ...from, ...to)
      return canvas.toDataURL('image/webp', 0.86)
    }
    return {
      gaussian: await crop(sources.gaussian, [
        { from: [94, 146, 176, 354], to: [0, 0, 320, 640] },
        { from: [756, 146, 177, 354], to: [320, 0, 320, 640] },
      ], 640, 640),
      colorBefore: await crop(sources.colorfit, [
        { from: [14, 103, 552, 382], to: [0, 0, 828, 573] },
      ], 828, 573),
      colorAfter: await crop(sources.colorfit, [
        { from: [1174, 103, 552, 382], to: [0, 0, 828, 573] },
      ], 828, 573),
      vae: await crop(sources.vae, [
        { from: [98, 37, 900, 970], to: [0, 0, 680, 734] },
      ], 680, 734),
    }
  }, { gaussian, colorfit, vae })
  const posters = projectPosterTemplates({ studio, ...crops }, styles)
  const requested = new Set(process.argv.slice(2))
  for (const { file, html } of posters.filter(poster => !requested.size || requested.has(poster.file))) {
    await page.setContent(html)
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all([...document.images].map((image) => image.decode()))
    })
    const png = await page.screenshot({ type: 'png' })
    const webp = await page.evaluate(
      async (base64) => {
        const image = new Image()
        image.src = `data:image/png;base64,${base64}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        canvas.getContext('2d').drawImage(image, 0, 0)
        return canvas.toDataURL('image/webp', 0.92).split(',')[1]
      },
      png.toString('base64'),
    )
    const output = Buffer.from(webp, 'base64')
    await writeFile(fileURLToPath(new URL(`public/images/projects/${file}`, root)), output)
    console.log(`Rendered ${file}: 1600 x 1000, ${Math.round(output.length / 1024)} KiB`)
  }
} finally {
  await browser.close()
}
