import { createElement, Suspense, useEffect, useLayoutEffect } from 'react'
import { SiteLayout } from './layouts/SiteLayout'
import { getProjectFromUrl, getProjectStudioHref, isProjectStudioUrl, notFoundRoute, projectStudioRoute, siteRoutes, type AppPage } from './lib/routes'
import { useSiteNavigation } from './lib/useSiteNavigation'
import { ProjectPageTransition } from './components/ProjectPageTransition'
import { ProjectsCursor } from './components/ProjectsCursor'
import { useInputModality } from './lib/useInputModality'
import { PageErrorBoundary } from './components/PageErrorBoundary'
import type {} from './lib/pageStartup'

function App({ page: initialPage }: { page: AppPage }) {
  useInputModality()
  const { page, href, module, renderId, transition, renderFailed } = useSiteNavigation(initialPage)
  const project = getProjectFromUrl(new URL(href))
  const isStudio = isProjectStudioUrl(new URL(href))

  useLayoutEffect(() => { window.__siteStartup?.dispose() }, [])

  useEffect(() => {
    const preventMiddleButtonAutoscroll = (event: MouseEvent) => {
      if (event.button === 1) event.preventDefault()
    }
    // Autoscroll starts on mousedown; leave auxclick available for opening links.
    window.addEventListener('mousedown', preventMiddleButtonAutoscroll, { capture: true, passive: false })
    return () => window.removeEventListener('mousedown', preventMiddleButtonAutoscroll, true)
  }, [])

  useLayoutEffect(() => {
    const route = page === '404' ? notFoundRoute : isStudio ? projectStudioRoute : siteRoutes[page]
    const description = document.querySelector('meta[name="description"]') ?? document.createElement('meta')
    description.setAttribute('name', 'description')
    if (!description.isConnected) document.head.append(description)

    document.title = project ? `${project.title} | 项目案例` : route.title
    document.body.dataset.page = page
    document.documentElement.lang = isStudio ? 'en' : 'zh-CN'
    description.setAttribute('content', project?.description ?? route.description)
    const robots = document.querySelector('meta[name="robots"]')
    const canonical = document.querySelector('link[rel="canonical"]')
    if (page === '404') {
      const noindex = robots ?? document.createElement('meta')
      noindex.setAttribute('name', 'robots')
      noindex.setAttribute('content', 'noindex, follow')
      if (!noindex.isConnected) document.head.append(noindex)
      canonical?.remove()
    } else {
      robots?.remove()
      const link = canonical ?? document.createElement('link')
      link.setAttribute('rel', 'canonical')
      link.setAttribute('href', `${window.location.origin}${isStudio ? getProjectStudioHref() : new URL(href).pathname}`)
      if (!link.isConnected) document.head.append(link)
    }
  }, [page, project, href, isStudio])

  return (
    <>
      <SiteLayout page={page} href={href} transitioning={Boolean(transition)} pending={!module} isProjectDetail={Boolean(project)}>
        <PageErrorBoundary key={renderId} onError={renderFailed}>
          <Suspense fallback={null}>
            {module ? <>
              {createElement(module.default, { href, key: project?.id })}
              <PageReady href={href} />
            </> : null}
          </Suspense>
        </PageErrorBoundary>
      </SiteLayout>
      {transition && <ProjectPageTransition key={transition.id} initiallyCovered={transition.initiallyCovered} onCovered={transition.onCovered} onComplete={transition.onComplete} />}
      <ProjectsCursor />
    </>
  )
}

function PageReady({ href }: { href: string }) {
  useEffect(() => {
    // A deferred route can commit after the navigation hook's first scroll restore.
    window.dispatchEvent(new CustomEvent('site-page-ready', { detail: { href } }))
  }, [href])
  return null
}

export default App
