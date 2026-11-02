import { lazy, Suspense, useEffect, useLayoutEffect } from 'react'
import { SiteLayout } from './layouts/SiteLayout'
import { getProjectFromUrl, getProjectStudioHref, isHomepagePortalUrl, isProjectStudioUrl, projectStudioRoute, siteRoutes, type SitePage } from './lib/routes'
import { pageLoaders, preparePage } from './lib/page-loaders'
import { useSiteNavigation } from './lib/useSiteNavigation'
import { ProjectPageTransition } from './components/ProjectPageTransition'
import { ProjectsCursor } from './components/ProjectsCursor'
import { useInputModality } from './lib/useInputModality'

const HomepagePortal = lazy(pageLoaders.portal)
const HomePage = lazy(pageLoaders.home)
const AboutPage = lazy(pageLoaders.about)
const LearningPage = lazy(pageLoaders.learning)
const ProjectsPage = lazy(pageLoaders.projects)
const ContactPage = lazy(pageLoaders.contact)
const ProjectStudioPage = lazy(pageLoaders.studio)
const ProjectDetailPage = lazy(pageLoaders.detail)

function App({ page: initialPage }: { page: SitePage }) {
  useInputModality()
  const { page, href, transition } = useSiteNavigation(initialPage, preparePage)
  const project = getProjectFromUrl(new URL(href))
  const isStudio = isProjectStudioUrl(new URL(href))
  const isProjectArchive = page === 'projects' && !project && !isStudio

  useLayoutEffect(() => {
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    if (!viewport) return
    // Keep direct entry and client-side navigation on the same viewport policy.
    const content = viewport.content.split(',').map(value => value.trim())
      .filter(value => value && !value.startsWith('viewport-fit='))
    if (isProjectArchive) content.push('viewport-fit=cover')
    viewport.content = content.join(', ')
  }, [isProjectArchive])

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
      <Suspense fallback={<div className="site-container" role="status" style={{ padding: '4rem 1rem', minHeight: '70vh' }}>正在打开页面…</div>}>
        <SiteLayout page={page} href={href} transitioning={Boolean(transition)} isProjectDetail={Boolean(project)}>{isStudio ? <ProjectStudioPage /> : project ? <ProjectDetailPage key={project.id} project={project} href={href} /> : getPageContent(page, href)}</SiteLayout>
        <PageReady href={href} />
      </Suspense>
      {transition && <ProjectPageTransition key={transition.id} initiallyCovered={transition.initiallyCovered} onCovered={transition.onCovered} onComplete={transition.onComplete} />}
      <ProjectsCursor />
    </>
  )
}

function PageReady({ href }: { href: string }) {
  useEffect(() => {
    // A deferred route can commit after the navigation hook's first scroll restore.
    window.dispatchEvent(new Event('site-page-ready'))
  }, [href])
  return null
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
      return isHomepagePortalUrl(new URL(href)) ? <HomepagePortal /> : <HomePage />
  }
}

export default App
