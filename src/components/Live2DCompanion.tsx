import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import type { Live2DScene } from '../lib/live2d'
import type { CompanionReaction, CompanionState } from '../lib/companion-behavior'
import type { CompanionHit } from '../lib/live2d-hit'
import { githubProfileUrl } from '../lib/github'
import { contactProfile } from '../data/contact'
import { companionIntroductions } from '../data/companion-introductions'
import type { SitePage } from '../lib/routes'
import { CompanionTools, type CompanionAction } from './CompanionTools'
import { ContactIcon } from './icons'
import './Live2DCompanion.css'

const compactQuery = '(max-width: 767px), (pointer: coarse), (hover: none)'
const desktopCollapseKey = 'site-live2d-collapsed-desktop'
const mobileCollapseKey = 'site-live2d-collapsed-mobile'
const chatPreferenceKey = 'site-live2d-chat-enabled'
// Navigation uses tabindex="-1" to focus main; its content still allows character clicks.
// Native and ARIA controls retain priority even when removed from the tab order.
const interactiveSelector = 'a, button, input, textarea, select, label, summary, [role="button"], [role="link"], [role="menuitem"], [role="checkbox"], [role="switch"], [role="slider"], [tabindex]:not([tabindex="-1"]), [contenteditable]:not([contenteditable="false"])'
const noActions: readonly CompanionAction[] = []

function subscribeCompact(callback: () => void) {
  const query = window.matchMedia(compactQuery)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

function readPreference(key: string, fallback = false, storage: 'localStorage' | 'sessionStorage' = 'localStorage') {
  try {
    const stored = window[storage].getItem(key)
    return stored === null ? fallback : stored === 'true'
  } catch {
    return fallback
  }
}

type CompanionProps = {
  suspended: boolean
  page?: SitePage
  actions?: readonly CompanionAction[]
}

export function Live2DCompanion({ suspended, page, actions = noActions }: CompanionProps) {
  const compact = useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(compactQuery).matches,
    () => true,
  )
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => readPreference(desktopCollapseKey, false, 'sessionStorage'))
  const [mobileCollapsed, setMobileCollapsed] = useState(() => readPreference(mobileCollapseKey, true, 'sessionStorage'))
  const collapsed = compact ? mobileCollapsed : desktopCollapsed
  const [chatEnabled, setChatEnabled] = useState(() => readPreference(chatPreferenceKey, true))
  const [restoreFocus, setRestoreFocus] = useState(false)
  const [homeRequested, setHomeRequested] = useState(false)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const introducedPageRef = useRef<SitePage | undefined>(undefined)

  useEffect(() => {
    // Consume visits while collapsed so expanding never replays their introduction.
    if (collapsed) introducedPageRef.current = page
  }, [collapsed, page])

  useEffect(() => {
    if (collapsed && restoreFocus) launcherRef.current?.focus({ preventScroll: true })
  }, [collapsed, restoreFocus])

  const toggle = (event?: { detail: number }) => {
    // Only keyboard activation transfers focus; touch must not pin the tool rail open.
    setRestoreFocus(event?.detail === 0)
    setHomeRequested(collapsed)
    if (compact) {
      setMobileCollapsed(!collapsed)
    } else {
      setDesktopCollapsed(!collapsed)
    }
    try {
      sessionStorage.setItem(compact ? mobileCollapseKey : desktopCollapseKey, String(!collapsed))
    } catch { /* Storage is optional, including in private browsing. */ }
  }

  const toggleChat = () => {
    setChatEnabled(!chatEnabled)
    try {
      localStorage.setItem(chatPreferenceKey, String(!chatEnabled))
    } catch { /* Storage is optional, including in private browsing. */ }
  }

  return (
    <aside aria-label="网站看板娘" className={`live2d-companion${collapsed ? ' is-collapsed' : ''}`} hidden={suspended}>
      {!collapsed ? (
        <CompanionStage page={page} introducedPageRef={introducedPageRef} actions={actions} chatEnabled={chatEnabled} focusOnReady={restoreFocus} homeRequested={homeRequested} onHomePrepared={() => setHomeRequested(false)} onCollapse={toggle} onToggleChat={toggleChat} suspended={suspended} />
      ) : (
        <button
          aria-expanded="false"
          aria-label="展开看板娘"
          className="live2d-launcher"
          onClick={toggle}
          ref={launcherRef}
          title="展开看板娘"
          type="button"
        >
          <CompanionIcon />
        </button>
      )}
    </aside>
  )
}

