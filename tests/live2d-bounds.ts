import { Application } from 'pixi.js'
import type { Cubism4InternalModel, Live2DModel as Model } from 'pixi-live2d-display/cubism4'
import { createLive2DScene } from '../src/lib/live2d'
import { companionMotions } from '../src/lib/companion-behavior'

// Verify the shared framing through the real motion; temporary effect overflow
// is intentional and must not trigger resizing, repositioning or camera scaling.
const script = document.createElement('script')
script.src = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js'
await new Promise<void>((resolve, reject) => { script.onload = () => resolve(); script.onerror = reject; document.head.append(script) })
const { Live2DModel } = await import('pixi-live2d-display/cubism4')
const originalRender = Application.prototype.render
const originalMotion = Live2DModel.prototype.motion
const originalDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio')
const captured: { app?: Application; model?: Model<Cubism4InternalModel> } = {}
Application.prototype.render = function () { captured.app = this; return originalRender.call(this) }
Live2DModel.prototype.motion = function (...args) {
  captured.model = this as Model<Cubism4InternalModel>
  return originalMotion.apply(this, args)
}
const container = document.querySelector<HTMLElement>('#fixture')!
const report: string[] = []
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const check = (condition: boolean, label: string) => {
  report.push(`${condition ? 'PASS' : 'FAIL'}: ${label}`)
  document.querySelector('#result')!.textContent = report.join('\n')
  if (!condition) throw new Error(label)
}
let activeScene: Awaited<ReturnType<typeof createLive2DScene>> | undefined
try {
  for (const resolution of [1, 1.5, 2]) {
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: resolution })
    for (const [width, height] of [[240, 336], [192, 220]]) {
      container.style.width = `${width}px`; container.style.height = `${height}px`
      let idle = { scale: 0, x: 0, y: 0 }
      for (const initial of ['idle', 'home']) {
        const canvas = document.createElement('canvas')
        container.replaceChildren(canvas)
        let phase = 'idle'
        activeScene = await createLive2DScene(canvas, container, new AbortController().signal, (state) => { phase = state.phase }, () => true, initial === 'home')
        const app = captured.app!, model = captured.model!
        await delay(30)
        if (initial === 'idle') {
          idle = { scale: model.scale.x, x: model.x, y: model.y }
          activeScene.destroy()
          continue
        }
        const sameFraming = () => Math.abs(model.scale.x - idle.scale) < 0.000001
          && Math.abs(model.x - idle.x) < 0.000001 && Math.abs(model.y - idle.y) < 0.000001
        const sameCanvas = () => app.screen.width === width && app.screen.height === height
          && canvas.width === Math.round(width * resolution) && canvas.height === Math.round(height * resolution)
        check(sameFraming() && sameCanvas(), `${width}x${height}, DPR ${resolution}: home starts at the original idle scale, position and canvas size`)
        let unchanged = true
        for (let frame = 0; frame <= Math.floor(companionMotions.home.duration / 1000 * 30); frame++) {
          if (frame) model.update(1000 / 30)
          app.render()
          unchanged &&= sameFraming() && sameCanvas()
          if (resolution === 1 && width === 240 && [0, 42, 90, 180].includes(frame)) {
            const preview = document.createElement('canvas')
            preview.width = width; preview.height = height
            preview.getContext('2d')!.drawImage(canvas, 0, 0, width, height)
            const figure = document.createElement('figure')
            const caption = document.createElement('figcaption')
            caption.textContent = `home at ${(frame / 30).toFixed(1)}s`
            figure.append(preview, caption)
            document.querySelector('#previews')!.append(figure)
          }
          if (frame % 30 === 0) await delay(0)
        }
        check(unchanged, `${width}x${height}, DPR ${resolution}: all 183 home frames retain the same framing`)
        activeScene.pause(false)
        const deadline = performance.now() + 2500
        while (phase !== 'idle' && performance.now() < deadline) await delay(50)
        check(phase === 'idle' && sameFraming() && sameCanvas(), `${width}x${height}, DPR ${resolution}: home joins idle without any scaling or layout change`)
        activeScene.destroy()
      }
    }
  }
  document.querySelector('#result')!.textContent = `${report.length} checks passed\n${report.join('\n')}`
} catch (error) {
  document.querySelector('#result')!.textContent = `${report.join('\n')}\nFailed: ${error instanceof Error ? error.message : 'Framing regression failed'}`
} finally {
  activeScene?.destroy()
  Application.prototype.render = originalRender
  Live2DModel.prototype.motion = originalMotion
  if (originalDpr) Object.defineProperty(window, 'devicePixelRatio', originalDpr)
  else Reflect.deleteProperty(window, 'devicePixelRatio')
}
