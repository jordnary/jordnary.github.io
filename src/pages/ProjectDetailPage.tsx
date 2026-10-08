import { useEffect, useMemo, useState } from 'react'
import type { ProjectCase } from '../data/projects'
import { projectIntroductions } from '../data/project-introductions'
import { ImageGallery, GalleryTrigger, type GalleryImage } from '../components/image-gallery'
import { SmartLink } from '../components/SmartLink'
import { getRouteHref } from '../lib/routes'
import './ProjectDetailPage.css'

export default function ProjectDetailPage({ project }: { project: ProjectCase }) {
  const { sections } = projectIntroductions[project.id]
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [activeHeading, setActiveHeading] = useState('')
  const [tocOpen, setTocOpen] = useState(false)
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
  const readingMinutes = Math.max(1, Math.ceil(sections.reduce(
    (length, section) => length + section.title.length + section.paragraphs.join('').length, 0,
  ) / 400))

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
      setActiveHeading(current)
    }
    const scroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', scroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(scrollFrame)
      window.removeEventListener('scroll', scroll)
    }
  }, [sections])

  return (
    <div className="project-reader site-container">
      <nav className="project-reader-breadcrumb" aria-label="面包屑">
        <a href={getRouteHref('projects')} data-project-return>← 返回项目</a>
        <span aria-hidden="true">/</span><span>{project.category}</span>
      </nav>
      <header className={`project-reader-header${project.image ? ' has-cover' : ''}`}>
        <div>
          <p className="project-reader-eyebrow">PROJECT / 项目介绍 <span> / {project.status}</span></p>
          <h1>{project.title}</h1>
          <p className="project-reader-subtitle">{project.subtitle}</p>
          <p className="project-reader-description">{project.description}</p>
          <ul className="project-reader-stack" aria-label="技术与方法">{project.stack.map(item => <li key={item}>{item}</li>)}</ul>
          <div className="project-reader-actions">
            <a href="#project-document" className="btn-primary">阅读介绍 <span aria-hidden="true">↓</span></a>
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

      <div className="project-reader-layout">
        <aside className={`project-reader-toc${tocOpen ? ' is-open' : ''}`}>
          <div className="project-reader-toc-title">本页目录 <span>CONTENTS</span></div>
          <button className="project-reader-toc-toggle" type="button" onClick={() => setTocOpen(!tocOpen)} aria-expanded={tocOpen} aria-controls="project-toc-links">本页目录 <span aria-hidden="true">{tocOpen ? '−' : '+'}</span></button>
          <nav id="project-toc-links" aria-label="介绍目录">
            {sections.map(section => <a key={section.id} href={`#project-${section.id}`} aria-current={activeHeading === section.id ? 'location' : undefined} onClick={() => setTocOpen(false)}>{section.title}</a>)}
          </nav>
          <SmartLink className="project-reader-original" href={project.source.href}>{project.source.label} ↗</SmartLink>
        </aside>

        <div className="project-reader-main">
          <article className="project-reader-document" id="project-document" aria-label={`${project.title} 项目介绍`}>
            <div className="project-reader-document-meta"><span>项目介绍</span><span>约 {readingMinutes} 分钟</span></div>
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
          <footer className="project-reader-end"><a href={getRouteHref('projects')} data-project-return>← 返回全部项目</a><a href="#project-overview">回到项目概览 ↑</a></footer>
        </div>
      </div>
      <ImageGallery images={images} activeIndex={previewIndex} onIndexChange={setPreviewIndex} onClose={() => setPreviewIndex(null)} />
    </div>
  )
}
