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
import { applySnapshot, exportSnapshot, startSyncEngine, syncNow } from './sync/sync'
import { mergeSnapshots } from './sync/merge'

applyTheme(readTheme())

// Exercícios, rotinas A/B/C e plano semanal; não bloqueia a primeira renderização.
void seedProgramIfMissing().then(() => startSyncEngine())

if (import.meta.env.DEV) {
  // Atalhos para testes manuais no console e capturas automatizadas.
  Object.assign(window, {
    __ferro: {
      db,
      importText: async (text: string, defaultDate = Date.now()) =>
        saveParsedDays(parseNotes(text, defaultDate), await db.exercises.toArray()),
      sync: { exportSnapshot, applySnapshot, mergeSnapshots, syncNow },
    },
  })
}

// Em produção o app é servido em /gym/; o roteador precisa saber disso.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
