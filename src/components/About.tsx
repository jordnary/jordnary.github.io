import { useRef } from 'react'
import { SectionBackdrop } from './SectionBackdrop'
import { SmartLink } from './SmartLink'
import { AboutJourneyPath } from './AboutJourneyPath'
import { AboutExplorationArt } from './AboutExplorationArt'
import { aboutProfile } from '../data/profile'
import { getRouteHref } from '../lib/routes'
import './About.css'

const chapters = [
  {
    ...aboutProfile.background,
    paragraphs: [aboutProfile.background.description],
    caption: 'THE BEGINNING',
    symbol: '01',
    tags: ['计算机基础', '数据库', '机器学习'],
  },
  {
    ...aboutProfile.narratives[0],
    caption: 'THE CURIOSITY',
    symbol: '02',
    tags: ['CS', 'AI', 'Web'],
  },
  {
    ...aboutProfile.narratives[1],
    caption: 'THE PRACTICE',
    symbol: '03',
    tags: ['提问', '记录', '验证'],
  },
  {
    ...aboutProfile.direction,
    paragraphs: [aboutProfile.direction.description],
    caption: 'THE PRESENT',
    symbol: '04',
    tags: ['基础知识', 'AI 学习', '小型体验'],
  },
  {
    ...aboutProfile.narratives[2],
    caption: 'THE NEXT CHAPTER',
    symbol: '05',
    tags: ['知识表达', '独立判断', '长期维护'],
  },
]

