// isomorphic-git (loaded lazily by VaultSync) references Node's Buffer global,
// which browsers don't provide. Shim it here — before any vault code loads —
// using the already-installed `buffer` package.
import { Buffer } from 'buffer'
if (typeof (globalThis as { Buffer?: unknown }).Buffer === 'undefined') {
  ;(globalThis as { Buffer: unknown }).Buffer = Buffer
}
// isomorphic-git also reads process.env / process.platform — provide a minimal
// stand-in so those references don't throw "process is not defined".
if (typeof (globalThis as { process?: unknown }).process === 'undefined') {
  ;(globalThis as { process: unknown }).process = { env: {}, platform: 'browser' }
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
)
