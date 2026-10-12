import { Skills } from '../components/Skills'
import { LearningNotes } from '../components/LearningNotes'
import { Timeline } from '../components/Timeline'
import { LearningHeroScene } from '../components/LearningHeroScene'
import { LearningPointerTrail } from '../components/LearningPointerTrail'
import './LearningPage.css'

export function LearningPage() {
  return (
    <div className="learning-studio">
      <LearningPointerTrail />
      <header className="learning-cover site-container">
        <div className="learning-masthead"><span>THE LEARNING JOURNAL</span><span>持续记录 · 慢慢理解</span></div>
        <LearningHeroScene />
        <nav className="learning-contents" aria-label="学习页目录">
          <a href="#skills"><span>01</span> 知识地图 <span aria-hidden="true">↗</span></a>
          <a href="#notes"><span>02</span> 学习笔记 <span aria-hidden="true">↗</span></a>
          <a href="#timeline"><span>03</span> 下一步 <span aria-hidden="true">↗</span></a>
        </nav>
      </header>
      <Skills />
      <LearningNotes />
      <Timeline />
    </div>
  )
}
