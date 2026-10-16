import { useState, type ReactNode } from 'react'
import { Footer } from '../components/Footer'
import { Live2DCompanion } from '../components/Live2DCompanion'
import { Navbar } from '../components/Navbar'
import { ScrollProgress } from '../components/ScrollProgress'
import { SiteSearch } from '../components/SiteSearch'
import { isHomepagePortalUrl, type SitePage } from '../lib/routes'

type SiteLayoutProps = {
  children: ReactNode
  page: SitePage
  isProjectDetail?: boolean
  href?: string
  transitioning?: boolean
}

export function SiteLayout({ children, page, isProjectDetail = false, href = window.location.href, transitioning = false }: SiteLayoutProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  // Derive portal mode from the current route on every render. Keeping this as
  // state can leave the fixed homepage portal mode active for one render after
  // in-place navigation to a static page, hiding its shared chrome.
  const isPortalMode = page === 'home' && isHomepagePortalUrl(new URL(href))
  const isProjectsArchive = page === 'projects' && !isProjectDetail
  const hasSharedChrome = !isPortalMode && !isProjectsArchive

  return (
    <div inert={transitioning} className={`app-shell${isProjectDetail ? ' app-shell--project-detail' : ''}${isSearchOpen ? ' is-search-open' : ''}`}>
      <div className="app-shell-content">
        {hasSharedChrome && <ScrollProgress />}

        {hasSharedChrome && <Navbar activePage={page} onSearchOpen={() => setIsSearchOpen(true)} />}

        <main tabIndex={-1}>{children}</main>

        {hasSharedChrome && <Footer paperSeam={page === 'about'} />}
      </div>
      {hasSharedChrome && <Live2DCompanion page={page} suspended={isSearchOpen} />}
      {hasSharedChrome && <SiteSearch
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onOpen={() => setIsSearchOpen(true)}
        />}
    </div>
  )
}
