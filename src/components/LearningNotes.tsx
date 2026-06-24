import { useMemo, useState } from 'react'
import { PageSection } from './PageSection'
import { Reveal } from './Reveal'
import {
  learningNotes,
  noteDifficulties,
  noteProgresses,
  noteTopics,
  type NoteDifficulty,
  type NoteProgress,
  type NoteTopic,
} from '../data/notes'

type TopicFilter = NoteTopic | '全部主题'
type ProgressFilter = NoteProgress | '全部进度'
type DifficultyFilter = NoteDifficulty | '全部难度'

export function LearningNotes() {
  const [topic, setTopic] = useState<TopicFilter>('全部主题')
  const [progress, setProgress] = useState<ProgressFilter>('全部进度')
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('全部难度')

  const filteredNotes = useMemo(
    () =>
      learningNotes.filter(
        (note) =>
          (topic === '全部主题' || note.topic === topic) &&
          (progress === '全部进度' || note.progress === progress) &&
          (difficulty === '全部难度' || note.difficulty === difficulty),
      ),
    [difficulty, progress, topic],
  )

  return (
    <PageSection
      id="notes"
      eyebrow="Learning Notes"
      title="可继续生长的学习笔记"
      description="每篇从一个具体问题出发，写下当前理解、一次实践和可回看的参考来源。"
    >
      <Reveal as="div" className="note-filter-panel" baseDelay={0.08}>
        <p className="meta-label">筛选笔记</p>
        <div className="note-filter-grid">
          <NoteFilter
            label="主题"
            onChange={(value) => setTopic(value as TopicFilter)}
            options={noteTopics}
            value={topic}
          />
          <NoteFilter
            label="进度"
            onChange={(value) => setProgress(value as ProgressFilter)}
            options={noteProgresses}
            value={progress}
          />
          <NoteFilter
            label="难度"
            onChange={(value) => setDifficulty(value as DifficultyFilter)}
            options={noteDifficulties}
            value={difficulty}
          />
        </div>
      </Reveal>

      <p className="note-result-count" aria-live="polite">
        当前显示 {filteredNotes.length} 篇笔记
      </p>

      <div className="note-list">
        {filteredNotes.map((note, index) => (
          <Reveal as="article" className="note-card glass-card" index={index} key={note.id}>
            <header className="note-card-header">
              <div className="note-meta-list">
                <span>{note.topic}</span>
                <span>{note.progress}</span>
                <span>{note.difficulty}</span>
              </div>
              <h3 className="card-title mt-3 text-xl sm:text-2xl">{note.title}</h3>
              <p className="card-copy mt-3 text-sm leading-6 sm:text-base">{note.summary}</p>
            </header>

            <div className="note-content-grid">
              <NoteSection label="问题" copy={note.question} />
              <NoteSection label="理解" copy={note.understanding} />
              <NoteSection label="实践" copy={note.practice} />
              <section className="note-section">
                <p className="meta-label-muted">参考</p>
                <a className="accent-link mt-2" href={note.reference.href} rel="noreferrer" target="_blank">
                  {note.reference.label} <span aria-hidden="true">↗</span>
                </a>
              </section>
            </div>
          </Reveal>
        ))}
      </div>

      {filteredNotes.length === 0 && (
        <Reveal className="note-empty-state glass-card" immediate>
          没有符合当前筛选条件的笔记；可以重置其中一个筛选条件再试试。
        </Reveal>
      )}
    </PageSection>
  )
}

function NoteFilter({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: string) => void
  options: readonly string[]
  value: string
}) {
  return (
    <label className="note-filter-field">
      <span>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function NoteSection({ copy, label }: { copy: string; label: string }) {
  return (
    <section className="note-section">
      <p className="meta-label-muted">{label}</p>
      <p>{copy}</p>
    </section>
  )
}
