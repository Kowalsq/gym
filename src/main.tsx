import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App'
import { saveParsedDays } from './db/notes'
import { db } from './db/schema'
import { seedProgramIfMissing } from './db/seed'
import './index.css'
import { parseNotes } from './lib/parse'
import { applyTheme, readTheme } from './lib/theme'

applyTheme(readTheme())

// Exercícios, rotinas A/B/C e plano semanal; não bloqueia a primeira renderização.
void seedProgramIfMissing()

if (import.meta.env.DEV) {
  // Atalhos para testes manuais no console e capturas automatizadas.
  Object.assign(window, {
    __ferro: {
      db,
      importText: async (text: string, defaultDate = Date.now()) =>
        saveParsedDays(parseNotes(text, defaultDate), await db.exercises.toArray()),
    },
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
