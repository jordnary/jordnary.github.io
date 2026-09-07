import { useState, type ReactNode } from 'react'
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

  return (
    <div className={`app-shell${isSearchOpen ? ' is-search-open' : ''}`}>
      <div className="app-shell-content">
        <div className="ambient-bg" />
        <div className="grid-bg" />
        <ScrollProgress />

        <Navbar activePage={page} onSearchOpen={() => setIsSearchOpen(true)} />

        <main>{children}</main>

        <Footer />
      </div>
      <Live2DCompanion suspended={isSearchOpen} />
      <SiteSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onOpen={() => setIsSearchOpen(true)}
      />
    </div>
  )
}
