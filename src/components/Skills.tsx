import { PageSection } from './PageSection'
import { LearningGeometry, type LearningGeometryKind } from './LearningGeometry'
import { skillCategories } from '../data/skills'

const knowledgeDiagrams: Record<string, { kind: LearningGeometryKind; label: string }> = {
  'Computer Science': { kind: 'foundation', label: 'FOUNDATIONS' },
  'AI & Machine Learning': { kind: 'network', label: 'MACHINE LEARNING' },
  'Web Development': { kind: 'layers', label: 'WEB DEVELOPMENT' },
  'Tools & Workflow': { kind: 'orbit', label: 'NOTES & WORKFLOW' },
}

export function Skills() {
  return (
    <PageSection
      id="skills"
      tone="paper"
      edge="none"
      eyebrow="Knowledge Map"
      title={<>循着兴趣，<em>画一张地图。</em></>}
      description="四条仍在延伸的学习路径。把零散的概念连起来，也为下一个问题留出位置。"
    >
      <div className="knowledge-card-grid">
        {skillCategories.map((group, index) => (
          <article
            className="knowledge-card learning-blueprint-panel"
            key={group.title}
          >
            <div className="learning-panel-meta">
              <span>{knowledgeDiagrams[group.icon]?.label ?? 'KEEP LEARNING'}</span>
              <span className="learning-panel-number">[{String(index + 1).padStart(2, '0')}]</span>
            </div>
            <LearningGeometry kind={knowledgeDiagrams[group.icon]?.kind ?? 'foundation'} />
            <header className="knowledge-card-header">
              <h3 className="card-title">{group.title}</h3>
              <p className="card-copy">{group.description}</p>
            </header>

            <ul className="knowledge-item-list">
              {group.items.map((item) => (
                <li className="knowledge-item" key={item.name}>
                  <strong>{item.name}</strong>
                  <span>{item.note}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <div className="learning-blueprint-ruler" aria-hidden="true"><span>从概念出发，向理解延伸</span><span>01 — 04</span></div>
    </PageSection>
  )
}
