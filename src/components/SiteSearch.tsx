import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { clearSearchRecovery, searchRecovery } from '../lib/search-recovery'
import entries from 'virtual:site-search-entries'
import { searchSite } from '../lib/search'
import { SearchResults } from './SiteSearchResults'
import './SiteSearchResults.css'

type SiteSearchProps = { isOpen: boolean; onClose: () => void; onOpen: () => void }
type SearchNavigationMode = 'pointer' | 'keyboard'

export function SiteSearch({ isOpen, onClose, onOpen }: SiteSearchProps) {
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpen()
      }
      if (event.key === 'Escape' && isOpen) { event.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [isOpen, onClose, onOpen])
  return isOpen ? <SearchDialog onClose={onClose} /> : null
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState(() => searchRecovery()?.query ?? '')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [navigationMode, setNavigationMode] = useState<SearchNavigationMode>('pointer')
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const results = useMemo(() => searchSite(entries, query).slice(0, 8), [query])

  useEffect(clearSearchRecovery, [])
  useLayoutEffect(() => {
    const previous = document.activeElement
    const dialog = dialogRef.current
    inputRef.current?.focus({ preventScroll: true })
    return () => {
      // A result navigation may already have moved focus to the next page.
      if (document.activeElement !== document.body && !dialog?.contains(document.activeElement)) return
      const fallback = document.querySelector<HTMLElement>('.nav-search-button')
      if (previous instanceof HTMLElement && previous.isConnected && previous.getClientRects().length && !previous.closest('[inert],dialog:not([open])')) previous.focus({ preventScroll: true })
      else fallback?.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(`site-search-result-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const updateQuery = (value: string) => {
    setQuery(value); setActiveIndex(-1); setNavigationMode('pointer')
  }
  const inputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || !results.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setNavigationMode('keyboard')
      setActiveIndex(index => event.key === 'ArrowDown' ? (index + 1) % results.length
        : index < 0 ? results.length - 1 : (index - 1 + results.length) % results.length)
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault(); document.getElementById(`site-search-result-${activeIndex}`)?.click()
    }
  }
  return <div aria-label="站内搜索" aria-modal="true" className="site-search-backdrop" onMouseDown={onClose} role="dialog">
    <section aria-label="站内搜索" className={`site-search-dialog${navigationMode === 'keyboard' ? ' is-keyboard-navigating' : ''}`}
      ref={dialogRef} onMouseDown={event => event.stopPropagation()} onKeyDown={event => {
        if (event.key !== 'Tab') return
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('input,button,a[href]')]
        const first = controls[0], last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }}>
      <div className="site-search-input-row">
        <SearchIcon />
        <input aria-activedescendant={activeIndex >= 0 ? `site-search-result-${activeIndex}` : undefined}
          aria-label="搜索站内内容" aria-controls={results.length ? 'site-search-results' : undefined} aria-expanded="true" aria-haspopup="listbox"
          className="site-search-input" onChange={event => updateQuery(event.target.value)} onKeyDown={inputKeyDown}
          placeholder="搜索项目、学习内容或页面…" ref={inputRef} role="combobox" type="search" value={query} />
        {query && <button aria-label="清空搜索内容" className="site-search-clear" type="button"
          onClick={() => { updateQuery(''); inputRef.current?.focus() }}><ClearIcon /></button>}
      </div>
      <div aria-live="polite" className="site-search-results">
        <SearchResults results={results} query={query} activeIndex={activeIndex} onClose={onClose}
          onActivate={index => { setNavigationMode('pointer'); setActiveIndex(index) }} />
      </div>
      <div className="site-search-footer">
        <div aria-label="搜索快捷键" className="site-search-shortcuts">
          <span className="site-search-shortcut"><kbd>↑</kbd><kbd>↓</kbd><span>选择</span></span>
          <span className="site-search-shortcut"><kbd>↵</kbd><span>打开</span></span>
          <span className="site-search-shortcut"><kbd>Esc</kbd><span>关闭</span></span>
        </div>
        <button onClick={onClose} type="button">关闭</button>
      </div>
    </section>
  </div>
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m16 16 4.2 4.2" />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 28 24">
      <path d="m4.5 9.2 4.7-4.7h12.1a1.9 1.9 0 0 1 1.9 1.9v11.2a1.9 1.9 0 0 1-1.9 1.9H9.2l-4.7-4.7a4 4 0 0 1 0-5.6Z" />
      <path d="m14.2 9.7 4.1 4.1m0-4.1-4.1 4.1" />
    </svg>
  )
}
