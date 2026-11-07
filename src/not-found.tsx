import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type {} from './lib/pageStartup'
import { NotFoundPage } from './pages/NotFoundPage'
import './index.css'

// A missing URL stays in the address bar. Ordinary links leave this standalone
// document, so neither the route matcher nor browser history needs a fake route.
if (!window.__siteStartup?.failed) createRoot(document.getElementById('site-scroll')!).render(
  <StrictMode><NotFoundPage /></StrictMode>,
)
