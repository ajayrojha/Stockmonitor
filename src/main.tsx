import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import './index.css'
import './auth/auth.css'
import { AuthProvider } from './auth/AuthProvider'
import { router } from './router'

// Until the Phase 2 backend exists, a mock API runs in the browser (via a
// service worker) and answers /api/* calls. Set VITE_USE_MOCKS=false to talk
// to a real server instead.
async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCKS === 'false') return
  const { worker } = await import('./mocks/browser')
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest: 'bypass', // market data calls go straight to the network
    quiet: import.meta.env.PROD,
  })
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </StrictMode>,
  )
})
