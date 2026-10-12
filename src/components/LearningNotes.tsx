import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { learningNotes, noteDifficulties, noteProgresses, noteTopics, type LearningNote } from '../data/notes'
import { learningPhotos, noteCovers } from '../data/note-covers'
import { useNoteGallery } from '../lib/useNoteGallery'

function readingMinutes(note: LearningNote) {
  const text = [note.question, note.understanding, note.practice, ...note.keyPoints, note.example.code ?? '', note.example.explanation, ...note.pitfalls, note.review.question, note.review.answer].join('')
  return Math.max(2, Math.ceil(text.length / 350))
}

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
  const { sectionRef, viewportRef, trackRef, activeIndex, canScroll, goTo, reset } = useNoteGallery(filteredNotes.length)
  const updateFilter = (setter: (value: string) => void, value: string) => { reset(); setter(value) }

  return (
    <section className="notes-gallery" id="notes" aria-labelledby="notes-heading" ref={sectionRef}>
      <div className="notes-sticky">
        <div className="notes-gallery-heading site-container">
          <div className="learning-section-index"><span>02</span> LEARNING NOTES <span>思考的切片</span></div>
          <div className="notes-heading-row">
            <h2 id="notes-heading">把思考，<em>一页页展开。</em></h2>
            <p>一些问题，一些尝试，还有尚未完成的答案。<br />{canScroll ? <><span className="notes-desktop-hint">向下滚动，向右探索</span><span className="notes-touch-hint">左右滑动，翻阅笔记</span></> : <span>{filteredNotes.length ? '点击封面，打开完整笔记' : '换个条件，继续探索'}</span>} <span aria-hidden="true">↗</span></p>
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
                    <div className="note-cover-shade" aria-hidden="true" />
                    <div className="note-cover-top"><span className="note-cover-number">{String(coverIndex + 1).padStart(2, '0')}</span><span>{note.topic}</span><span>{note.difficulty}</span></div>
                    <div className="note-cover-copy">
                      <p className="note-cover-label">{cover.label}</p>
                      <h3>{cover.title}</h3>
                      <p className="note-cover-summary">{note.summary}</p>
                      <div className="note-cover-bottom"><span><i />{note.progress} · 约 {readingMinutes(note)} 分钟</span><span className="note-read-label">打开笔记 <span className="note-open-arrow" aria-hidden="true">↗</span></span></div>
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
          <div className="notes-progress" aria-hidden="true"><span /></div>
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
  const photo = learningPhotos[noteCovers[note.id]?.photo ?? 'studyDesk']
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

  return createPortal(
    <dialog className="learning-note-reader" ref={dialogRef} aria-labelledby="note-reader-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <article className="note-reader-paper">
        <header className="note-reader-masthead"><span>LEARNING JOURNAL / 学习手记</span><button type="button" aria-label="关闭笔记" onClick={onClose}>×</button></header>
        <div className="note-reader-meta"><span>{note.topic}</span><span>{note.progress}</span><span>{note.difficulty}</span><span>约 {readingMinutes(note)} 分钟阅读</span></div>
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
        <footer className="note-reader-end"><p>理解没有终点，这一页还会继续生长。</p><a href={photo.href} target="_blank" rel="noreferrer">封面摄影：{photo.author} / Unsplash <span aria-hidden="true">↗</span></a></footer>
      </article>
    </dialog>, document.body,
  )
}
