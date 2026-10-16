import { useEffect, useRef } from 'react'
import './LearningNotesTicker.css'

const ideas = [
  { title: '追问本质', translation: 'ASK WHY', icon: 'question' },
  { title: '拆解概念', translation: 'UNPACK IDEAS', icon: 'layers' },
  { title: '串联知识', translation: 'CONNECT THE DOTS', icon: 'connect' },
  { title: '动手验证', translation: 'TEST IN CODE', icon: 'code' },
  { title: '记录发现', translation: 'RECORD DISCOVERIES', icon: 'note' },
  { title: '温故知新', translation: 'REVISIT & REFINE', icon: 'revisit' },
] as const

function IdeaIcon({ icon }: { icon: typeof ideas[number]['icon'] }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path className="learning-notes-icon-frame" d="m12 2 8.7 5v10L12 22l-8.7-5V7Z" />
      {icon === 'question' && <><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.6-2.5 1.9-2.5 3.5" /><path d="M12 16h.01" /></>}
      {icon === 'layers' && <><path d="m7 10 5-3 5 3-5 3Z" /><path d="m7 14 5 3 5-3" /></>}
      {icon === 'connect' && <><path d="m8 9 8 6M8 15l8-6" /><circle cx="8" cy="8" r="1.5" /><circle cx="16" cy="8" r="1.5" /><circle cx="8" cy="16" r="1.5" /><circle cx="16" cy="16" r="1.5" /></>}
      {icon === 'code' && <><path d="m9 9-3 3 3 3m6-6 3 3-3 3m-2-7-2 10" /></>}
      {icon === 'note' && <><path d="M8 7h8v10H8Zm3 3h3m-3 3h3" /></>}
      {icon === 'revisit' && <><path d="M16.5 10a4.7 4.7 0 1 0 0 4M17 7v4h-4" /></>}
    </svg>
  )
}

export function LearningNotesTicker() {
  const tickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ticker = tickerRef.current
    const group = ticker?.querySelector('ul')
    if (!ticker || !group) return
    let inView = false
    const updatePlayback = () => { ticker.dataset.running = String(inView && !document.hidden) }
    const intersection = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      updatePlayback()
    })
    const resize = new ResizeObserver(([entry]) => {
      // Keep a steady reading pace, including on wide screens.
      ticker.style.setProperty('--notes-ticker-duration', `${entry.borderBoxSize[0].inlineSize / 36}s`)
    })
    intersection.observe(ticker)
    resize.observe(group)
    document.addEventListener('visibilitychange', updatePlayback)
    return () => {
      intersection.disconnect()
      resize.disconnect()
      document.removeEventListener('visibilitychange', updatePlayback)
    }
  }, [])

  return (
    <div className="learning-notes-ticker" ref={tickerRef} role="group" aria-label="学习理念" tabIndex={0}>
      <div className="learning-notes-ticker-track">
        {[0, 1].map(copy => (
          <ul className="learning-notes-ticker-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>
            {ideas.map(idea => (
              <li key={idea.icon}>
                <IdeaIcon icon={idea.icon} />
                <span className="learning-notes-ticker-title">{idea.title}</span>
                <span className="learning-notes-ticker-english" lang="en">{idea.translation}</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}
