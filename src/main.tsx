import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { LEAFLET_PATCH_VERSION } from './utils/leafletPatch'
import App from './App.tsx'

console.info(`[build] leaflet-patch ${LEAFLET_PATCH_VERSION}`);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
