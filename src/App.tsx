import { createElement, Suspense, useEffect, useLayoutEffect } from 'react'
import { SiteLayout } from './layouts/SiteLayout'
import { getProjectFromUrl, getProjectStudioHref, isProjectStudioUrl, projectStudioRoute, siteRoutes, type SitePage } from './lib/routes'
import { useSiteNavigation } from './lib/useSiteNavigation'
import { ProjectPageTransition } from './components/ProjectPageTransition'
import { ProjectsCursor } from './components/ProjectsCursor'
import { useInputModality } from './lib/useInputModality'
import { PageLoadFeedback } from './components/PageLoadFeedback'
import { PageErrorBoundary } from './components/PageErrorBoundary'
import type {} from './lib/pageStartup'

function App({ page: initialPage }: { page: SitePage }) {
  useInputModality()
  const { page, href, module, transition, loading, retry, cancel, renderFailed } = useSiteNavigation(initialPage)
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
      <SiteLayout page={page} href={href} transitioning={Boolean(transition)} pending={!module} isProjectDetail={Boolean(project)}>
        <PageErrorBoundary href={href} onError={renderFailed}>
          <Suspense fallback={<PageLoadFeedback state={{ href, status: 'loading' }} />}>
            {module ? <>
              {createElement(module.default, { href, key: project?.id })}
              <PageReady href={href} />
            </> : loading && <PageLoadFeedback state={loading} onRetry={retry} />}
          </Suspense>
        </PageErrorBoundary>
      </SiteLayout>
      {module && loading && <PageLoadFeedback state={loading} floating onRetry={retry} onCancel={cancel} />}
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

export default App
