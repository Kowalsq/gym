import { useEffect, useState } from 'react'
import { db } from '../db/schema'
import { formatLine } from '../lib/parse'
import { unitOf } from '../lib/units'
import { applyTheme, readTheme, saveTheme, type Theme } from '../lib/theme'
import { applySnapshot, connect, disconnect, exportSnapshot, syncNow, useSyncStatus } from '../sync/sync'

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=Ferro%20sync'

export function Settings() {
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    applyTheme(theme)
    saveTheme(theme)
  }, [theme])

  async function onExport() {
    const snap = await exportSnapshot()
    download(`ferro-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(snap, null, 2), 'application/json')
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
      if (s.endedAt === undefined || s.kind === 'run') continue
      const d = new Date(s.startedAt)
      const lines = [`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`]
      for (const exId of s.exerciseIds) {
        const list = sets.filter((x) => x.sessionId === s.id && x.exerciseId === exId && !x.isWarmup).sort((a, b) => a.setNumber - b.setNumber)
        const ex = exById.get(exId)
        if (!ex || list.length === 0) continue
        lines.push(formatLine(ex.name, Math.max(...list.map((x) => x.weightKg)), list.map((x) => x.reps), logByKey.get(`${s.id}|${exId}`)?.decision ?? null, unitOf(ex)))
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
      if (!confirm('Importar vai substituir todos os dados atuais neste aparelho e no Gist. Continuar?')) return
      await applySnapshot(data)
      await syncNow({ replaceRemote: true })
      setMsg('Backup importado.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Não foi possível importar.')
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="font-display text-[28px] font-extrabold tracking-tight">Ajustes</h1>

      <SyncSection />

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
        <p className="text-sm text-muted">Backup manual, para guardar ou levar para outro lugar.</p>
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

      <p className="text-center text-xs text-muted">Ferro · v0.2</p>
    </div>
  )
}

function SyncSection() {
  const s = useSyncStatus()
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function onConnect() {
    setBusy(true)
    setErr('')
    try {
      await connect(token)
      setToken('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Não foi possível conectar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="label">Sincronização entre aparelhos</div>
        {s.login && <span className="text-xs text-muted">@{s.login}</span>}
      </div>

      {s.state === 'off' ? (
        <>
          <p className="text-sm text-muted">
            Os dados ficam num Gist privado da sua conta do GitHub. Cole o mesmo token aqui e no outro aparelho e os dois passam a ver a mesma
            coisa. Só precisa da permissão <span className="num">gist</span>.
          </p>
          <a href={TOKEN_URL} target="_blank" rel="noreferrer" className="text-sm font-semibold text-accent">
            Gerar token no GitHub ›
          </a>
          <div className="flex gap-2">
            <input
              id="gh-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_…"
              autoComplete="off"
              className="field h-12 flex-1 px-3"
              aria-label="Token do GitHub"
            />
            <button
              type="button"
              onClick={onConnect}
              disabled={busy || !token.trim()}
              className="tap rounded-full bg-accent px-5 font-semibold text-accent-ink disabled:opacity-45"
            >
              {busy ? 'Conectando…' : 'Conectar'}
            </button>
          </div>
          {err && <p className="text-sm text-warn">{err}</p>}
        </>
      ) : (
        <>
          <p className="text-sm">
            {s.state === 'syncing' && 'Sincronizando…'}
            {s.state === 'idle' && `Sincronizado${s.lastSyncAt ? ` · ${new Date(s.lastSyncAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}.`}
            {(s.state === 'offline' || s.state === 'error') && <span className="text-warn">{s.error}</span>}
          </p>
          <p className="text-xs text-muted">
            Sincroniza sozinho ao abrir, ao voltar para o app e alguns segundos depois de cada treino salvo. No outro aparelho, cole o mesmo token.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => syncNow()} disabled={s.state === 'syncing'} className="tap flex-1 rounded-full bg-surface-2 font-semibold disabled:opacity-45">
              Sincronizar agora
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm('Desconectar deste aparelho? Os dados locais continuam; só param de sincronizar.')) disconnect()
              }}
              className="tap rounded-full bg-surface-2 px-5 text-sm font-semibold text-muted"
            >
              Desconectar
            </button>
          </div>
        </>
      )}
    </section>
  )
}
