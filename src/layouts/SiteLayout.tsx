import { memo, useCallback, useState, type ReactNode } from 'react'
import { Footer } from '../components/Footer'
import { Live2DCompanion } from '../components/Live2DCompanion'
import { Navbar } from '../components/Navbar'
import { ScrollProgress } from '../components/ScrollProgress'
import { SiteSearch } from '../components/SiteSearch'
import { isHomepagePortalUrl, type SitePage } from '../lib/routes'
import { searchRecovery } from '../lib/search-recovery'

type SiteLayoutProps = {
  children: ReactNode
  page: SitePage
  isProjectDetail?: boolean
  href?: string
  transitioning?: boolean
  pending?: boolean
}

export function SiteLayout({ children, page, isProjectDetail = false, href = window.location.href, transitioning = false, pending = false }: SiteLayoutProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(() => Boolean(searchRecovery()))
  const openSearch = useCallback(() => setIsSearchOpen(true), [])
  const closeSearch = useCallback(() => setIsSearchOpen(false), [])
  // Derive portal mode from the current route on every render. Keeping this as
  // state can leave the fixed homepage portal mode active for one render after
  // in-place navigation to a static page, hiding its shared chrome.
  const isPortalMode = page === 'home' && isHomepagePortalUrl(new URL(href))
  const isProjectsExperience = page === 'projects'
  const hasSharedChrome = !isPortalMode && !isProjectsExperience

  return (
    <div inert={transitioning} className={`app-shell${isProjectDetail ? ' app-shell--project-detail' : ''}${hasSharedChrome && isSearchOpen ? ' is-search-open' : ''}`}>
      <ShellContent page={page} shared={hasSharedChrome} pending={pending} onSearchOpen={openSearch}>{children}</ShellContent>
      {hasSharedChrome && <Live2DCompanion page={page} suspended={isSearchOpen} contentReady={!pending} />}
      {hasSharedChrome && <SiteSearch
          isOpen={isSearchOpen}
          onClose={closeSearch}
          onOpen={openSearch}
        />}
    </div>
  )
}

// Opening search only changes its surface, background blur and companion pause.
// Preserve the page/navigation/footer subtree through that local state update.
const ShellContent = memo(function ShellContent({ children, page, shared, pending, onSearchOpen }: {
  children: ReactNode; page: SitePage; shared: boolean; pending: boolean; onSearchOpen: () => void
}) {
  return <div className="app-shell-content">
    {shared && <ScrollProgress />}
    {shared && <Navbar activePage={page} onSearchOpen={onSearchOpen} />}
    <main tabIndex={-1}>{children}</main>
    {shared && !pending && <Footer paperSeam={page === 'about'} />}
  </div>
})
