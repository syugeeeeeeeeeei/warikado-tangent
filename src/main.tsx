import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// React 18 の createRoot を使ってアプリ全体をマウントする。
// StrictMode により開発時に副作用の安全性を検証しやすくする。
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
