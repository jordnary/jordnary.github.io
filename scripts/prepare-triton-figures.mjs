import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Accept a source repository at runtime; never persist its local location.
const source = process.argv[2]
if (!source) throw new Error('Usage: node scripts/prepare-triton-figures.mjs <source-repository>')
const figures = [
  ['t2i_attention_prompt000.jpg', 'triton-backends.webp'],
  ['t2i_backend_timing_bar.png', 'triton-timing.webp'],
  ['t2i_topk_timing_curve.png', 'triton-topk-timing.webp'],
  ['sparse_topk_prompt001.jpg', 'triton-sparsity.webp'],
  ['sparse_int8_long_seq_speedup.png', 'triton-long-sequence.webp'],
]
const { chromium } = await import('playwright').catch(
  () => import('../node_modules/.companion-tools/node_modules/playwright/index.mjs'),
)
const browser = await chromium.launch(process.env.PROJECTS_BROWSER_EXECUTABLE
  ? { executablePath: process.env.PROJECTS_BROWSER_EXECUTABLE, headless: true }
  : { channel: process.env.PROJECTS_BROWSER_CHANNEL || 'msedge', headless: true })
try {
  const page = await browser.newPage()
  await page.route(/^https?:/, route => route.abort())
  for (const [input, output] of figures) {
    const bytes = await readFile(join(source, 'pic', input))
    const mime = input.endsWith('.jpg') ? 'image/jpeg' : 'image/png'
    const result = await page.evaluate(async ({ data, mime }) => {
      const image = new Image()
      image.src = `data:${mime};base64,${data}`
      await image.decode()
      const scale = Math.min(1, 2000 / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(image.width * scale)
      canvas.height = Math.round(image.height * scale)
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
      return { data: canvas.toDataURL('image/webp', 0.92).split(',')[1], width: canvas.width, height: canvas.height }
    }, { data: bytes.toString('base64'), mime })
    await writeFile(new URL(`../public/images/projects/${output}`, import.meta.url), Buffer.from(result.data, 'base64'))
    console.log(`Prepared ${output}: ${result.width} x ${result.height}`)
  }
} finally {
  await browser.close()
}
