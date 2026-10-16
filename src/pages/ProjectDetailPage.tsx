import { useEffect, useMemo, useRef, useState } from 'react'
import { projects, type ProjectCase } from '../data/projects'
import { projectIntroductions } from '../data/project-introductions'
import { ImageGallery, type GalleryImage } from '../components/image-gallery'
import { ProjectsCursor } from '../components/ProjectsCursor'
import { SmartLink } from '../components/SmartLink'
import { getRouteHref } from '../lib/routes'
import './ProjectDetailPage.css'

const categoryLabels = {
  'Web 应用': 'Web development',
  '机器学习': 'Machine learning',
  '视觉实验': 'Visual experiment',
}

function ReaderSymbol({ direction }: { direction: 'external' | 'up' }) {
  return <svg className="project-reader-symbol" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d={direction === 'external' ? 'M4 12 12 4M5 4h7v7' : 'M8 13V3M3 8l5-5 5 5'} />
  </svg>
}

function ReaderImageButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="project-reader-image-trigger" type="button" data-project-preview
    aria-label={label} aria-haspopup="dialog" onClick={onClick}>
    <span className="project-reader-image-plus" aria-hidden="true" />
  </button>
}

export default function ProjectDetailPage({ project }: { project: ProjectCase }) {
  const { sections } = projectIntroductions[project.id]
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [activeHeading, setActiveHeading] = useState(sections[0].id)
  const [tocOpen, setTocOpen] = useState(false)
  const tocRef = useRef<HTMLElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const restoreOverflow = useRef<(() => void) | null>(null)
  const activeChapter = Math.max(0, sections.findIndex(section => section.id === activeHeading))
  const projectNumber = String(projects.findIndex(item => item.id === project.id) + 1).padStart(2, '0')
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

  const resetContents = () => {
    if (dialogRef.current?.open) return
    restoreOverflow.current?.()
    restoreOverflow.current = null
    setTocOpen(false)
  }
  const closeContents = () => {
    dialogRef.current?.close()
    // Release the scroll lock before the shared navigation handles a chapter link.
    resetContents()
  }
  const openContents = () => {
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return
    const previousOverflow = document.body.style.overflow
    restoreOverflow.current = () => { document.body.style.overflow = previousOverflow }
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    setTocOpen(true)
  }

  useEffect(() => () => {
    restoreOverflow.current?.()
    restoreOverflow.current = null
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(() => window.dispatchEvent(new Event('project-document-ready')))
    let scrollFrame = 0
    const update = () => {
      scrollFrame = 0
      let current = sections[0].id
      for (const section of sections) {
        const element = document.getElementById(`project-${section.id}`)
        if (element && element.getBoundingClientRect().top <= 98) current = section.id
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
    <div className="project-reader">
      <nav className="project-reader-topbar" aria-label="面包屑">
        <a className="project-reader-back" href={getRouteHref('projects')} data-project-return aria-label="返回项目">
          <span className="project-reader-dash" aria-hidden="true" /><span>Back To Index</span>
        </a>
        <span className="project-reader-edition">Selected works / {projectNumber}</span>
      </nav>

      <header id="project-cover" className={`project-reader-header${project.image ? ' has-cover' : ''}`}>
        <div className="project-reader-heading">
          <p className="project-reader-eyebrow"><span>Selected project</span><span>{projectNumber} / {categoryLabels[project.category]}</span></p>
          <h1>{project.title}</h1>
          <p className="project-reader-subtitle">{project.subtitle}</p>
          <p className="project-reader-status">{project.status}</p>
          <ul className="project-reader-stack" aria-label="技术与方法">{project.stack.map(item => <li key={item}>{item}</li>)}</ul>
          <div className="project-reader-actions">
            <SmartLink href={project.repository} aria-label="查看仓库"><span>Repository</span><ReaderSymbol direction="external" /></SmartLink>
            <SmartLink href={project.source.href} aria-label={project.source.label}><span>Full report</span><ReaderSymbol direction="external" /></SmartLink>
            {project.demo && <SmartLink href={project.demo} aria-label="访问网站"><span>Visit website</span><ReaderSymbol direction="external" /></SmartLink>}
          </div>
        </div>
        {project.image && <figure className="project-reader-cover">
          <div className="project-reader-cover-image">
            <img src={images[0].src} alt={images[0].alt} width={images[0].width} height={images[0].height} fetchPriority="high" />
            <ReaderImageButton onClick={() => setPreviewIndex(0)} label={`放大查看 ${project.title} 项目图片`} />
          </div>
          <figcaption><span>{images[0].caption}</span><span>{String(images.length).padStart(2, '0')} images</span></figcaption>
        </figure>}
      </header>

      <button className="project-reader-toc-toggle" type="button" aria-label="本页目录" aria-haspopup="dialog"
        aria-expanded={tocOpen} aria-controls="project-contents" onClick={openContents}>
        <span className="project-reader-menu-symbol" aria-hidden="true" /><span>Contents</span>
      </button>
      <dialog className="project-reader-toc" id="project-contents" ref={dialogRef} aria-labelledby="project-contents-title"
        onCancel={event => { event.preventDefault(); closeContents() }} onClose={resetContents}
        onClick={event => {
          if (event.target !== event.currentTarget) return
          const bounds = event.currentTarget.getBoundingClientRect()
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeContents()
        }}>
        <div className="project-reader-toc-heading">
          <h2 id="project-contents-title">Contents</h2>
          <button type="button" className="project-reader-toc-close" aria-label="关闭目录" onClick={closeContents} autoFocus>
            <span>Close</span><span className="project-reader-close-symbol" aria-hidden="true" />
          </button>
        </div>
        <p className="project-reader-toc-position"><span>本页目录</span><span>{String(activeChapter + 1).padStart(2, '0')} / {String(sections.length).padStart(2, '0')}</span></p>
        <nav id="project-toc-links" ref={tocRef} aria-label="介绍目录">
          <ol>{sections.map((section, index) => <li key={section.id}>
            <a href={`#project-${section.id}`} aria-current={activeHeading === section.id ? 'location' : undefined} onClick={closeContents}>
              <span className="project-reader-toc-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span>{section.title}</span>
            </a>
          </li>)}</ol>
        </nav>
        <div className="project-reader-toc-footer"><SmartLink href={project.source.href}><span>{project.source.label}</span><ReaderSymbol direction="external" /></SmartLink></div>
      </dialog>

      <div className="project-reader-layout">
        <div className="project-reader-document-meta"><span>The project / 项目介绍</span><span>{String(activeChapter + 1).padStart(2, '0')} / {String(sections.length).padStart(2, '0')}</span></div>
        <div className="project-reader-main">
          <article className="project-reader-document" id="project-document" aria-label={`${project.title} 项目介绍`}>
            <p className="project-reader-description">{project.description}</p>
            <div className="project-introduction">
              {sections.map((section, index) => (
                <section key={section.id} id={`project-${section.id}`} aria-labelledby={`project-${section.id}-title`}>
                  <span className="project-reader-section-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <h2 id={`project-${section.id}-title`}>{section.title}</h2>
                  {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                  {section.figures?.map(figure => {
                    const resultIndex = images.findIndex(image => image.src === `${base}images/projects/${figure.file}`)
                    return <figure className="project-introduction-figure" key={figure.file}>
                      <div className="project-introduction-image">
                        <img src={images[resultIndex].src} alt={figure.alt} width={figure.width} height={figure.height} loading="lazy" decoding="async" />
                        <ReaderImageButton onClick={() => setPreviewIndex(resultIndex)} label={`放大查看：${figure.alt}`} />
                      </div>
                      <figcaption>{figure.caption}</figcaption>
                    </figure>
                  })}
                </section>
              ))}
            </div>
          </article>
          <footer className="project-reader-end">
            <a className="project-reader-back" href={getRouteHref('projects')} data-project-return aria-label="返回全部项目">
              <span className="project-reader-dash" aria-hidden="true" /><span>Back To Index</span>
            </a>
            <a className="project-reader-top" href="#project-cover" aria-label="回到项目概览"><span>Back To Top</span><ReaderSymbol direction="up" /></a>
          </footer>
        </div>
      </div>
      <ImageGallery images={images} activeIndex={previewIndex} onIndexChange={setPreviewIndex} onClose={() => setPreviewIndex(null)} />
      <ProjectsCursor />
    </div>
  )
}
