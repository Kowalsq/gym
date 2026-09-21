import { useEffect, useState } from 'react'
import { db } from '../db/schema'
import { applyTheme, readTheme, saveTheme, type Theme } from '../lib/theme'

export function Settings() {
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    applyTheme(theme)
    saveTheme(theme)
  }, [theme])

  async function onExport() {
    const data = {
      app: 'ferro',
      version: 1,
      exportedAt: new Date().toISOString(),
      exercises: await db.exercises.toArray(),
      routines: await db.routines.toArray(),
      sessions: await db.sessions.toArray(),
      sets: await db.sets.toArray(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ferro-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMsg('Backup exportado.')
  }

  async function onImport(file: File) {
    try {
      const data = JSON.parse(await file.text())
      if (data.app !== 'ferro') throw new Error('Arquivo não é um backup do Ferro.')
      if (!confirm('Importar vai substituir todos os dados atuais. Continuar?')) return
      await db.transaction('rw', db.exercises, db.routines, db.sessions, db.sets, async () => {
        await Promise.all([db.exercises.clear(), db.routines.clear(), db.sessions.clear(), db.sets.clear()])
        await db.exercises.bulkAdd(data.exercises ?? [])
        await db.routines.bulkAdd(data.routines ?? [])
        await db.sessions.bulkAdd(data.sessions ?? [])
        await db.sets.bulkAdd(data.sets ?? [])
      })
      setMsg('Backup importado.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Não foi possível importar.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-[28px] font-extrabold tracking-tight">Ajustes</h1>

      <section className="card flex flex-col gap-3">
        <div className="label">Tema</div>
        <div className="grid grid-cols-2 gap-2">
          {(['dark', 'light'] as Theme[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`tap rounded-full font-semibold ${theme === t ? 'bg-accent text-accent-ink' : 'bg-surface-2'}`}
            >
              {t === 'dark' ? 'Escuro' : 'Claro'}
            </button>
          ))}
        </div>
      </section>

      <section className="card flex flex-col gap-3">
        <div className="label">Dados</div>
        <p className="text-sm text-muted">Tudo fica só neste aparelho. Exporte um backup de vez em quando.</p>
        <button type="button" onClick={onExport} className="tap rounded-full bg-surface-2 font-semibold">
          Exportar backup (JSON)
        </button>
        <label className="tap flex cursor-pointer items-center justify-center rounded-full bg-surface-2 font-semibold">
          Importar backup
          <input
            id="import-file"
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onImport(f)
              e.target.value = ''
            }}
          />
        </label>
        {msg && <p className="text-sm text-good">{msg}</p>}
      </section>

      <p className="text-center text-xs text-muted">Ferro · v0.1</p>
    </div>
  )
}
