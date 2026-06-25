import { useEffect } from 'react'
import { SiteLayout } from './layouts/SiteLayout'
import { siteRoutes, type SitePage } from './lib/routes'
import { AboutPage } from './pages/AboutPage'
import { ContactPage } from './pages/ContactPage'
import { HomePage } from './pages/HomePage'
import { LearningPage } from './pages/LearningPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { scrollToHashTarget } from './lib/hashScroll'

function App({ page }: { page: SitePage }) {
  useEffect(() => {
    const route = siteRoutes[page]
    const description = document.querySelector('meta[name="description"]')

    document.title = route.title
    description?.setAttribute('content', route.description)
  }, [page])

  useEffect(() => {
    scrollToHashTarget()

    const frameId = window.requestAnimationFrame(() => {
      scrollToHashTarget()
    })
    const timeoutId = window.setTimeout(() => {
      scrollToHashTarget()
    }, 100)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(timeoutId)
    }
  }, [page])

  return (
    <SiteLayout page={page}>{getPageContent(page)}</SiteLayout>
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
