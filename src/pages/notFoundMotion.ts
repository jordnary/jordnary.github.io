import Matter from 'matter-js'

const { Bodies, Body, Composite, Engine, Sleeping, Vertices } = Matter
const rad = Math.PI / 180
const physicsStep = 1000 / 120

// Keep the drawing and its collision surfaces in the same glyph coordinates.
// The four has four convex strokes; its crossbar and toe
// can each catch the floor or another digit.
export const four = 'M4 -362H119V0H199V102H119V243H3V102H-255V-10ZM0 -204V0H-155Z'
export const zero = 'M0 -315C146 -315 223 -211 223 0S146 315 0 315S-223 211 -223 0S-146 -315 0 -315ZM0 -213C73 -213 100 -157 100 0S73 213 0 213S-100 157 -100 0S-73 -213 0 -213Z'

function polygon(points: number[][]) {
  const vertices = points.map(([x, y]) => ({ x, y }))
  return Body.create({ vertices, position: Vertices.centre(vertices) })
}

function makeFour() {
  return Body.create({ parts: [
    polygon([[4, -362], [119, -362], [119, 0], [0, 0], [0, -204]]),
    polygon([[4, -362], [0, -204], [-155, 0], [-255, 0], [-255, -10]]),
    Bodies.rectangle(-28, 51, 454, 102), Bodies.rectangle(61, 172.5, 116, 141),
  ] })
}

function makeZero() {
  // Sample the outer Bézier, including the flat shoulders that let it settle
  // on its side. The enclosed counter doesn't take part in external contacts.
  const quarter = Array.from({ length: 11 }, (_, i) => {
    const t = i / 10, u = 1 - t
    return { x: 3*u*u*t*146 + 3*u*t*t*223 + t*t*t*223,
      y: -315*(u*u*u + 3*u*u*t) - 211*3*u*t*t }
  })
  const vertices = [quarter, quarter.toReversed().map(p => ({ x: p.x, y: -p.y })),
    quarter.map(p => ({ x: -p.x, y: -p.y })), quarter.toReversed().map(p => ({ x: -p.x, y: p.y }))]
    .flatMap(arc => arc.slice(0, -1))
  return Body.create({ vertices, density: .0007 })
}

function createDigitScene(width: number, height: number) {
  // Pick the glyph size on entry. A resize moves the edges of the world,
  // not the digits: a fast edge can pass one and leave it without a floor.
  const scale = Math.min(height / 1340, width / 1520)
  let w = width / scale, h = height / scale
  const engine = Engine.create({ enableSleeping: true, positionIterations: 8,
    gravity: { x: 0, y: 1, scale: .0006432 } })
  const edge = 48, above = 1800
  const wall = { isStatic: true, friction: .45 }
  const floor = Bodies.rectangle(w / 2, h + edge / 2, w, edge, wall)
  const left = Bodies.rectangle(-edge / 2, (h - above) / 2, edge, h + above, wall)
  const right = Bodies.rectangle(w + edge / 2, (h - above) / 2, edge, h + above, wall)
  let movingEdges = false
  // The top four overhangs the zero to the left; the bottom four catches it
  // on the right. Only release conditions are chosen, never landing slots.
  const spawnX = w / 2 + Math.min(220, w * .1)
  const digits = [
    { body: makeFour(), x: spawnX - 85, y: -1380, angle: 1 },
    { body: makeZero(), x: spawnX, y: -880, angle: 130 },
    { body: makeFour(), x: spawnX + 45, y: -245, angle: 1 },
  ].map(({ body, x, y, angle }) => {
    const origin = { ...body.position }
    if (body.parts.length > 1) Body.setInertia(body, body.inertia * 1.5)
    body.friction = .19
    body.frictionAir = .008
    body.restitution = .08
    Body.translate(body, { x, y })
    Body.setAngle(body, angle * rad)
    Body.setVelocity(body, { x: 0, y: 4 })
    return { body, origin, escaped: false }
  })
  Composite.add(engine.world, [floor, left, right, ...digits.map(d => d.body)])
  return {
    digits,
    get viewBox() { return `0 0 ${w} ${h}` },
    get asleep() { return digits.every(({ body, escaped }) => escaped || body.isSleeping) },
    step() {
      Engine.update(engine, physicsStep)
      if (movingEdges) {
        Body.setVelocity(floor, { x: 0, y: 0 })
        Body.setVelocity(right, { x: 0, y: 0 })
        movingEdges = false
      }
      for (const digit of digits) {
        if (!digit.escaped && digit.body.bounds.min.y > h + 630) {
          digit.escaped = true
          Composite.remove(engine.world, digit.body)
        }
      }
    },
    resize(width: number, height: number) {
      const nw = width / scale, nh = height / scale
      if (nw === w && nh === h) return
      Body.scale(floor, nw / w, 1)
      Body.setPosition(floor, { x: nw / 2, y: nh + edge / 2 })
      for (const side of [left, right]) {
        Body.scale(side, 1, (nh + above) / (h + above))
        Body.setPosition(side, { x: side === left ? -edge / 2 : nw + edge / 2, y: (nh - above) / 2 })
      }
      // Transfer edge motion to bodies actually in contact for one step.
      // A maximise/restore jump isn't an unbounded launch impulse.
      const impulse = (delta: number) => Math.max(-24, Math.min(24, delta))
      Body.setVelocity(floor, { x: 0, y: impulse(nh - h) })
      Body.setVelocity(right, { x: impulse(nw - w), y: 0 })
      movingEdges = true
      w = nw; h = nh
      digits.forEach(d => { if (!d.escaped) Sleeping.set(d.body, false) })
    },
    dispose() { Composite.clear(engine.world, false); Engine.clear(engine) },
  }
}

