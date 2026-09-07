import { Application, Point } from 'pixi.js'
import type { Cubism4InternalModel, Live2DModel as Model } from 'pixi-live2d-display/cubism4'
import { createCompanionHitTest } from '../src/lib/live2d-hit'

// Vite-only inspection page. All picking uses the production code and shipped assets.
const script = document.createElement('script')
script.src = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js'
await new Promise<void>((resolve, reject) => { script.onload = () => resolve(); script.onerror = reject; document.head.append(script) })
const { Live2DModel } = await import('pixi-live2d-display/cubism4')
const canvas = document.querySelector('#model') as HTMLCanvasElement
const app = new Application({ view: canvas, width: 700, height: 540, backgroundAlpha: 0, autoStart: false })
const model = await Live2DModel.from('/live2d/vampire/model.model3.json', { autoInteract: false, autoUpdate: false }) as Model<Cubism4InternalModel>
app.stage.addChild(model)
model.scale.set(0.1)
model.position.set(125, 0)
await model.motion('Idle', 0, 3)
model.update(0)
app.render()
const hit = createCompanionHitTest(app, model, canvas)
const info = document.querySelector('#info')!
const mask = document.createElement('canvas')
mask.style.cssText = 'position:absolute;left:720px;top:38px;width:500px'
document.body.append(mask)
const controls = document.querySelector('#controls')!
const button = (label: string, action: () => void) => {
  const element = document.createElement('button')
  element.textContent = label; element.onclick = action; controls.append(element)
}
app.ticker.add(() => model.update(app.ticker.deltaMS))
for (const group of ['Idle', 'HeadPat', 'Greeting', 'Complete']) {
  button(group, () => { app.start(); void model.motion(group, 0, 3) })
}
button('Freeze', () => app.stop())
button('Head mask', () => hit.drawDebug(mask, 'head'))
button('Body mask', () => hit.drawDebug(mask, 'body'))
canvas.onclick = (event) => {
  const rect = canvas.getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width * app.screen.width
  const y = (event.clientY - rect.top) / rect.height * app.screen.height
  const local = model.toModelPosition(new Point(x, y))
  info.textContent = `Hit: ${hit.hitTest(x, y) ?? 'none'}; model point: ${Math.round(local.x)}, ${Math.round(local.y)}`
}
const checks: string[] = []
// Points annotated from the idle artwork, independently of the hit-test output.
const points = [
  { name: 'head', x: 2050, y: 1800, expected: 'head' },
  { name: 'torso', x: 2000, y: 2350, expected: 'body' },
  { name: 'leg', x: 1550, y: 3300, expected: 'body' },
  { name: 'backdrop', x: 2850, y: 1200, expected: null },
  { name: 'wing', x: 3180, y: 2630, expected: null },
  { name: 'empty', x: 500, y: 700, expected: null },
]
for (const resolution of [1, 1.25, 2]) {
  app.renderer.resolution = resolution
  app.renderer.resize(700, 540)
  for (const scale of [0.065, 0.1]) {
    model.scale.set(scale); app.render()
    for (const point of points) {
      const local = model.internalModel.localTransform.apply(new Point(point.x, point.y))
      const screen = model.worldTransform.apply(local)
      const result = hit.hitTest(screen.x, screen.y)
      checks.push(`${result === point.expected ? 'PASS' : 'FAIL'}: ${point.name}, DPR ${resolution}, scale ${scale}: ${result ?? 'none'}`)
    }
  }
}
app.renderer.resolution = 1
app.renderer.resize(700, 540)
model.scale.set(0.1); app.render()
info.textContent = checks.join('\n')
button('Check motion endings', async () => {
  app.stop()
  const manager = model.internalModel.motionManager
  for (const [group, duration] of [['HeadPat', 10.3], ['Greeting', 7.87], ['Complete', 6.1]] as const) {
    let finished = false
    const finish = () => { finished = true }
    manager.on('motionFinish', finish)
    await model.motion(group, 0, 3)
    for (let frame = 0; frame < (duration + 0.3) * 30; frame++) {
      // Exercise the real Cubism motion and deformation without a wall-clock wait.
      model.elapsedTime += 1000 / 30
      model.internalModel.update(1000 / 30, model.elapsedTime)
    }
    manager.off('motionFinish', finish)
    await Promise.resolve()
    checks.push(`${finished ? 'PASS' : 'FAIL'}: ${group} finishes after one playback`)
  }
  await model.motion('Idle', 0, 3)
  model.update(1); app.render()
  info.textContent = checks.join('\n')
})
