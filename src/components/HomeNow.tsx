import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { homeNow } from '../data/home-editorial'
import { HomePhotoGallery } from './HomePhotoGallery'
import { LiveUpdates } from './LiveUpdates'
import { useHomeNowReaderMotion, type ReadingVisit } from './useHomeNowReaderMotion'
import './HomeNow.css'

export function HomeNow() {
  const [visit, setVisit] = useState<ReadingVisit | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dismiss = useCallback(() => setVisit(null), [])
  useEffect(() => {
    // Prepare the reading assets as the gallery approaches, before the click.
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      const image = new Image()
      image.src = `${import.meta.env.BASE_URL}images/home/now-woodland-frame.webp`
      void image.decode().catch(() => {})
      void document.fonts.load('18px "Woodland WenKai"').catch(() => {})
      void document.fonts.load('48px "Woodland Display"').catch(() => {})
      observer.disconnect()
    }, { rootMargin: '600px' })
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])
  const explore = (index: number, trigger: HTMLButtonElement) => {
    const cover = trigger.querySelector<HTMLElement>('.home-gallery-window')!
    const style = getComputedStyle(cover.querySelector('img')!)
    setVisit({ index, trigger, origin: cover.getBoundingClientRect(), radius: getComputedStyle(cover).borderTopLeftRadius, imageTransform: style.transform, imageFilter: style.filter, imageOpacity: style.opacity })
  }
  return <div ref={containerRef}>
    <HomePhotoGallery photos={homeNow} label="最近在做什么" onExplore={explore} />
    {visit && <NowReader visit={visit} onClose={dismiss} />}
  </div>
}

function NowReader({ visit, onClose }: { visit: ReadingVisit; onClose: () => void }) {
  const entry = homeNow[visit.index]
  const dialogRef = useRef<HTMLDialogElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const close = useHomeNowReaderMotion(dialogRef, visit, onClose)

  useLayoutEffect(() => {
    const scroll = scrollRef.current!
    const dialog = dialogRef.current!
    const update = () => {
      const distance = scroll.scrollHeight - scroll.clientHeight
      const progress = distance > 1 ? Math.min(1, scroll.scrollTop / distance) : 1
      dialog.style.setProperty('--now-progress', String(progress))
      dialog.dataset.readEnd = String(progress > .98)
    }
    const resize = new ResizeObserver(update)
    resize.observe(scroll)
    resize.observe(scroll.firstElementChild!)
    scroll.addEventListener('scroll', update, { passive: true })
    update()
    return () => { resize.disconnect(); scroll.removeEventListener('scroll', update) }
  }, [])

  return createPortal(<dialog className="home-now-reader" ref={dialogRef} aria-labelledby="home-now-reader-title"
    onCancel={event => { event.preventDefault(); close() }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return
      const targets = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]'))
        .filter(element => element.getClientRects().length > 0)
      const first = targets[0]
      const last = targets.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}
    onClick={event => {
      if (event.target !== event.currentTarget) return
      const box = event.currentTarget.getBoundingClientRect()
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close()
    }}>
    <div className="home-now-reader-cover" aria-hidden="true"><img src={entry.src} alt="" /></div>
    <div className="home-now-reader-shell">
      <picture className="home-now-reader-scene" aria-hidden="true">
        <img src={`${import.meta.env.BASE_URL}images/home/now-woodland-frame.webp`} alt="" width="1536" height="1024" />
      </picture>
      <div className="home-now-reader-paper">
        <header className="home-now-reader-bar">
          <button type="button" className="home-now-close" aria-label="关闭近况 / Close" onClick={close} autoFocus>
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
              <path d="m4 4 12 12M16 4 4 16" />
            </svg>
          </button>
        </header>
        <div className="home-now-reader-scroll" ref={scrollRef} tabIndex={0} role="region" aria-label="近况正文，可滚动阅读">
          <div className="home-now-reader-column">
            <article>
              <div className="home-now-reader-heading">
                <p className="home-now-reader-eyebrow" lang="en">NOW & NOTES <span aria-hidden="true">·</span> {entry.key === 'code' ? 'THE WORKBENCH' : 'THE READING TRAIL'}</p>
                <p className="home-now-reader-english" lang="en">{entry.label}</p>
                <h2 id="home-now-reader-title" lang="zh-CN">{entry.chinese}</h2>
                <p className="home-now-reader-description">{entry.description}<span lang="en">{entry.english}</span></p>
                <span className="home-now-reader-divider" aria-hidden="true"><i /><svg viewBox="0 0 40 24" fill="none"><path d="M5 20C16 20 23 11 34 4M13 18C8 10 13 7 18 12M23 12C21 5 25 2 30 6" /></svg><i /></span>
              </div>
              <LiveUpdates kind={entry.key} />
            </article>
            <footer className="home-now-reader-end"><span aria-hidden="true">✳</span><p lang="en">Leave a little room for wonder.</p><span>日常，还在继续。</span></footer>
          </div>
        </div>
        <div className="home-now-reader-trail" aria-hidden="true"><span lang="en">TAKE YOUR TIME</span><span className="home-now-trail-label"><span className="home-now-trail-more">沿着文字，慢慢走</span><span className="home-now-trail-end">暂读至此，下次再来。</span><i><b /></i></span></div>
      </div>
    </div>
  </dialog>, document.body)
}
