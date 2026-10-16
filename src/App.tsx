import { lazy, Suspense, useEffect } from 'react'
import { SiteLayout } from './layouts/SiteLayout'
import { getProjectFromUrl, getProjectStudioHref, isProjectStudioUrl, projectStudioRoute, siteRoutes, type SitePage } from './lib/routes'
import { AboutPage } from './pages/AboutPage'
import { ContactPage } from './pages/ContactPage'
import { HomePage } from './pages/HomePage'
import { LearningPage } from './pages/LearningPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ProjectStudioPage } from './pages/ProjectStudioPage'
import { useSiteNavigation } from './lib/useSiteNavigation'
import { ProjectPageTransition } from './components/ProjectPageTransition'

const loadProjectDetail = () => import('./pages/ProjectDetailPage')
const ProjectDetailPage = lazy(loadProjectDetail)
const prepareNavigation = (url: URL) => getProjectFromUrl(url) ? loadProjectDetail() : undefined

function App({ page: initialPage }: { page: SitePage }) {
  const { page, href, transition } = useSiteNavigation(initialPage, prepareNavigation)
  const project = getProjectFromUrl(new URL(href))
  const isStudio = isProjectStudioUrl(new URL(href))
  useEffect(() => {
    const preventMiddleButtonAutoscroll = (event: MouseEvent) => {
      if (event.button === 1) event.preventDefault()
    }
    // Autoscroll starts on mousedown; leave auxclick available for opening links.
    window.addEventListener('mousedown', preventMiddleButtonAutoscroll, { capture: true, passive: false })
    return () => window.removeEventListener('mousedown', preventMiddleButtonAutoscroll, true)
  }, [])

  useEffect(() => {
    const route = isStudio ? projectStudioRoute : siteRoutes[page]
    const description = document.querySelector('meta[name="description"]')

    document.title = project ? `${project.title} | 项目案例` : route.title
    document.body.dataset.page = page
    document.documentElement.lang = isStudio ? 'en' : 'zh-CN'
    description?.setAttribute('content', project?.description ?? route.description)
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `${window.location.origin}${isStudio ? getProjectStudioHref() : new URL(href).pathname}`)
  }, [page, project, href, isStudio])

  return (
    <>
      <SiteLayout page={page} href={href} transitioning={Boolean(transition)} isProjectDetail={Boolean(project)}>{isStudio ? <ProjectStudioPage /> : project ? <Suspense fallback={<div className="site-container" role="status" style={{ padding: '4rem 1rem', minHeight: '70vh' }}>正在打开项目…</div>}><ProjectDetailPage key={project.id} project={project} href={href} /></Suspense> : getPageContent(page, href)}</SiteLayout>
      {transition && <ProjectPageTransition key={transition.id} onCovered={transition.onCovered} onComplete={transition.onComplete} />}
    </>
  )
}

function getPageContent(page: SitePage, href: string) {
  switch (page) {
    case 'about':
      return <AboutPage />
    case 'learning':
      return <LearningPage />
    case 'projects':
      return <ProjectsPage />
    case 'contact':
      return <ContactPage />
    case 'home':
      return <HomePage href={href} />
  }
}

export default App
