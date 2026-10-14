import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { SectionBackdrop } from './SectionBackdrop'
import { learningNotes, noteDifficulties, noteProgresses, noteTopics, type LearningNote } from '../data/notes'
import { learningPhotos, noteCovers } from '../data/note-covers'
import { useNoteGallery } from '../lib/useNoteGallery'

const noteFontSizes = [90, 100, 110, 120, 130]
const noteFontSizeKey = 'learning-note-font-size'

export function LearningNotes() {
  const [topic, setTopic] = useState('全部主题')
  const [progress, setProgress] = useState('全部进度')
  const [difficulty, setDifficulty] = useState('全部难度')
  const [openedNote, setOpenedNote] = useState<LearningNote | null>(null)
  const filteredNotes = learningNotes.filter(note =>
    (topic === '全部主题' || note.topic === topic) &&
    (progress === '全部进度' || note.progress === progress) &&
    (difficulty === '全部难度' || note.difficulty === difficulty),
  )
  const { sectionRef, viewportRef, trackRef, progressRef, activeIndex, canScroll, goTo, reset } = useNoteGallery(filteredNotes.length)
  const updateFilter = (setter: (value: string) => void, value: string) => { reset(); setter(value) }

  return (
    <section className="notes-gallery section-surface" id="notes" aria-labelledby="notes-heading" ref={sectionRef}>
      <SectionBackdrop edge="none" />
      <div className="notes-sticky">
        <div className="notes-gallery-heading site-container">
          <div className="learning-section-index"><span>02</span> LEARNING NOTES <span>思考的切片</span></div>
          <div className="notes-heading-row">
            <h2 id="notes-heading"><span>从一个问题出发，</span><em>把探索写成自己的理解。</em></h2>
            <p lang="en">I learn by asking questions, testing ideas, and putting what I discover into practice. These notes bring together the concepts, experiments, and small breakthroughs that shape the way I think and build.</p>
          </div>
          <div className="notes-toolbar">
            <div className="notes-filters" role="group" aria-label="筛选学习笔记">
              <NoteFilter label="主题" options={noteTopics} value={topic} onChange={value => updateFilter(setTopic, value)} />
              <NoteFilter label="进度" options={noteProgresses} value={progress} onChange={value => updateFilter(setProgress, value)} />
              <NoteFilter label="难度" options={noteDifficulties} value={difficulty} onChange={value => updateFilter(setDifficulty, value)} />
            </div>
            <p className="notes-count" role="status">{String(filteredNotes.length).padStart(2, '0')} 篇手记</p>
          </div>
        </div>
        <div className="notes-viewport" ref={viewportRef}>
          <div className="notes-track" ref={trackRef}>
            {filteredNotes.map((note, index) => {
              const coverIndex = learningNotes.findIndex(item => item.id === note.id)
              const cover = noteCovers[note.id] ?? { title: note.title, label: 'LEARNING IN PROGRESS', photo: 'studyDesk' as const, palette: coverIndex % 5 }
              const photo = learningPhotos[cover.photo]
              return (
                <article className={`note-exhibit note-palette-${cover.palette}`} data-active={index === activeIndex} key={note.id}>
                  <button className="note-cover" type="button" aria-label={`阅读笔记：${note.title}`} aria-haspopup="dialog" onClick={() => setOpenedNote(note)} onFocus={event => {
                    const bounds = event.currentTarget.getBoundingClientRect()
                    if (event.currentTarget.matches(':focus-visible') && (bounds.left < 0 || bounds.right > window.innerWidth)) goTo(index, true)
                  }}>
                    <img className="note-cover-photo" src={`${import.meta.env.BASE_URL}images/learning/${photo.file}`} alt="" aria-hidden="true" width={960} height={1280} loading="lazy" decoding="async" style={{ objectPosition: cover.position ?? 'center' }} />
                    <div className="note-cover-top"><span className="note-cover-number">{String(coverIndex + 1).padStart(2, '0')}</span><span>{note.topic}</span><span>{note.difficulty}</span></div>
                    <div className="note-cover-copy">
                      <p className="note-cover-label">{cover.label}</p>
                      <h3>{cover.title}</h3>
                      <p className="note-cover-summary">{note.summary}</p>
                      <div className="note-cover-bottom"><span><i />{note.progress}</span><span className="note-read-label">打开笔记 <span className="note-open-arrow" aria-hidden="true">↗</span></span></div>
                    </div>
                  </button>
                </article>
              )
            })}
          </div>
          {filteredNotes.length === 0 && <div className="notes-empty site-container"><span aria-hidden="true">∅</span><h3>这一页，暂时留白。</h3><p>还没有符合这些条件的笔记，换个方向探索吧。</p><button type="button" onClick={() => { reset(); setTopic('全部主题'); setProgress('全部进度'); setDifficulty('全部难度') }}>查看全部笔记 <span aria-hidden="true">↗</span></button></div>}
        </div>
        <div className="notes-gallery-footer site-container">
          <span className="notes-page-number">{filteredNotes.length ? String(activeIndex + 1).padStart(2, '0') : '00'} <span>/ {String(filteredNotes.length).padStart(2, '0')}</span></span>
          <div className="notes-progress" aria-hidden="true"><span ref={progressRef} /></div>
          <div className="notes-arrows" aria-label="翻阅笔记">
            <button aria-label="上一篇笔记" type="button" disabled={!canScroll || activeIndex === 0} onClick={() => goTo(activeIndex - 1)}>←</button>
            <button aria-label="下一篇笔记" type="button" disabled={!canScroll || activeIndex >= filteredNotes.length - 1} onClick={() => goTo(activeIndex + 1)}>→</button>
          </div>
        </div>
      </div>
      {openedNote && <NoteReader note={openedNote} onClose={() => setOpenedNote(null)} />}
    </section>
  )
}