function CompanionStage({ onCollapse, suspended, page, introducedPageRef, actions, focusOnReady, homeRequested, onHomePrepared, chatEnabled, onToggleChat }: CompanionProps & {
  introducedPageRef: RefObject<SitePage | undefined>
  onCollapse: () => void
  focusOnReady: boolean
  homeRequested: boolean
  onHomePrepared: () => void
  chatEnabled: boolean
  onToggleChat: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Live2DScene | null>(null)
  const suspendedRef = useRef(suspended)
  const entranceRef = useRef(homeRequested)
  const homePrepared = useEffectEvent(onHomePrepared)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [interaction, setInteraction] = useState<CompanionState>({ phase: 'idle', reaction: null, text: '' })
  const [hovered, setHovered] = useState(false)

  const talk = (reaction: CompanionReaction = 'touch_body') => {
    if (status !== 'ready' || suspended || (!chatEnabled && reaction !== 'mail') || document.hidden || document.querySelector('.toast')) return
    sceneRef.current?.react(reaction)
  }
  const talkFromPointer = useEffectEvent(talk)

  useEffect(() => {
    if (status === 'ready') sceneRef.current?.setChatEnabled(chatEnabled)
  }, [status, chatEnabled])

  useEffect(() => {
    suspendedRef.current = suspended
    sceneRef.current?.pause(document.hidden || suspended || !!document.querySelector('.toast'))
  }, [suspended])

  useEffect(() => {
    if (!page || introducedPageRef.current === page) return
    const available = chatEnabled && !suspended && !document.hidden && !document.querySelector('.toast')
    // Initial loading may finish the current visit; unavailable visits are discarded.
    if (available && status === 'loading') return
    introducedPageRef.current = page
    if (available && status === 'ready') sceneRef.current?.introduce(companionIntroductions[page])
  }, [page, status, chatEnabled, suspended, introducedPageRef])

  const discardIntroduction = useEffectEvent(() => { introducedPageRef.current = page })

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const controller = new AbortController()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const compactMedia = window.matchMedia(compactQuery)
    let hideTimer = 0
    let touchTimer = 0
    let hoverTimer = 0
    let lastHitTime = 0
    let press: { x: number; y: number; pointerId: number; hit: CompanionHit } | null = null

    const available = () => !document.hidden && !suspendedRef.current && !document.querySelector('.toast')
    const hover = (active: boolean, timed = compactMedia.matches) => {
      window.clearTimeout(touchTimer)
      if (active) {
        window.clearTimeout(hideTimer)
        hideTimer = 0
        setHovered(true)
        if (timed) touchTimer = window.setTimeout(() => setHovered(false), 3000)
      } else if (!hideTimer) {
        // Smooth brief exits from the shared character and toolbar hover area.
        hideTimer = window.setTimeout(() => {
          setHovered(false)
          hideTimer = 0
        }, 240)
      }
    }
    const hitModel = (event: MouseEvent) => {
      const target = event.target
      if (!available() || !(target instanceof Element)) return null
      if (target.closest(interactiveSelector) || window.getSelection()?.toString()) return null
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null
      // Pixi's auto-density canvas may round CSS dimensions at fractional DPR.
      return sceneRef.current?.hitTest(
        x / rect.width * Number.parseFloat(canvas.style.width),
        y / rect.height * Number.parseFloat(canvas.style.height),
      ) ?? null
    }
    const inHoverArea = (event: PointerEvent) => {
      if (!sceneRef.current) return false
      if (event.target instanceof Element && event.target.closest('.live2d-tools')) return true
      // Include gaps around the artwork and tools, excluding the bubble and
      // the canvas's unused space above the model. Clicks still use hitModel.
      const rect = canvas.getBoundingClientRect()
      const artworkTop = Number.parseFloat(container.parentElement?.style.getPropertyValue('--companion-artwork-top') ?? '') || 0
      const hoverTop = rect.top + Math.max(0, artworkTop - 8)
      return event.clientX >= rect.left && event.clientX < rect.right
        && event.clientY >= hoverTop && event.clientY < rect.bottom
    }
    const resetFocus = () => {
      sceneRef.current?.focus(0, 0)
      press = null
      window.clearTimeout(hoverTimer)
      hover(false)
    }
    const syncVisibility = () => {
      sceneRef.current?.pause(!available())
      if (!available()) {
        discardIntroduction()
        resetFocus()
      }
    }
    const pointerLeave = (event: PointerEvent) => {
      // Touch emits pointerleave on release; retain its inactivity timeout.
      if (event.pointerType === 'mouse') resetFocus()
    }
    const pointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !available()) return
      if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) press = null
      sceneRef.current?.focus(
        (event.clientX / window.innerWidth) * 2 - 1,
        1 - (event.clientY / window.innerHeight) * 2,
      )
      window.clearTimeout(hoverTimer)
      hoverTimer = window.setTimeout(() => {
        lastHitTime = performance.now()
        hover(available() && inHoverArea(event))
      }, Math.max(0, 50 - (performance.now() - lastHitTime)))
    }
    const startPress = (event: PointerEvent) => {
      const eligible = event.isPrimary && event.pointerType === 'mouse' && event.button === 0
        && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && !event.defaultPrevented
      const hit = eligible ? hitModel(event) : null
      press = hit
        ? { x: event.clientX, y: event.clientY, pointerId: event.pointerId, hit }
        : null
    }
    const touchTools = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || !event.isPrimary || !available()) return
      const target = event.target
      const inTools = target instanceof Element && !!target.closest('.live2d-tools')
      const pageControl = target instanceof Element && !!target.closest(interactiveSelector)
      hover(inTools || (!pageControl && inHoverArea(event)), true)
    }
    const clickModel = (event: MouseEvent) => {
      const started = press
      press = null
      if (!started || event.button !== 0 || event.detail !== 1 || event.defaultPrevented
        || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      if (event instanceof PointerEvent && event.pointerId !== started.pointerId) return
      if (Math.hypot(event.clientX - started.x, event.clientY - started.y) > 6) return
      if (hitModel(event) === started.hit) {
        hover(true)
        talkFromPointer(started.hit === 'head' ? 'touch_head' : started.hit === 'special' ? 'touch_special' : 'touch_body')
      }
    }

    void import('../lib/live2d')
      .then(({ createLive2DScene }) => createLive2DScene(canvas, container, controller.signal, (state) => {
        if (!controller.signal.aborted) setInteraction(state)
      }, () => !available(), entranceRef.current))
      .then((scene) => {
        if (controller.signal.aborted) {
          scene.destroy()
          return
        }
        sceneRef.current = scene
        syncVisibility()
        homePrepared()
        setStatus('ready')
        if (compactMedia.matches && available()) hover(true)
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error')
      })

    document.addEventListener('visibilitychange', syncVisibility)
    // Toasts mount in a portal; synchronize their visibility without polling.
    const toastObserver = new MutationObserver(syncVisibility)
    toastObserver.observe(document.body, { childList: true })
    reducedMotion.addEventListener('change', syncVisibility)
    window.addEventListener('pointermove', pointerMove, { passive: true })
    window.addEventListener('pointerdown', startPress, { passive: true })
    window.addEventListener('pointerdown', touchTools, { passive: true })
    window.addEventListener('pointerup', touchTools, { passive: true })
    window.addEventListener('pointercancel', resetFocus)
    window.addEventListener('scroll', resetFocus, { passive: true })
    document.documentElement.addEventListener('pointerleave', pointerLeave)
    window.addEventListener('blur', resetFocus)
    window.addEventListener('click', clickModel)
    return () => {
      window.clearTimeout(hideTimer)
      window.clearTimeout(touchTimer)
      window.clearTimeout(hoverTimer)
      controller.abort()
      toastObserver.disconnect()
      sceneRef.current?.destroy()
      sceneRef.current = null
      document.removeEventListener('visibilitychange', syncVisibility)
      reducedMotion.removeEventListener('change', syncVisibility)
      window.removeEventListener('pointermove', pointerMove)
      window.removeEventListener('pointerdown', startPress)
      window.removeEventListener('pointerdown', touchTools)
      window.removeEventListener('pointerup', touchTools)
      window.removeEventListener('pointercancel', resetFocus)
      window.removeEventListener('scroll', resetFocus)
      document.documentElement.removeEventListener('pointerleave', pointerLeave)
      window.removeEventListener('blur', resetFocus)
      window.removeEventListener('click', clickModel)
    }
  }, [attempt])

  useEffect(() => {
    if (status === 'ready' && focusOnReady) containerRef.current?.focus({ preventScroll: true })
  }, [status, focusOnReady])

  return (
    <div className={`live2d-stage${hovered && !suspended ? ' is-hovered' : ''}`} data-phase={interaction.phase} data-reaction={interaction.reaction ?? undefined}>
      <div aria-atomic="true" aria-live="polite" className="live2d-dialogue" role="status">
        {interaction.text && (chatEnabled || interaction.reaction === 'mail') && <p key={interaction.reaction}>{interaction.text}</p>}
      </div>
      <div
        aria-disabled={status === 'ready' ? !chatEnabled : undefined}
        aria-label={chatEnabled ? '看板娘，点击头部、胸部或其他部位互动；按 Enter 或空格触发身体互动' : '看板娘，对话已关闭，可在功能列表中开启'}
        className="live2d-canvas-wrap"
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
          event.preventDefault()
          if (!event.repeat) talk()
        }}
        ref={containerRef}
        role={status === 'ready' ? 'button' : undefined}
        tabIndex={status === 'ready' ? 0 : undefined}
      >
        <canvas aria-hidden="true" className={status === 'ready' ? 'is-ready' : ''} ref={canvasRef} />
      </div>
      {status === 'ready' ? (
        <CompanionTools actions={[
          { id: 'github', label: '访问 GitHub 主页', icon: <ContactIcon title="GitHub" />, href: githubProfileUrl, external: true },
          { id: 'email', label: '通过 Gmail 联系我', icon: <ContactIcon title="Email" />, href: `mailto:${contactProfile.email}`, onSelect: () => talk('mail') },
          {
            id: 'chat-toggle',
            label: chatEnabled ? '关闭人物点击对话' : '开启人物点击对话',
            icon: <ChatIcon enabled={chatEnabled} />,
            pressed: chatEnabled,
            onSelect: onToggleChat,
          },
          ...(actions ?? noActions),
          { id: 'collapse', label: '收起看板娘', icon: <CollapseIcon />, onSelect: onCollapse },
        ]} />
      ) : (
        <div className="live2d-placeholder">
          <p role="status">{status === 'loading' ? '正在赶来…' : '暂时没能赶到'}</p>
          {status === 'error' && <button onClick={() => { setStatus('loading'); setAttempt((value) => value + 1) }} type="button">再试一次</button>}
          <button aria-label="收起看板娘" className="live2d-placeholder-close" onClick={onCollapse} title="收起看板娘" type="button"><CollapseIcon /></button>
        </div>
      )}
    </div>
  )
}

function ChatIcon({ enabled }: { enabled: boolean }) {
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3v-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      {enabled ? <path d="M7 9h10M7 13h6" /> : <path d="m3 3 18 18" />}
    </svg>
  )
}

function CollapseIcon() {
  return <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6M20 5v14" /></svg>
}

function CompanionIcon() {
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24">
      <path d="M6 4h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-7l-5 3v-3a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" />
      <path d="M8 10h.01M16 10h.01M9 14c2 1.5 4 1.5 6 0" />
    </svg>
  )
}
