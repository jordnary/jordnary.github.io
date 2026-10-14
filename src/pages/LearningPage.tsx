import { Skills } from '../components/Skills'
import { LearningNotes } from '../components/LearningNotes'
import { Timeline } from '../components/Timeline'
import { LearningHeroScene } from '../components/LearningHeroScene'
import { LearningPointerTrail } from '../components/LearningPointerTrail'
import { SectionBackdrop } from '../components/SectionBackdrop'
import './LearningPage.css'

export function LearningPage() {
  return (
    <div className="learning-studio">
      <LearningPointerTrail />
      <header className="learning-cover site-container section-surface">
        <SectionBackdrop tone="paper" edge="none" />
        <div className="learning-masthead"><span>THE LEARNING JOURNAL</span><span>持续记录 · 慢慢理解</span></div>
        <LearningHeroScene />
      </header>
      <Skills />
      <LearningNotes />
      <Timeline />
    </div>
  )
}
