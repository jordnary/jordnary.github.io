import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectCase } from '../data/projects'
import { projectIntroductions } from '../data/project-introductions'
import { ImageGallery, GalleryTrigger, type GalleryImage } from '../components/image-gallery'
import { SmartLink } from '../components/SmartLink'
import { ArtisticLabel } from '../components/ArtisticLabel'
import { SectionBackdrop } from '../components/SectionBackdrop'
import { getRouteHref } from '../lib/routes'
import './ProjectDetailPage.css'

function ReaderArrow({ direction }: { direction: 'left' | 'up' | 'down' }) {
  const paths = {
    left: 'M19 12H5m6-6-6 6 6 6',
    up: 'M12 19V5m-6 6 6-6 6 6',
    down: 'M12 5v14m-6-6 6 6 6-6',
  }
  return <svg className={`project-reader-arrow project-reader-arrow--${direction}`} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={paths[direction]} /></svg>
}

export default function ProjectDetailPage({ project }: { project: ProjectCase }) {
  const { sections } = projectIntroductions[project.id]
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [activeHeading, setActiveHeading] = useState(sections[0].id)
  const [tocOpen, setTocOpen] = useState(false)
  const tocRef = useRef<HTMLElement>(null)
  const activeChapter = Math.max(0, sections.findIndex(section => section.id === activeHeading))
  const base = import.meta.env.BASE_URL
  const images = useMemo<GalleryImage[]>(() => {
    const items = [project.image?.cover, project.image, ...sections.flatMap(section => section.figures ?? [])]
      .filter((image): image is NonNullable<typeof image> => Boolean(image))
    return [...new Map(items.map(image => [image.file, image])).values()].map(image => ({
      src: `${base}images/projects/${image.file}`,
      alt: image.alt, caption: image.caption, title: project.title,
      width: image.width, height: image.height,
      source: project.source.href,
    }))
  }, [base, project, sections])

  useEffect(() => {
    const frame = requestAnimationFrame(() => window.dispatchEvent(new Event('project-document-ready')))
    let scrollFrame = 0
    const update = () => {
      scrollFrame = 0
      let current = sections[0].id
      for (const section of sections) {
        const element = document.getElementById(`project-${section.id}`)
        if (element && element.getBoundingClientRect().top <= 160) current = section.id
      }
      // A short final chapter may never reach the heading threshold.
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
        current = sections[sections.length - 1].id
      }
      setActiveHeading(current)
    }
    const scroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', scroll, { passive: true })
    window.addEventListener('resize', scroll)
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(scrollFrame)
      window.removeEventListener('scroll', scroll)
      window.removeEventListener('resize', scroll)
    }
  }, [sections])

  useEffect(() => {
    const nav = tocRef.current
    const current = nav?.querySelector<HTMLElement>('[aria-current="location"]')
    if (!nav || !current || !nav.clientHeight) return
    const bounds = nav.getBoundingClientRect()
    const item = current.getBoundingClientRect()
    // Keep the selected chapter visible without moving the article itself.
    if (item.top < bounds.top + 8) nav.scrollTop -= bounds.top + 8 - item.top
    else if (item.bottom > bounds.bottom - 8) nav.scrollTop += item.bottom - bounds.bottom + 8
  }, [activeHeading, tocOpen])

  return (
    <div className="project-reader site-container section-surface">
      <SectionBackdrop tone="sky" edge="none" />
      <nav className="project-reader-breadcrumb" aria-label="面包屑">
        <a className="project-reader-button project-reader-button--back" href={getRouteHref('projects')} data-project-return>
          <span className="project-reader-button-icon"><ReaderArrow direction="left" /></span>
          <span>返回项目</span>
        </a>
        <span aria-hidden="true">/</span><ArtisticLabel className="project-reader-category">{project.category}</ArtisticLabel>
      </nav>
      <header id="project-overview" className={`project-reader-header${project.image ? ' has-cover' : ''}`}>
        <div>
          <p className="project-reader-eyebrow">PROJECT / 项目介绍 <span> / {project.status}</span></p>
          <h1>{project.title}</h1>
          <p className="project-reader-subtitle">{project.subtitle}</p>
          <p className="project-reader-description">{project.description}</p>
          <ul className="project-reader-stack" aria-label="技术与方法">{project.stack.map(item => <li key={item}>{item}</li>)}</ul>
          <div className="project-reader-actions">
            <a href="#project-document" className="btn-primary project-reader-read"><span>阅读介绍</span><ReaderArrow direction="down" /></a>
            <SmartLink href={project.repository}>查看仓库 ↗</SmartLink>
            {project.demo && <SmartLink href={project.demo}>访问网站 ↗</SmartLink>}
          </div>
        </div>
        {project.image && <figure className="project-reader-cover">
          <div className="project-reader-cover-image">
            <img src={images[0].src} alt={images[0].alt} width="1600" height="1000" />
            <GalleryTrigger onClick={() => setPreviewIndex(0)} label={`放大查看 ${project.title} 项目图片`} />
          </div>
          <figcaption>{images[0].caption}<span>{images.length} 张图片</span></figcaption>
        </figure>}
      </header>

      <div className="project-reader-layout section-surface">
        <SectionBackdrop decoration="contour-left" />
        <aside className={`project-reader-toc${tocOpen ? ' is-open' : ''}`} aria-label="本页目录">
          <div className="project-reader-toc-heading">
            <svg className="project-reader-toc-orbit" viewBox="0 0 120 120" fill="none" aria-hidden="true">
              <circle cx="60" cy="60" r="43" />
              <circle cx="60" cy="60" r="28" strokeDasharray="2 6" />
              <ellipse cx="60" cy="60" rx="55" ry="18" transform="rotate(-38 60 60)" />
              <path d="M60 8v14m0 76v14M8 60h14m76 0h14" />
              <circle className="project-reader-toc-orbit-node" cx="94" cy="34" r="3" />
              <path className="project-reader-toc-orbit-core" d="m60 52 8 8-8 8-8-8Z" />
            </svg>
            <p className="project-reader-toc-kicker"><span aria-hidden="true" /> CHAPTER INDEX</p>
            <h2 className="project-reader-toc-title">本页目录</h2>
            <button className="project-reader-toc-toggle" type="button" onClick={() => setTocOpen(!tocOpen)} aria-expanded={tocOpen} aria-controls="project-toc-links">
              <span>本页目录</span><span className="project-reader-toc-toggle-icon" aria-hidden="true">{tocOpen ? '−' : '+'}</span>
            </button>
            <p className="project-reader-toc-description">{sections.length} 个章节</p>
          </div>
          <div className="project-reader-toc-position">
            <div className="project-reader-toc-position-label"><span>阅读位置</span><span><strong>{String(activeChapter + 1).padStart(2, '0')}</strong> / {String(sections.length).padStart(2, '0')}</span></div>
            <div className="project-reader-toc-segments" aria-hidden="true">
              {sections.map((section, index) => <span key={section.id} className={index <= activeChapter ? 'is-reached' : undefined} />)}
            </div>
          </div>
          <nav id="project-toc-links" ref={tocRef} aria-label="介绍目录">
            <ol>
              {sections.map((section, index) => <li key={section.id}>
                <a href={`#project-${section.id}`} aria-current={activeHeading === section.id ? 'location' : undefined} onClick={() => setTocOpen(false)}>
                  <span className="project-reader-toc-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <span className="project-reader-toc-link-title">{section.title}</span>
                  <svg className="project-reader-toc-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h9M8 4l4 4-4 4" /></svg>
                </a>
              </li>)}
            </ol>
          </nav>
          <div className="project-reader-toc-footer"><SmartLink className="project-reader-original" href={project.source.href}>{project.source.label}<span aria-hidden="true">↗</span></SmartLink></div>
        </aside>

        <div className="project-reader-main">
          <article className="project-reader-document" id="project-document" aria-label={`${project.title} 项目介绍`}>
            <div className="project-reader-document-meta"><span>项目介绍</span></div>
            <div className="project-introduction">
              {sections.map(section => (
                <section key={section.id} id={`project-${section.id}`} aria-labelledby={`project-${section.id}-title`}>
                  <h2 id={`project-${section.id}-title`}>{section.title}</h2>
                  {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                  {section.figures?.map(figure => {
                    const resultIndex = images.findIndex(image => image.src === `${base}images/projects/${figure.file}`)
                    return <figure className="project-introduction-figure" key={figure.file}>
                      <div className="project-introduction-image">
                        <img src={images[resultIndex].src} alt={figure.alt} width={figure.width} height={figure.height} loading="lazy" decoding="async" />
                        <GalleryTrigger onClick={() => setPreviewIndex(resultIndex)} label={`放大查看：${figure.alt}`} />
                      </div>
                      <figcaption>{figure.caption}</figcaption>
                    </figure>
                  })}
                </section>
              ))}
            </div>
          </article>
          <footer className="project-reader-end">
            <div className="project-reader-end-art" aria-hidden="true">
              <svg className="project-reader-end-flow" viewBox="0 0 800 100" preserveAspectRatio="none" fill="none">
                <g className="project-reader-end-streams">
                  {[
                    'M-40 72C130 78 180 8 350 26S610 98 840 30',
                    'M-40 86C140 92 210 16 365 36S640 110 840 44',
                    'M-40 52C140 98 280 0 470 22S650 80 840 64',
                  ].map(path => <g key={path}>
                    <path className="project-reader-end-stream" d={path} />
                    <path className="project-reader-end-current" d={path} pathLength="1000" />
                  </g>)}
                </g>
              </svg>
              <svg className="project-reader-end-ripples" viewBox="0 0 180 64" fill="none">
                <g><circle cx="90" cy="32" r="13" /><circle cx="90" cy="32" r="6" /></g>
                <g><circle cx="45" cy="22" r="5" /><circle cx="133" cy="43" r="7" /></g>
                <g><circle cx="20" cy="39" r="2" /><circle cx="157" cy="20" r="2.5" /><path d="m114 13 3 3-3 3-3-3Z" /></g>
              </svg>
            </div>
            <div className="project-reader-end-actions">
              <a className="project-reader-button project-reader-button--primary" href={getRouteHref('projects')} data-project-return>
                <span className="project-reader-button-icon"><ReaderArrow direction="left" /></span>
                <span>返回全部项目</span>
              </a>
              <a className="project-reader-button project-reader-button--overview" href="#project-overview">
                <span>回到项目概览</span>
                <span className="project-reader-button-icon"><ReaderArrow direction="up" /></span>
              </a>
            </div>
          </footer>
        </div>
      </div>
      <ImageGallery images={images} activeIndex={previewIndex} onIndexChange={setPreviewIndex} onClose={() => setPreviewIndex(null)} />
    </div>
  )
}
