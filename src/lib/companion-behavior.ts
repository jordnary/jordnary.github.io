export type CompanionReaction = keyof typeof companionMotions
export type CompanionPhase = 'idle' | 'noticing' | 'responding' | 'recovering'
export type CompanionState = { phase: CompanionPhase; reaction: CompanionReaction | null; text: string }

export const companionMotions = {
  touch_head: { duration: 10300, text: '你当人家还是小孩子吗？……痒痒的，诶，这就结束了？' },
  touch_special: { duration: 5130, text: '诶！笨蛋！色狼！萝莉控！' },
  touch_body: { duration: 7000, text: '对人家来说，夜晚才刚刚开始呢，汝可不许说困了哦？' },
  main_1: { duration: 7870, text: '好无聊……阅读？没办法的啦。' },
  main_2: { duration: 9100, text: '喂喂，我们去做些快乐的事吧。' },
  main_3: { duration: 10170, text: '太平洋风平浪静？不，人家可不这样觉得。' },
  home: { duration: 6070, text: '洗澡！然后进餐！咦，人家的葡萄酒呢？' },
  mail: { duration: 5130, text: '有话想对人家说？那就写封信吧，人家会期待的哦。' },
} as const
export const companionInactivityDelay = 60000
const mainReactions = ['main_1', 'main_2', 'main_3'] as const

type Driver = {
  prepare: (reaction: CompanionReaction) => Promise<boolean>
  play: (reaction: CompanionReaction) => Promise<boolean>
  idle: () => void
  reducedMotion: () => boolean
  change: (state: CompanionState) => void
}

/** One response at a time; suspended scenes discard delayed loads and old replies. */
export function createCompanionBehavior(driver: Driver) {
  let state: CompanionState = { phase: 'idle', reaction: null, text: '' }
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  let autoplay = false
  let inactivityTimer: ReturnType<typeof setTimeout> | undefined
  const scheduleAutoplay = () => {
    clearTimeout(inactivityTimer)
    if (!autoplay || disposed) return
    inactivityTimer = setTimeout(() => {
      if (state.phase === 'idle') request(mainReactions[Math.floor(Math.random() * mainReactions.length)])
      scheduleAutoplay()
    }, companionInactivityDelay)
  }
  const publish = (next: CompanionState) => { state = next; driver.change(next) }
  const clear = () => { clearTimeout(timer); timer = undefined }
  const recover = () => {
    if (disposed || state.phase === 'idle' || state.phase === 'recovering') return
    generation++
    clear()
    driver.idle()
    publish({ ...state, phase: 'recovering', text: '' })
    timer = setTimeout(() => publish({ phase: 'idle', reaction: null, text: '' }), driver.reducedMotion() ? 0 : 450)
  }
  const reset = () => {
    generation++
    clear()
    driver.idle()
    publish({ phase: 'idle', reaction: null, text: '' })
    scheduleAutoplay()
  }
  function request(reaction: CompanionReaction) {
    // Even a repeated character click postpones the next unsolicited response.
    if (reaction.startsWith('touch_')) scheduleAutoplay()
    // Explicit mail activation and character clicks take priority over ambient lines.
    if (!disposed && state.phase !== 'idle' && (reaction === 'mail'
      || (reaction.startsWith('touch_') && state.reaction?.startsWith('main_')))) reset()
    if (disposed || state.phase !== 'idle') return false
    const token = ++generation
    publish({ phase: 'noticing', reaction, text: '' })
    // Bound slow/failed asset loads; a late result cannot restart a cancelled response.
    timer = setTimeout(recover, 8000)
    const quiet = driver.reducedMotion()
    const prepare = quiet ? Promise.resolve(true) : driver.prepare(reaction).catch(() => false)
    void Promise.all([prepare, new Promise<void>((resolve) => setTimeout(resolve, quiet ? 0 : 240))])
      .then(async ([ready]) => {
        if (disposed || token !== generation) return
        clear()
        publish({ phase: 'responding', reaction, text: companionMotions[reaction].text })
        // Text remains useful if a response asset is unavailable.
        timer = setTimeout(recover, quiet || !ready ? 1800 : companionMotions[reaction].duration + 2000)
        if (!quiet && ready) {
          const started = await driver.play(reaction).catch(() => false)
          if (!disposed && token === generation && !started) {
            clear()
            timer = setTimeout(recover, 1800)
          }
        }
      })
    return true
  }
  return {
    get state() { return state },
    request,
    // The scene has already rendered home's first frame before becoming visible.
    // Adopt that playback without an idle reset, asset load or attention delay.
    enter() {
      if (disposed || state.phase !== 'idle') return
      generation++
      clear()
      publish({ phase: 'responding', reaction: 'home', text: companionMotions.home.text })
      timer = setTimeout(recover, companionMotions.home.duration + 2000)
    },
    setAutoplay(enabled: boolean) {
      if (autoplay === enabled) return
      autoplay = enabled
      scheduleAutoplay()
    },
    finish() { if (state.phase === 'responding') recover() },
    reset,
    destroy() { disposed = true; generation++; clear(); clearTimeout(inactivityTimer) },
  }
}
