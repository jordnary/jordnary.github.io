import { Skills } from '../components/Skills'
import { LearningNotes } from '../components/LearningNotes'
import { Timeline } from '../components/Timeline'
import { learningPhotos } from '../data/note-covers'
import './LearningPage.css'

export function LearningPage() {
  return (
    <div className="learning-studio">
      <header className="learning-cover site-container">
        <div className="learning-masthead"><span>THE LEARNING JOURNAL</span><span>持续记录 · 慢慢理解</span></div>
        <div className="learning-cover-layout">
          <div>
            <p className="learning-kicker">在问题与答案之间</p>
            <h1>让好奇，<br />长成自己的<em>知识。</em></h1>
            <p className="learning-cover-copy">从一个没想明白的问题出发，留下推敲、实践与重新理解的痕迹。<br />这里的每一页，都还在生长。</p>
            <a className="learning-cover-link" href="#notes">翻开学习笔记 <span aria-hidden="true">↗</span></a>
          </div>
          <figure className="learning-cover-art">
            <div className="learning-cover-photo-frame"><img src={`${import.meta.env.BASE_URL}images/learning/${learningPhotos.studyDesk.file}`} alt={learningPhotos.studyDesk.alt} width={960} height={1280} fetchPriority="high" /><span className="learning-art-caption">A FIELD GUIDE TO CURIOSITY</span></div>
            <figcaption><span className="learning-art-handwriting">Stay curious. Keep going.</span><a href={learningPhotos.studyDesk.href} target="_blank" rel="noreferrer">{learningPhotos.studyDesk.author} / Unsplash ↗</a></figcaption>
          </figure>
        </div>
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
