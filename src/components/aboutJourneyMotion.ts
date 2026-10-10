type Pose = { opacity?: string; transform?: string; height?: string }
type Timing = { delay: number; duration: number; easing?: string }
type Layer = {
  element: HTMLElement
  hidden: Pose
  visible: Pose
  enter: Timing
  exit: Timing
}

/** Reverse from the rendered pose and keep at most one cancellable exit pending. */
export function createChapterMotion(chapter: HTMLElement) {
  const layers: Layer[] = []
  let animations: Animation[] = []
  let reached = false
  let pendingExit: ReturnType<typeof setTimeout> | undefined
  const add = (selector: string, hidden: Pose, visible: Pose, enter: Timing, exit: Timing) => {
    chapter.querySelectorAll<HTMLElement>(selector).forEach(element => {
      layers.push({ element, hidden, visible, enter, exit })
    })
  }
  const rise = { transform: 'translateY(8px)' }
  const settled = { transform: 'translateY(0)' }
  const enter: Timing = { delay: 36, duration: 630, easing: 'ease-in-out' }
  const exit: Timing = { delay: 0, duration: 540, easing: 'ease-in-out' }
  // Stagger starts, but give every layer the same finish time in each direction.
  const finishWith = (timing: Timing, delay: number): Timing => ({
    ...timing, delay, duration: timing.delay + timing.duration - delay,
  })
  add('.journey-node', { opacity: '0' }, { opacity: '1' },
    { delay: 0, duration: 0 }, { delay: exit.duration, duration: 0 })
  // Keep the line visible while its actual height changes from the fixed node.
  // Fading at the same time made most of the length change difficult to see.
  add('.journey-rail', { height: '0px' }, { height: 'calc(100% + 14px - 1.25rem)' },
    enter, exit)
  add('.journey-card',
    { opacity: '0', transform: 'translateY(12px) rotate(var(--card-rotation)) scale(0.88)' },
    { opacity: '1', transform: 'translateY(0) rotate(var(--card-rotation)) scale(1)' },
    enter, exit)
  add('.journey-card-heading', rise, settled, finishWith(enter, 81), exit)
  add('.journey-card h2', rise, settled, finishWith(enter, 99), exit)
  add('.journey-card-copy', rise, settled, finishWith(enter, 117), exit)
  add('.journey-card-tags', rise, settled, finishWith(enter, 135), exit)
  const reels = Array.from(chapter.querySelectorAll<HTMLElement>('.journey-digit-reel'))
  reels.forEach((element, index) => {
    // Percentages use the reel's real height, so zoom and font changes cannot misalign digits.
    const steps = element.children.length
    layers.push({
      element,
      hidden: { transform: 'translateY(0)' },
      visible: { transform: `translateY(-${(steps - 1) / steps * 100}%)` },
      enter: finishWith(enter, Math.min(81 + index * 54, 270)),
      exit: finishWith(exit, Math.min((reels.length - index - 1) * 45, 180)),
    })
  })

  const cancelExit = () => {
    if (pendingExit === undefined) return
    clearTimeout(pendingExit)
    pendingExit = undefined
  }
  const cancel = () => {
    animations.forEach(animation => animation.cancel())
    animations = []
  }
  const reset = (visible: boolean) => {
    cancelExit()
    cancel()
    reached = visible
    chapter.dataset.reached = String(visible)
    layers.forEach(layer => Object.assign(layer.element.style, visible ? layer.visible : layer.hidden))
  }
  const reveal = (visible: boolean, animate = true) => {
    if (visible) cancelExit()
    // Returning to earlier content must also finish any entrance still in flight.
    if (!animate) {
      if (reached !== visible || animations.length) reset(visible)
      return
    }
    if (reached === visible) return
    // Read every current pose before cancelling or writing any styles.
    const poses = layers.map(({ element, hidden }) => {
      const style = chapter.ownerDocument.defaultView!.getComputedStyle(element)
      return Object.fromEntries(Object.keys(hidden).map(key => [key, style[key as keyof Pose]]))
    })
    cancel()
    reached = visible
    chapter.dataset.reached = String(visible)
    const startTime = chapter.ownerDocument.timeline.currentTime
    animations = layers.map((layer, index) => {
      const target = visible ? layer.visible : layer.hidden
      Object.assign(layer.element.style, target)
      const animation = layer.element.animate([poses[index], target], {
        ...(visible ? layer.enter : layer.exit),
        easing: (visible ? layer.enter : layer.exit).easing ?? 'cubic-bezier(0.22, 0.65, 0.3, 1)',
        fill: 'backwards',
      })
      // A shared timeline origin also keeps the finish frame identical.
      if (startTime !== null) animation.startTime = startTime
      return animation
    })
  }
  const deferExit = (delay: number) => {
    // Additional scroll frames must not restart the waiting period.
    if (!reached || pendingExit !== undefined) return
    pendingExit = setTimeout(() => {
      pendingExit = undefined
      reveal(false)
    }, delay)
  }
  const dispose = () => {
    cancelExit()
    cancel()
    layers.forEach(({ element, hidden }) => {
      Object.keys(hidden).forEach(key => element.style.removeProperty(key))
    })
    delete chapter.dataset.reached
  }
  return { reset, reveal, deferExit, cancelExit, dispose }
}
