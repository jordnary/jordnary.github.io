import { useEffect, useState, type ReactNode } from 'react'
import { Footer } from '../components/Footer'
import { Live2DCompanion } from '../components/Live2DCompanion'
import { Navbar } from '../components/Navbar'
import { ScrollProgress } from '../components/ScrollProgress'
import { SiteSearch } from '../components/SiteSearch'
import type { SitePage } from '../lib/routes'

type SiteLayoutProps = {
  children: ReactNode
  page: SitePage
}

export function SiteLayout({ children, page }: SiteLayoutProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isPortalMode, setIsPortalMode] = useState(() => page === 'home' && isPortalPath())

  useEffect(() => {
    const updateMode = () => setIsPortalMode(page === 'home' && isPortalPath())
    window.addEventListener('hashchange', updateMode)
    return () => window.removeEventListener('hashchange', updateMode)
  }, [page])

  return (
    <div className={`app-shell${isSearchOpen ? ' is-search-open' : ''}`}>
      <div className="app-shell-content">
        <div className="ambient-bg" />
        <div className="grid-bg" />
        {!isPortalMode && <ScrollProgress />}

        {!isPortalMode && <Navbar activePage={page} onSearchOpen={() => setIsSearchOpen(true)} />}

        <main tabIndex={-1}>{children}</main>

        {!isPortalMode && <Footer />}
      </div>
      {!isPortalMode && <Live2DCompanion page={page} suspended={isSearchOpen} />}
      {!isPortalMode && <SiteSearch
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onOpen={() => setIsSearchOpen(true)}
        />}
    </div>
  )
}

function isPortalPath() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
  const currentPath = window.location.pathname.replace(/\/$/, '')
  return currentPath === basePath
}
