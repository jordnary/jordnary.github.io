import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react'
import type { Live2DScene } from '../lib/live2d'
import type { CompanionReaction, CompanionState } from '../lib/companion-behavior'
import type { CompanionHit } from '../lib/live2d-hit'
import { githubProfileUrl } from '../lib/github'
import { contactProfile } from '../data/contact'
import { CompanionTools, type CompanionAction } from './CompanionTools'
import { ContactIcon } from './icons'
import './Live2DCompanion.css'

const compactQuery = '(max-width: 767px), (pointer: coarse), (hover: none)'
const preferenceKey = 'site-live2d-collapsed'
const chatPreferenceKey = 'site-live2d-chat-enabled'
const interactiveSelector = 'a, button, input, textarea, select, label, summary, [role="button"], [role="link"], [role="menuitem"], [role="checkbox"], [role="switch"], [role="slider"], [tabindex], [contenteditable]:not([contenteditable="false"])'
const noActions: readonly CompanionAction[] = []

function subscribeCompact(callback: () => void) {
  const query = window.matchMedia(compactQuery)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

function readPreference(key: string, fallback = false) {
  try {
    const stored = localStorage.getItem(key)
    return stored === null ? fallback : stored === 'true'
  } catch {
    return fallback
  }
}

type CompanionProps = {
  suspended: boolean
  actions?: readonly CompanionAction[]
}

export function Live2DCompanion({ suspended, actions = noActions }: CompanionProps) {
  const compact = useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(compactQuery).matches,
    () => true,
  )
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => readPreference(preferenceKey))
  const [chatEnabled, setChatEnabled] = useState(() => readPreference(chatPreferenceKey, true))
  const [restoreFocus, setRestoreFocus] = useState(false)
  const [homeRequested, setHomeRequested] = useState(false)
  const launcherRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (desktopCollapsed && restoreFocus) launcherRef.current?.focus({ preventScroll: true })
  }, [desktopCollapsed, restoreFocus])

  // Do not mount a launcher, import the renderer or fetch model assets on mobile.
  if (compact) return null

  const toggle = () => {
    setRestoreFocus(true)
    setHomeRequested(desktopCollapsed)
    setDesktopCollapsed(!desktopCollapsed)
    try {
      localStorage.setItem(preferenceKey, String(!desktopCollapsed))
    } catch { /* Storage is optional, including in private browsing. */ }
  }

  const toggleChat = () => {
    setChatEnabled(!chatEnabled)
    try {
      localStorage.setItem(chatPreferenceKey, String(!chatEnabled))
    } catch { /* Storage is optional, including in private browsing. */ }
  }

  return (
    <aside aria-label="网站看板娘" className={`live2d-companion${desktopCollapsed ? ' is-collapsed' : ''}`} hidden={suspended}>
      {!desktopCollapsed ? (
        <CompanionStage actions={actions} chatEnabled={chatEnabled} focusOnReady={restoreFocus} homeRequested={homeRequested} onHomePrepared={() => setHomeRequested(false)} onCollapse={toggle} onToggleChat={toggleChat} suspended={suspended} />
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

function CompanionStage({ onCollapse, suspended, actions, focusOnReady, homeRequested, onHomePrepared, chatEnabled, onToggleChat }: CompanionProps & {
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
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const controller = new AbortController()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let hideTimer = 0
    let hoverTimer = 0
    let lastHitTime = 0
    let press: { x: number; y: number; pointerId: number; hit: CompanionHit } | null = null

    const available = () => !document.hidden && !suspendedRef.current && !document.querySelector('.toast')
    const hover = (active: boolean) => {
      if (active) {
        window.clearTimeout(hideTimer)
        hideTimer = 0
        setHovered(true)
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
        x / rect.width * container.clientWidth,
        y / rect.height * container.clientHeight,
      ) ?? null
    }
    const inHoverArea = (event: PointerEvent) => {
      if (!sceneRef.current) return false
      if (event.target instanceof Element && event.target.closest('.live2d-tools')) return true
      // Include transparent gaps on the way to the tools without intercepting clicks.
      // Dialogue continues to use the separate, visible-pixel hitModel check.
      const rect = container.getBoundingClientRect()
      return event.clientX >= rect.left && event.clientX < rect.right
        && event.clientY >= rect.top && event.clientY < rect.bottom
    }
    const resetFocus = () => {
      sceneRef.current?.focus(0, 0)
      press = null
      window.clearTimeout(hoverTimer)
      hover(false)
    }
    const syncVisibility = () => {
      sceneRef.current?.pause(!available())
      if (!available()) resetFocus()
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
    window.addEventListener('pointercancel', resetFocus)
    window.addEventListener('scroll', resetFocus, { passive: true })
    document.documentElement.addEventListener('pointerleave', resetFocus)
    window.addEventListener('blur', resetFocus)
    window.addEventListener('click', clickModel)
    return () => {
      window.clearTimeout(hideTimer)
      window.clearTimeout(hoverTimer)
      controller.abort()
      toastObserver.disconnect()
      sceneRef.current?.destroy()
      sceneRef.current = null
      document.removeEventListener('visibilitychange', syncVisibility)
      reducedMotion.removeEventListener('change', syncVisibility)
      window.removeEventListener('pointermove', pointerMove)
      window.removeEventListener('pointerdown', startPress)
      window.removeEventListener('pointercancel', resetFocus)
      window.removeEventListener('scroll', resetFocus)
      document.documentElement.removeEventListener('pointerleave', resetFocus)
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
        {interaction.text && <p key={interaction.reaction}>{interaction.text}</p>}
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
