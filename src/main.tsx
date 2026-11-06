import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { getPageFromDocument } from './lib/routes.ts'
import { trackPagePreloadErrors } from './lib/page-loaders'
import type {} from './lib/pageStartup'

const stopTracking = trackPagePreloadErrors()
if (import.meta.hot) import.meta.hot.dispose(stopTracking)

// Mount the shell immediately. Route imports still wait for Vite's stylesheets.
// An entry failure is reported by the independent HTML guard; refresh retries it.
if (!window.__siteStartup?.failed) createRoot(document.getElementById('site-scroll')!).render(
  <StrictMode>
    <App page={getPageFromDocument()} />
  </StrictMode>,
)