function NoteFilter({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: readonly string[]; value: string }) {
  return <label className="notes-filter"><span>{label}</span><select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option}>{option}</option>)}</select></label>
}

function NoteReader({ note, onClose }: { note: LearningNote; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [isClosing, setIsClosing] = useState(false)
  const [fontSize, setFontSize] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(noteFontSizeKey))
      return noteFontSizes.includes(saved) ? saved : 100
    } catch {
      return 100
    }
  })

  const updateFontSize = (size: number) => {
    setFontSize(size)
    try {
      localStorage.setItem(noteFontSizeKey, String(size))
    } catch {
      // Font controls remain available when browser storage is disabled.
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current
    const previousOverflow = document.body.style.overflow
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
      trigger?.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (!isClosing) return
    let active = true
    const transitions = dialogRef.current?.getAnimations() ?? []
    // Keep the dialog modal until its exit finishes, including reduced-motion exits.
    void Promise.allSettled(transitions.map(transition => transition.finished)).then(() => {
      if (active) onClose()
    })
    return () => { active = false }
  }, [isClosing, onClose])

  const requestClose = () => setIsClosing(true)

  return createPortal(
    <dialog className="learning-note-reader" ref={dialogRef} aria-labelledby="note-reader-title" data-closing={isClosing} style={{ '--note-reader-font-scale': fontSize / 100 } as CSSProperties} onCancel={event => { event.preventDefault(); requestClose() }} onClick={event => { if (event.target === event.currentTarget) requestClose() }}>
      <div className="note-reader-scroll">
        <header className="note-reader-masthead"><span>LEARNING JOURNAL / 学习手记</span><button type="button" aria-label="关闭笔记" onClick={requestClose}><span aria-hidden="true">×</span></button></header>
        <article className="note-reader-paper">
          <div className="note-reader-meta"><span>{note.topic}</span><span>{note.progress}</span><span>{note.difficulty}</span></div>
          <h2 id="note-reader-title">{note.title}</h2>
          <p className="note-reader-summary">{note.summary}</p>
          <div className="note-reader-sections">
            <section><h3><span>01</span>从一个问题开始</h3><p>{note.question}</p></section>
            <section><h3><span>02</span>理解与要点</h3><p>{note.understanding}</p><ul className="note-reader-points">{note.keyPoints.map(point => <li key={point}>{point}</li>)}</ul></section>
            <section>
              <h3><span>03</span>把理解放进实践</h3><p>{note.practice}</p>
              <div className="note-reader-example">
                <div className="note-example-heading"><h4>{note.example.title}</h4>{note.example.language && <span>{note.example.language}</span>}</div>
                {note.example.code && <pre tabIndex={0} aria-label={`${note.example.language} 示例`}><code>{note.example.code}</code></pre>}
                <p>{note.example.explanation}</p>
              </div>
            </section>
            <section><h3><span>04</span>容易走偏的地方</h3><ul className="note-reader-pitfalls">{note.pitfalls.map(pitfall => <li key={pitfall}>{pitfall}</li>)}</ul></section>
            <section>
              <h3><span>05</span>合上笔记，试着回答</h3><p>{note.review.question}</p>
              <details className="note-reader-review"><summary>想好之后，展开参考答案 <span aria-hidden="true">＋</span></summary><p>{note.review.answer}</p></details>
            </section>
            <section><h3><span>06</span>回到参考资料</h3><a href={note.reference.href} target="_blank" rel="noreferrer">{note.reference.label} <span aria-hidden="true">↗</span></a></section>
          </div>
          <footer className="note-reader-end"><p>理解没有终点，这一页还会继续生长。</p><span>KEEP LEARNING ↗</span></footer>
        </article>
      </div>
      <div className="note-reader-font-controls" role="group" aria-label="调整笔记字号">
        <span aria-hidden="true">字号</span>
        <button type="button" aria-label="缩小字号" title="缩小字号" disabled={fontSize === noteFontSizes[0]} onClick={() => updateFontSize(fontSize - 10)}>A−</button>
        <button className="note-reader-font-reset" type="button" aria-label={`当前字号 ${fontSize}%，恢复默认字号`} title="恢复默认字号" onClick={() => updateFontSize(100)}>{fontSize}%</button>
        <button type="button" aria-label="放大字号" title="放大字号" disabled={fontSize === noteFontSizes[noteFontSizes.length - 1]} onClick={() => updateFontSize(fontSize + 10)}>A+</button>
      </div>
    </dialog>, document.body,
  )
}
