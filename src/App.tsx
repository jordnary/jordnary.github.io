import { lazy, Suspense, useEffect } from 'react'
import { SiteLayout } from './layouts/SiteLayout'
import { getProjectFromUrl, siteRoutes, type SitePage } from './lib/routes'
import { AboutPage } from './pages/AboutPage'
import { ContactPage } from './pages/ContactPage'
import { HomePage } from './pages/HomePage'
import { LearningPage } from './pages/LearningPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { useSiteNavigation } from './lib/useSiteNavigation'

const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'))

function App({ page: initialPage }: { page: SitePage }) {
  const { page, href } = useSiteNavigation(initialPage)
  const project = getProjectFromUrl(new URL(href))
  useEffect(() => {
    const preventMiddleButtonAutoscroll = (event: MouseEvent) => {
      if (event.button === 1) event.preventDefault()
    }
    // Autoscroll starts on mousedown; leave auxclick available for opening links.
    window.addEventListener('mousedown', preventMiddleButtonAutoscroll, { capture: true, passive: false })
    return () => window.removeEventListener('mousedown', preventMiddleButtonAutoscroll, true)
  }, [])

  useEffect(() => {
    const route = siteRoutes[page]
    const description = document.querySelector('meta[name="description"]')

    document.title = project ? `${project.title} | 项目案例` : route.title
    document.body.dataset.page = page
    description?.setAttribute('content', project?.description ?? route.description)
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', `${window.location.origin}${new URL(href).pathname}`)
  }, [page, project, href])

  return (
    <SiteLayout page={page} isProjectDetail={Boolean(project)}>{project ? <Suspense fallback={<div className="site-container" role="status" style={{ padding: '4rem 1rem', minHeight: '70vh' }}>正在打开项目…</div>}><ProjectDetailPage key={project.id} project={project} /></Suspense> : getPageContent(page)}</SiteLayout>
  )
}

function getPageContent(page: SitePage) {
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
      return <HomePage />
  }
}

export default App
