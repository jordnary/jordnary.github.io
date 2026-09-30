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
const [studio, vaegan, orientation, vae] = await Promise.all([
  asset('public/images/control-deck-bg-1080.webp'),
  asset('public/images/projects/vaegan-comparison.webp'),
  asset('public/images/projects/orientation-results.webp'),
  asset('public/images/projects/vae-grid.webp'),
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
  const posters = projectPosterTemplates({ studio, vaegan, orientation, vae }, styles)
  for (const { file, html } of posters) {
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