export function About() {
  const journeyRef = useRef<HTMLOListElement>(null)

  return (
    <section className="about-journey site-container section-surface" id="about" aria-labelledby="about-title">
      <SectionBackdrop tone="sky" edge="none" />
      <header className="journey-cover section-surface">
        <div className="journey-masthead">
          <p><span aria-hidden="true">✳</span> ABOUT ME / MY JOURNEY</p>
          <span>保持好奇，让探索发生</span>
        </div>

        <div className="journey-intro">
          <div className="journey-intro-heading">
            <p className="journey-eyebrow"><span aria-hidden="true" /> 每一步，都算数。</p>
            <h1 id="about-title">
              <span>关于我，</span>
              <span>和一路的<em>探索<svg viewBox="0 0 240 22" preserveAspectRatio="none" fill="none" aria-hidden="true" focusable="false"><path d="M4 15Q106 0 235 9M147 19l74-5" /></svg></em><span className="journey-title-period">。</span></span>
            </h1>
            <p className="journey-handwritten" aria-hidden="true">Always becoming<span>↗</span></p>
          </div>
          <AboutExplorationArt />
        </div>

        <div className="journey-cover-notes">
          <div className="journey-prologue">
            <span className="journey-prologue-glyph" aria-hidden="true">序</span>
            <p className="journey-prologue-label">THE JOURNEY BEGINS</p>
            <a className="journey-scroll-link" href="#journey-start">
              <span className="journey-scroll-title">沿着<em>好奇心</em>，<br />往下走<span className="journey-scroll-icon" aria-hidden="true">↘</span></span>
            </a>
            <svg className="journey-prologue-trail" viewBox="0 0 320 62" fill="none" aria-hidden="true" focusable="false">
              <path d="M2 47C54 47 70 12 126 21S202 65 258 29S302 10 317 14" />
              <path d="M2 55C60 55 79 25 127 31S208 70 269 37" />
              <circle cx="126" cy="21" r="3.5" />
              <path d="M282 5c0 9-3 12-12 12 9 0 12 3 12 12 0-9 3-12 12-12-9 0-12-3-12-12Z" />
            </svg>
          </div>
          <div className="journey-intro-aside">
            <p className="journey-note-index"><span aria-hidden="true">✳</span> 写在旅程开始前</p>
            <p className="journey-intro-copy">{aboutProfile.intro}</p>
            <ul className="journey-keywords" aria-label="个人叙事关键词">
              {aboutProfile.keywords.map((keyword, index) => (
                <li key={keyword}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{keyword}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="journey-cover-colophon" aria-hidden="true"><span>保持好奇 · 持续生长</span><span>A WORK IN PROGRESS</span></div>
      </header>

      <div className="journey-story section-surface">
        <SectionBackdrop decoration="rings-right" />
        <div className="journey-chapter-heading" id="journey-start">
          <p>一点背景，一些想法，一段仍在继续的旅程。</p>
          <span aria-hidden="true">SCROLL TO EXPLORE ↘</span>
        </div>

        <div className="journey-canvas">
          <ol className="journey-chapters" ref={journeyRef} aria-label="我的探索旅程">
            {chapters.map((chapter, index) => (
              <li className="journey-chapter" key={chapter.caption}>
                <span className="journey-node" aria-hidden="true"><span /></span>
                <span className="journey-rail" aria-hidden="true" />
                <article className="journey-card" aria-labelledby={`journey-title-${index}`}>
                  <div className="journey-card-heading">
                    <JourneyNumber value={chapter.symbol} />
                    <div>
                      <p className="journey-card-caption">{chapter.caption}</p>
                      <p className="journey-card-label">{chapter.label}</p>
                    </div>
                    <JourneySymbol index={index} />
                  </div>
                  <h2 id={`journey-title-${index}`}>{chapter.title}</h2>
                  <div className="journey-card-copy">
                    {chapter.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                  </div>
                  <ul className="journey-card-tags" aria-label={`${chapter.label}关键词`}>
                    {chapter.tags.map(tag => <li key={tag}>{tag}</li>)}
                  </ul>
                </article>
              </li>
            ))}
          </ol>
          {/* The list ref must be attached before the controller's layout effect. */}
          <AboutJourneyPath containerRef={journeyRef} />
        </div>
      </div>

      <footer className="journey-outro section-surface">
        <SectionBackdrop tone="sage" />
        <p className="journey-outro-kicker"><span aria-hidden="true" /> TO BE CONTINUED</p>
        <h2>故事还在继续<span>，下一步见。</span></h2>
        <p className="journey-outro-copy">把沿途的思考写成笔记，把新的理解做成作品。</p>
        <div className="journey-next-links">
          <SmartLink className="journey-next-link" href={`${getRouteHref('learning')}#notes`}>
            <span className="journey-next-copy"><small>KEEP LEARNING</small><span className="journey-next-title">阅读学习笔记</span></span>
            <JourneyNextArt kind="notes" />
            <span className="journey-next-note">沿着问题，留下一页思考。</span>
            <span className="journey-next-arrow" aria-hidden="true">↗</span>
          </SmartLink>
          <SmartLink className="journey-next-link journey-next-link-building" href={getRouteHref('projects')}>
            <span className="journey-next-copy"><small>KEEP BUILDING</small><span className="journey-next-title">看看项目实践</span></span>
            <JourneyNextArt kind="projects" />
            <span className="journey-next-note">把新的理解，做成小小作品。</span>
            <span className="journey-next-arrow" aria-hidden="true">↗</span>
          </SmartLink>
        </div>
      </footer>
    </section>
  )
}

function JourneyNextArt({ kind }: { kind: 'notes' | 'projects' }) {
  return (
    <svg className="journey-next-art" viewBox="0 0 112 84" fill="none" aria-hidden="true" focusable="false">
      <ellipse className="journey-next-art-orbit" cx="56" cy="44" rx="49" ry="29" transform="rotate(-18 56 44)" />
      {kind === 'notes' ? (
        <>
          <path className="journey-next-art-wash" d="M22 23c12-3 24 0 34 7 10-7 22-10 34-7v37c-12-3-24 0-34 7-10-7-22-10-34-7Z" />
          <g className="journey-next-art-lines">
            <path d="M22 23c12-3 24 0 34 7 10-7 22-10 34-7v37c-12-3-24 0-34 7-10-7-22-10-34-7Z" />
            <path d="M56 30v37M17 30v35c15-3 26 0 39 6 13-6 24-9 39-6V30" />
            <path d="M30 34c6 0 11 2 17 5m-17 4c6 0 11 2 17 5m-17 4c4 0 8 1 11 3M65 39c5-3 10-5 17-5m-17 14c5-3 10-5 17-5" />
          </g>
          <path className="journey-next-art-detail" d="M73 24V13h9v9l-4-2-5 4Z" />
        </>
      ) : (
        <>
          <path className="journey-next-art-wash" d="m55 20 28 15v29L55 79 27 64V35Z" />
          <g className="journey-next-art-lines">
            <path d="m55 20 28 15-28 15-28-15 28-15Zm-28 15v29l28 15 28-15V35M55 50v29" />
            <path d="m41 28 28 15v13M40 57l-5 3 5 3m29-6 5 3-5 3" />
          </g>
          <g className="journey-next-art-detail">
            <path d="M15 43V18h20M78 72h19V47" strokeDasharray="2 4" />
            <circle cx="15" cy="43" r="2" /><circle cx="97" cy="47" r="2" />
          </g>
        </>
      )}
      <path className="journey-next-art-detail" d="M94 7c0 6-2 8-8 8 6 0 8 2 8 8 0-6 2-8 8-8-6 0-8-2-8-8Z" />
    </svg>
  )
}

function JourneyNumber({ value }: { value: string }) {
  return (
    <span className="journey-number" aria-hidden="true">
      <span className="journey-number-static">{value}</span>
      <span className="journey-number-reels">
        {Array.from(value, (digit, index) => (
          <span className="journey-digit-window" key={index}>
            <span className="journey-digit-reel">
              {Array.from({ length: 3 }, (_, step) => (
                <span className="journey-digit" key={step}>{(Number(digit) + 8 + step) % 10}</span>
              ))}
            </span>
          </span>
        ))}
      </span>
    </span>
  )
}

function JourneySymbol({ index }: { index: number }) {
  const paths = [
    'M8 10h9c5 0 7 3 7 5v25c0-4-4-6-8-6H8V10Zm32 0h-9c-5 0-7 3-7 5v25c0-4 4-6 8-6h8V10Z',
    'M24 5v9m0 20v9M5 24h9m20 0h9M10 10l7 7m14 14 7 7M10 38l7-7m14-14 7-7M24 16l8 8-8 8-8-8 8-8Z',
    'm16 13-11 11 11 11m16-22 11 11-11 11M27 8l-6 32',
    'M24 6a18 18 0 1 0 18 18M24 13a11 11 0 1 0 11 11M24 24 42 6M32 6h10v10',
    'M24 42V25M24 30C10 30 7 18 8 10c12 0 19 6 16 20ZM24 24C24 11 32 6 42 7c0 11-6 18-18 17Z',
  ]
  return <svg className="journey-symbol" viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false"><path d={paths[index]} /></svg>
}
