import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react'
import { motion, useScroll, useTransform, type MotionStyle, type MotionValue } from 'motion/react'
import { LearningCoverOutline } from './LearningCoverOutline'

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'
const imageRoot = `${import.meta.env.BASE_URL}images/learning/`

function subscribeMotionPreference(callback: () => void) {
  const media = window.matchMedia(reducedMotionQuery)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

function InkLine({ children, index, progress, staticScene }: { children: string; index: number; progress: MotionValue<number>; staticScene: boolean }) {
  const opacity = useTransform(progress, [0.04 + index * 0.11, 0.24 + index * 0.11], [0.2, 1])
  return <motion.span className="learning-ink-line" style={{ opacity: staticScene ? 1 : opacity }}>{children}</motion.span>
}

function DrawingGuides() {
  return (
    <svg className="learning-ink-guides" viewBox="0 0 700 700" fill="none" aria-hidden="true">
      <path d="M24 24H36M30 18V30M664 24H676M670 18V30M24 676H36M30 670V682M664 676H676M670 670V682" />
      <path className="learning-guide-dashed" d="M350 40V660M42 350H658M42 140H658M42 560H658M140 42V658M560 42V658" />
      <path d="M72 560V610H122M578 90H628V140" />
      <circle className="learning-guide-dot" cx="350" cy="105" r="3" />
      <circle className="learning-guide-dot" cx="105" cy="350" r="3" />
    </svg>
  )
}

function CoverDraftingGrid() {
  return (
    <svg className="learning-cover-drafting" viewBox="0 0 1440 800" fill="none" aria-hidden="true">
      <g className="learning-cover-construction">
        <path d="M75 134H1390M75 193H1390M75 370H1390M75 552H1390M75 652H1390" />
        <path d="M157 46V750M301 46V750M448 46V750M594 46V750M812 46V750M952 46V750M1117 46V750M1258 46V750" />
      </g>
      <g className="learning-cover-measure learning-cover-guide-left">
        <path className="learning-cover-projections" d="M-300 134H594M-300 193H301M-300 370H301M-300 393H301M-300 552H157M-300 652H157" />
        <path className="learning-cover-dimensions" d="M-300 134V652M-306 134H-294M-306 652H-294" />
      </g>
      <g className="learning-cover-measure learning-cover-guide-right">
        <path className="learning-cover-projections" d="M812 134H1740M1117 193H1740M1117 370H1740M1117 393H1740M1258 552H1740M1258 652H1740" />
        <path className="learning-cover-dimensions" d="M1740 134V652M1734 134H1746M1734 652H1746" />
      </g>
      <g className="learning-cover-measure learning-cover-guide-top">
        <path className="learning-cover-projections" d="M157 25V552M301 25V193M448 25V193M594 25V134M812 25V134M952 25V193M1117 25V193M1258 25V552" />
        <path className="learning-cover-dimensions" d="M157 25H1258M157 19V31M1258 19V31" />
      </g>
      <g className="learning-cover-measure learning-cover-guide-bottom">
        <path className="learning-cover-projections" d="M157 652V770M301 652V770M448 652V770M594 652V770M812 652V770M952 652V770M1117 652V770M1258 652V770" />
        <path className="learning-cover-dimensions" d="M157 770H1258M157 764V776M1258 764V776" />
      </g>
      <g className="learning-cover-grid-points">
        <path d="M295 134H307M301 128V140M1111 134H1123M1117 128V140M151 652H163M157 646V658M1252 652H1264M1258 646V658" />
      </g>
    </svg>
  )
}

function LearningCover({ staticScene }: { staticScene: boolean }) {
  const coordinateRef = useRef<HTMLSpanElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const hintShownRef = useRef(false)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [hintVisible, setHintVisible] = useState(false)
  const [loaded, setLoaded] = useState({ photo: false, trees: false })
  const ready = loaded.photo && loaded.trees
  const markLoaded = (layer: keyof typeof loaded) => setLoaded(current => current[layer] ? current : { ...current, [layer]: true })

  useEffect(() => () => clearTimeout(hintTimerRef.current), [])

  function hideHint() {
    clearTimeout(hintTimerRef.current)
    setHintVisible(false)
  }

  function updatePointer(event: PointerEvent<HTMLDivElement>) {
    const canvas = event.currentTarget
    const bounds = canvas.getBoundingClientRect()
    const canvasWidth = canvas.clientWidth
    const canvasHeight = canvas.clientHeight
    const x = Math.max(0, Math.min(canvasWidth, event.clientX - bounds.left))
    const y = Math.max(0, Math.min(canvasHeight, event.clientY - bounds.top))
    const hintWidth = hintRef.current?.offsetWidth ?? 0
    const hintHeight = hintRef.current?.offsetHeight ?? 0
    canvas.style.setProperty('--cursor-x', `${x}px`)
    canvas.style.setProperty('--cursor-y', `${y}px`)
    canvas.style.setProperty('--hint-x', `${x + 14 + hintWidth <= canvasWidth - 10 ? x + 14 : Math.max(10, x - 14 - hintWidth)}px`)
    canvas.style.setProperty('--hint-y', `${y + 12 + hintHeight <= canvasHeight - 10 ? y + 12 : Math.max(10, y - 12 - hintHeight)}px`)
    if (coordinateRef.current) coordinateRef.current.textContent = `X:${Math.round(x)}PX\nY:${Math.round(y)}PX`
    canvas.dataset.pointer = 'true'
    canvas.dataset.pointerSide = x < canvasWidth / 2 ? 'left' : 'right'
    canvas.dataset.pointerLevel = y < canvasHeight / 2 ? 'top' : 'bottom'
    const start = dragStartRef.current
    if (start) {
      canvas.style.setProperty('--selection-x', `${Math.min(x, start.x)}px`)
      canvas.style.setProperty('--selection-y', `${Math.min(y, start.y)}px`)
      canvas.style.setProperty('--selection-width', `${Math.abs(x - start.x)}px`)
      canvas.style.setProperty('--selection-height', `${Math.abs(y - start.y)}px`)
    }
    return { x, y }
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    dragStartRef.current = null
    delete event.currentTarget.dataset.dragging
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) delete event.currentTarget.dataset.pointer
  }

  return (
    <div className="learning-cover-image" data-ready={ready} data-static={staticScene} data-hint-visible={hintVisible} aria-hidden="true" onPointerMove={event => {
      if (event.pointerType === 'touch') return
      updatePointer(event)
      if (!hintShownRef.current) {
        hintShownRef.current = true
        setHintVisible(true)
        hintTimerRef.current = setTimeout(() => setHintVisible(false), 3000)
      }
    }} onPointerDown={event => {
      if (event.pointerType === 'touch' || event.button !== 0) return
      event.preventDefault()
      hintShownRef.current = true
      hideHint()
      dragStartRef.current = updatePointer(event)
      updatePointer(event)
      event.currentTarget.dataset.dragging = 'true'
      event.currentTarget.setPointerCapture(event.pointerId)
    }} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag} onPointerLeave={event => {
      hideHint()
      if (!dragStartRef.current) delete event.currentTarget.dataset.pointer
    }} onDragStart={event => event.preventDefault()}>
      <div className="learning-cover-image-caption"><span><i /> HORIZON / LEARNING LAB</span><span>ARCHITECTURE STUDY / 001</span></div>
      <div className="learning-cover-rulers"><i /><i /><i /><i /></div>
      <div className="learning-cover-artwork">
        <CoverDraftingGrid />
        <LearningCoverOutline />
        <div className="learning-cover-photo-reveal">
          <div className="learning-cover-render">
            <img className="learning-cover-panorama" src={`${imageRoot}hero-campus-sketch.webp`} alt="" width={1440} height={800} fetchPriority="high" onLoad={() => markLoaded('photo')} onError={() => markLoaded('photo')} />
            <div className="learning-cover-trees">
              <img src={`${imageRoot}hero-campus-trees.webp`} className="learning-cover-tree-art" alt="" width={1440} height={800} fetchPriority="high" onLoad={() => markLoaded('trees')} onError={() => markLoaded('trees')} />
            </div>
          </div>
        </div>
        <div className="learning-cover-loading"><i className="learning-cover-loading-track" /><span className="learning-cover-loading-percent" /></div>
        <span className="learning-cover-sweep learning-cover-sweep-top" />
        <span className="learning-cover-sweep learning-cover-sweep-bottom" />
      </div>
      <span className="learning-cover-side-note">FIG. 001 / THE ARCHITECTURE OF INTELLIGENCE</span>
      <span className="learning-cover-side-index">从一条线索，构筑新的理解。</span>
      <div className="learning-cover-reticle"><b className="learning-cover-selection" /><i /><span ref={coordinateRef}>{'X:0PX\nY:0PX'}</span><div ref={hintRef} className="learning-cover-drag-hint">按住左键并拖拽<br />绘制选框</div></div>
      <div className="learning-cover-image-baseline"><span>好奇是起点，理解没有终点。</span><span>EXPLORE THE STRUCTURE <b>↓</b></span></div>
    </div>
  )
}

