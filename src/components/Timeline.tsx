import { PageSection } from './PageSection'
import { LearningGeometry, type LearningGeometryKind } from './LearningGeometry'
import { timelineItems } from '../data/timeline'

const stageDiagrams: Record<string, { kind: LearningGeometryKind; label: string }> = {
  Now: { kind: 'framework', label: 'UNDERSTAND' },
  Recently: { kind: 'assembly', label: 'BUILD' },
  Next: { kind: 'experiment', label: 'EXPLORE' },
}

export function Timeline() {
  return (
    <PageSection
      id="timeline"
      tone="sage"
      decoration="botanical-right"
      eyebrow="Stage Plan"
      title={<>学到这里，<em>然后呢？</em></>}
      description="把理解带进实践，再带着新的问题回来。下一页，从这些小计划开始。"
    >
      <ol className="timeline-list">
        {timelineItems.map((item, index) => (
          <li className="timeline-row learning-blueprint-panel" key={item.period}>
            <div className="timeline-time learning-panel-meta">
              <p className="meta-label">{item.period} <span>/ {stageDiagrams[item.period]?.label}</span></p>
              <span className="learning-panel-number">[{String(index + 1).padStart(2, '0')}]</span>
            </div>
            <article className="timeline-card">
              <LearningGeometry kind={stageDiagrams[item.period]?.kind ?? 'experiment'} />
              <div className="timeline-card-content">
                <h3 className="card-title">{item.title}</h3>
                <div className="timeline-tag-list">
                  {item.tags.map(tag => <span className="timeline-tag" key={tag}>{tag}</span>)}
                </div>
                <p className="card-copy">{item.description}</p>
                <ul className="timeline-points">
                  {item.points.map(point => <li key={point}>{point}</li>)}
                </ul>
              </div>
            </article>
          </li>
        ))}
      </ol>
      <div className="learning-blueprint-ruler" aria-hidden="true"><span>理解 → 实践 → 再探索</span><span>01 — 03</span></div>
      <div className="learning-loop-note">
        <span aria-hidden="true">↺</span>
        <p>理解 · 实践 · 记录，再带着问题出发。</p>
        <a href="#notes">回到学习笔记 <span aria-hidden="true">↗</span></a>
      </div>
    </PageSection>
  )
}
