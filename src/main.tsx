import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { getPageFromDocument } from './lib/routes.ts'
import { trackPagePreloadErrors } from './lib/page-loaders'
import type {} from './lib/pageStartup'

const stopTracking = trackPagePreloadErrors()
if (import.meta.hot) import.meta.hot.dispose(stopTracking)

// The opening paints independently while its nonblocking entry styles download.
// Route imports retain Vite's stylesheet gate after the shell is mounted.
const mount = () => {
  if (!window.__siteStartup?.failed) createRoot(document.getElementById('site-scroll')!).render(
    <StrictMode>
      <App page={getPageFromDocument()} />
    </StrictMode>,
  )
}
const pendingStyles = [...document.querySelectorAll<HTMLLinkElement>('link[data-opening-styles]')]
  .filter(link => !link.sheet)
if (!pendingStyles.length) mount()
else void Promise.all(pendingStyles.map(link => new Promise<void>(resolve => {
  link.addEventListener('load', () => resolve(), { once: true })
  // The independent HTML guard owns errors; mount() observes its failure flag.
  link.addEventListener('error', () => resolve(), { once: true })
}))).then(mount)