export function mountFallingDigits(svg: SVGSVGElement) {
  const paths = svg.querySelectorAll('path')
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  let scene = createDigitScene(svg.clientWidth, svg.clientHeight)
  let frame = 0, last = 0, remainder = 0

  const paint = () => scene.digits.forEach(({ body, origin, escaped }, i) => {
    paths[i].style.visibility = escaped ? 'hidden' : ''
    paths[i].setAttribute('transform', `translate(${body.position.x} ${body.position.y}) rotate(${body.angle / rad}) translate(${-origin.x} ${-origin.y})`)
  })
  const tick = (now: number) => {
    remainder += Math.min(now - last, 64)
    last = now
    while (remainder >= physicsStep && !scene.asleep) { scene.step(); remainder -= physicsStep }
    paint()
    frame = scene.asleep ? 0 : requestAnimationFrame(tick)
  }
  const sync = () => {
    if (motion.matches || document.hidden) {
      cancelAnimationFrame(frame)
      frame = 0
    }
    if (motion.matches) {
      // Resolve the same contacts without displaying motion.
      for (let i = 0; i < 3600 && !scene.asleep; i++) scene.step()
    } else if (!document.hidden && !scene.asleep && !frame) {
      last = performance.now()
      frame = requestAnimationFrame(tick)
    }
    svg.setAttribute('viewBox', scene.viewBox)
    paint()
  }
  const restore = (e: PageTransitionEvent) => {
    if (!e.persisted) return
    scene.dispose()
    scene = createDigitScene(svg.clientWidth, svg.clientHeight)
    remainder = 0
    sync()
  }
  const size = new ResizeObserver(() => {
    if (svg.clientWidth && svg.clientHeight) {
      scene.resize(svg.clientWidth, svg.clientHeight)
      sync()
    }
  })
  sync()
  size.observe(svg)
  window.addEventListener('pageshow', restore)
  document.addEventListener('visibilitychange', sync)
  motion.addEventListener('change', sync)
  return () => {
    size.disconnect()
    window.removeEventListener('pageshow', restore)
    document.removeEventListener('visibilitychange', sync)
    motion.removeEventListener('change', sync)
    cancelAnimationFrame(frame)
    scene.dispose()
  }
}
