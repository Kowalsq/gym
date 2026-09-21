import { useEffect, useState } from 'react'
import { db } from '../db/schema'
import { formatLine } from '../lib/parse'
import { applyTheme, readTheme, saveTheme, type Theme } from '../lib/theme'

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

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
      logs: await db.logs.toArray(),
    }
    download(`ferro-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json')
    setMsg('Backup exportado.')
  }

  /** Exporta tudo no formato de texto original, um bloco por dia. */
  async function onExportText() {
    const [exercises, sessions, sets, logs] = await Promise.all([
      db.exercises.toArray(),
      db.sessions.orderBy('startedAt').toArray(),
      db.sets.toArray(),
      db.logs.toArray(),
    ])
    const exById = new Map(exercises.map((e) => [e.id, e]))
    const logByKey = new Map(logs.map((l) => [`${l.sessionId}|${l.exerciseId}`, l]))
    const blocks: string[] = []
    for (const s of sessions) {
      if (s.endedAt === undefined) continue
      const d = new Date(s.startedAt)
      const lines = [`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`]
      for (const exId of s.exerciseIds) {
        const list = sets.filter((x) => x.sessionId === s.id && x.exerciseId === exId && !x.isWarmup).sort((a, b) => a.setNumber - b.setNumber)
        const ex = exById.get(exId)
        if (!ex || list.length === 0) continue
        lines.push(formatLine(ex.name, Math.max(...list.map((x) => x.weightKg)), list.map((x) => x.reps), logByKey.get(`${s.id}|${exId}`)?.decision ?? null))
      }
      if (lines.length > 1) blocks.push(lines.join('\n'))
    }
    download(`ferro-treinos-${new Date().toISOString().slice(0, 10)}.txt`, blocks.join('\n\n'), 'text/plain')
    setMsg('Texto exportado.')
  }

  async function onImport(file: File) {
    try {
      const data = JSON.parse(await file.text())
      if (data.app !== 'ferro') throw new Error('Arquivo não é um backup do Ferro.')
      if (!confirm('Importar vai substituir todos os dados atuais. Continuar?')) return
      await db.transaction('rw', db.exercises, db.routines, db.sessions, db.sets, db.logs, async () => {
        await Promise.all([db.exercises.clear(), db.routines.clear(), db.sessions.clear(), db.sets.clear(), db.logs.clear()])
        await db.exercises.bulkAdd(data.exercises ?? [])
        await db.routines.bulkAdd(data.routines ?? [])
        await db.sessions.bulkAdd(data.sessions ?? [])
        await db.sets.bulkAdd(data.sets ?? [])
        await db.logs.bulkAdd(data.logs ?? [])
      })
      setMsg('Backup importado.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Não foi possível importar.')
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
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
        <button type="button" onClick={onExportText} className="tap rounded-full bg-surface-2 font-semibold">
          Exportar como texto (formato do WhatsApp)
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