export function LearningHeroScene() {
  const artRef = useRef<HTMLDivElement>(null)
  const narrativeRef = useRef<HTMLDivElement>(null)
  const staticScene = useSyncExternalStore(subscribeMotionPreference, () => window.matchMedia(reducedMotionQuery).matches, () => true)
  const { scrollYProgress } = useScroll({ target: artRef, offset: ['start 82%', 'end 72%'] })
  const { scrollYProgress: textProgress } = useScroll({ target: narrativeRef, offset: ['start 82%', 'center 60%'] })
  // Opposing transforms keep the architecture still. The erosion phase follows
  // scroll position, so stopping freezes the edge and scrolling back retraces it.
  const revealY = useTransform(scrollYProgress, [0, 0.94], ['-90%', '0%'])
  const compositionY = useTransform(scrollYProgress, [0, 0.94], ['126%', '0%'])
  const erosionFrame = useTransform(scrollYProgress, progress => Math.floor(Math.max(0, Math.min(1, progress)) * 96) % 32)
  const outlineOpacity = useTransform(scrollYProgress, [0, 0.88, 1], [1, 1, 0])
  const signalOpacity = useTransform(scrollYProgress, [0.06, 0.3], [0, 0.86])
  const sunOpacity = useTransform(scrollYProgress, [0.04, 0.52], [0, 0.94])
  const detailOpacity = useTransform(textProgress, [0.35, 0.8], [0.35, 1])

  return (
    <>
      <LearningCover staticScene={staticScene} />

      <div className="learning-cover-heading">
        <div className="learning-cover-title"><p>STAY CURIOUS. KEEP BUILDING.</p><h1>把好奇，<br />变成<em>理解。</em><span aria-hidden="true">↘</span></h1></div>
        <div className="learning-cover-intro">
          <span className="learning-intro-index">学 / 习 / 手 / 记</span>
          <p className="learning-cover-copy">拆开复杂的概念，连接零散的线索。<br />从计算机基础到机器学习，<br />在每一次动手里，让知识成为自己的。</p>
          <a className="learning-cover-link" href="#notes">翻开学习笔记 <span aria-hidden="true">↗</span></a>
          <div className="learning-cover-topics"><span>01 / 基础</span><span>02 / 智能</span><span>03 / 实践</span></div>
        </div>
      </div>

      <section className="learning-hero-story" data-static={staticScene} aria-labelledby="learning-hero-story-title">
        <figure className="learning-hero-scene">
          <div className="learning-hero-scene-meta"><span>01 / A CLOSER LOOK</span><span>从线索到理解</span></div>
          <div className="learning-ink-art" ref={artRef} role="img" aria-label="红日与景观树之间的高层建筑，从纯结构线逐渐显影为细致的黑白素描">
            <DrawingGuides />
            <motion.div className="learning-ink-signal" style={{ opacity: staticScene ? 0.86 : signalOpacity }}><span>STRUCTURE / 01</span><i /></motion.div>
            <motion.img className="learning-ink-outline" src={`${imageRoot}hero-tower-outline.svg`} alt="" width={1000} height={1200} style={{ opacity: staticScene ? 0 : outlineOpacity }} />
            <motion.div className="learning-ink-reveal" style={{ y: staticScene ? '0%' : revealY, '--ink-frame': staticScene ? 0 : erosionFrame } as MotionStyle}>
              <motion.div className="learning-ink-composition" style={{ y: staticScene ? '0%' : compositionY }}>
                <img className="learning-ink-texture" src={`${imageRoot}hero-tower-sketch.webp`} alt="" width={1000} height={1200} />
                <motion.div className="learning-ink-sun" style={{ opacity: staticScene ? 0.94 : sunOpacity }} aria-hidden="true" />
                <div className="learning-ink-trees" aria-hidden="true">
                  <img className="learning-ink-landscape" src={`${imageRoot}hero-tower-trees.webp`} alt="" width={1000} height={1200} />
                </div>
              </motion.div>
            </motion.div>
            <span className="learning-art-coordinate learning-art-coordinate-top">INPUT / 好奇</span>
            <span className="learning-art-coordinate learning-art-coordinate-bottom">OUTPUT / 新的理解</span>
          </div>
          <figcaption className="learning-hero-art-caption"><span>一条线索，慢慢有了形状。</span><span>SCROLL TO DEVELOP ↓</span></figcaption>
        </figure>

        <div className="learning-hero-narrative" ref={narrativeRef}>
          <p className="learning-kicker">在问题与答案之间</p>
          <h2 id="learning-hero-story-title">
            {['拆解问题，', '连接线索。', '在实践里，', '让理解成形。'].map((line, index) => (
              <InkLine key={line} index={index} progress={textProgress} staticScene={staticScene}>{line}</InkLine>
            ))}
          </h2>
          <motion.p className="learning-hero-story-copy" style={{ opacity: staticScene ? 1 : detailOpacity }}>计算机基础、机器学习、亲手做过的小实验。<br />让抽象的知识，一点点变得具体。</motion.p>
          <a className="learning-story-link" href="#skills">循着兴趣，继续探索 <span aria-hidden="true">↗</span></a>
          <div className="learning-hero-margin-note"><span>观察 / 连接 / 验证</span><p>每一次重新理解，<br />都值得留下一页笔记。</p></div>
        </div>
      </section>
    </>
  )
}
