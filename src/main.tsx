import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { getPageFromDocument } from './lib/routes.ts'
import { preparePage } from './lib/page-loaders'

// Keep reload input guards mounted while the boot overlay covers a cold route.
// Ordinary first visits wait for the route stylesheet before displaying content.
const initialPage = preparePage(new URL(window.location.href))
if (window.__projectTransitionBoot?.status === 'active') void initialPage?.catch(() => {})
else await initialPage
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App page={getPageFromDocument()} />
  </StrictMode>,
)
