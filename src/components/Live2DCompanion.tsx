import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Live2DScene } from '../lib/live2d'
import './Live2DCompanion.css'

const compactQuery = '(max-width: 767px), (pointer: coarse)'
const preferenceKey = 'site-live2d-collapsed'
const lines = [
  '欢迎来做客，今天也一起发现有趣的事吧。',
  '想看看最近在做什么？去「项目」里逛逛吧。',
  '学习的每一小步，都算数。',
  '盯着屏幕很久了？记得眨眨眼、喝口水。',
  '我就在这里，陪你慢慢逛。',
]

function subscribeCompact(callback: () => void) {
  const query = window.matchMedia(compactQuery)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

function readPreference() {
  try {
    return localStorage.getItem(preferenceKey) === 'true'
  } catch {
    return false
  }
}

export function Live2DCompanion({ suspended }: { suspended: boolean }) {
  const compact = useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(compactQuery).matches,
    () => true,
  )
  // Mobile expansion is intentionally session-only; every mobile page starts collapsed.
  const [desktopCollapsed, setDesktopCollapsed] = useState(readPreference)
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const expanded = compact ? mobileExpanded : !desktopCollapsed

  const toggle = () => {
    if (compact) {
      setMobileExpanded((value) => !value)
    } else {
      setDesktopCollapsed(!desktopCollapsed)
      try {
        localStorage.setItem(preferenceKey, String(!desktopCollapsed))
      } catch { /* Storage is optional, including in private browsing. */ }
    }
  }

  return (
    <aside aria-label="网站看板娘" className="live2d-companion" hidden={suspended}>
      {expanded ? (
        <CompanionStage onCollapse={toggle} suspended={suspended} />
      ) : (
        <button
          aria-expanded="false"
          aria-label="展开看板娘"
          className="live2d-launcher"
          onClick={toggle}
          title="展开看板娘"
          type="button"
        >
          <CompanionIcon />
          <span>看板娘</span>
        </button>
      )}
    </aside>
  )
}

function CompanionStage({ onCollapse, suspended }: { onCollapse: () => void; suspended: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Live2DScene | null>(null)
  const suspendedRef = useRef(suspended)
  const talkRef = useRef<HTMLButtonElement>(null)
  const lineRef = useRef(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState({ text: '', sequence: 0 })

  const talk = () => {
    const text = lines[lineRef.current++ % lines.length]
    setMessage((current) => ({ text, sequence: current.sequence + 1 }))
    sceneRef.current?.greet()
  }

  useEffect(() => {
    suspendedRef.current = suspended
    sceneRef.current?.pause(document.hidden || suspended)
  }, [suspended])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const controller = new AbortController()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const syncVisibility = () => sceneRef.current?.pause(document.hidden || suspendedRef.current)
    const pointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      sceneRef.current?.focus(
        (event.clientX / window.innerWidth) * 2 - 1,
        1 - (event.clientY / window.innerHeight) * 2,
      )
    }
    const resetFocus = () => sceneRef.current?.focus(0, 0)
    const clickModel = (event: MouseEvent) => {
      const target = event.target
      if (suspendedRef.current || !(target instanceof Element)) return
      // The canvas lets all page clicks through; links, buttons and selected text keep priority.
      if (target.closest('a, button, input, textarea, select, label, [role="button"], [contenteditable="true"]')) return
      if (window.getSelection()?.toString()) return
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return
      if (sceneRef.current?.contains(x, y)) talkRef.current?.click()
    }

    void import('../lib/live2d')
      .then(({ createLive2DScene }) => createLive2DScene(canvas, container, controller.signal))
      .then((scene) => {
        if (controller.signal.aborted) {
          scene.destroy()
          return
        }
        sceneRef.current = scene
        syncVisibility()
        setStatus('ready')
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error')
      })

    document.addEventListener('visibilitychange', syncVisibility)
    reducedMotion.addEventListener('change', syncVisibility)
    window.addEventListener('pointermove', pointerMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', resetFocus)
    window.addEventListener('blur', resetFocus)
    window.addEventListener('click', clickModel)
    return () => {
      controller.abort()
      sceneRef.current?.destroy()
      sceneRef.current = null
      document.removeEventListener('visibilitychange', syncVisibility)
      reducedMotion.removeEventListener('change', syncVisibility)
      window.removeEventListener('pointermove', pointerMove)
      document.documentElement.removeEventListener('pointerleave', resetFocus)
      window.removeEventListener('blur', resetFocus)
      window.removeEventListener('click', clickModel)
    }
  }, [attempt])

  useEffect(() => {
    if (!message.text) return
    const timeout = window.setTimeout(() => setMessage((current) => ({ ...current, text: '' })), 5000)
    return () => window.clearTimeout(timeout)
  }, [message])

  return (
    <div className="live2d-stage">
      <div aria-atomic="true" aria-live="polite" className="live2d-dialogue" role="status">
        {message.text && <p key={message.sequence}>{message.text}</p>}
      </div>
      <div className="live2d-toolbar">
        <button
          aria-label="和看板娘聊聊"
          className="live2d-chat"
          disabled={status !== 'ready'}
          onClick={talk}
          ref={talkRef}
          title="也可以直接点击人物"
          type="button"
        >
          <CompanionIcon /><span>聊聊</span>
        </button>
        <button aria-expanded="true" aria-label="收起看板娘" className="live2d-collapse" onClick={onCollapse} title="收起看板娘" type="button">
          <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>
        </button>
      </div>
      <div className="live2d-canvas-wrap" ref={containerRef}>
        <canvas aria-hidden="true" className={status === 'ready' ? 'is-ready' : ''} ref={canvasRef} />
        {status === 'loading' && <p className="live2d-placeholder" role="status">正在赶来…</p>}
        {status === 'error' && (
          <div className="live2d-placeholder" role="status">
            <p>暂时没能赶到</p>
            <button className="live2d-retry" onClick={() => { setStatus('loading'); setAttempt((value) => value + 1) }} type="button">再试一次</button>
          </div>
        )}
      </div>
    </div>
  )
}

function CompanionIcon() {
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24">
      <path d="M6 4h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-7l-5 3v-3a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" />
      <path d="M8 10h.01M16 10h.01M9 14c2 1.5 4 1.5 6 0" />
    </svg>
  )
}
