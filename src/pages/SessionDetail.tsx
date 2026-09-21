import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Decision } from '../components/Decision'
import { IconBack, IconTrash } from '../components/Icons'
import { discardSession, setsOfSession } from '../db/queries'
import { db, newId, type Exercise, type ExerciseLog, type Session, type SetEntry } from '../db/schema'
import { fmtClock, fmtDuration, fmtInt, fmtKg, fmtKm, fmtPace, fmtWeekday } from '../lib/format'
import { volumeKg } from '../lib/metrics'
import { formatLine, type Decision as DecisionValue } from '../lib/parse'

const HOUR = 60 * 60 * 1000

function toInputDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** Mantém a hora original, troca só o dia. */
function withDate(ts: number, input: string): number {
  const [y, m, d] = input.split('-').map(Number)
  const orig = new Date(ts)
  return new Date(y, m - 1, d, orig.getHours(), orig.getMinutes(), orig.getSeconds()).getTime()
}
const toNum = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))

export function SessionDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const session = useLiveQuery(() => db.sessions.get(id), [id])
  const sets = useLiveQuery(() => setsOfSession(id), [id])
  const logs = useLiveQuery(() => db.logs.where('sessionId').equals(id).toArray(), [id])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const routine = useLiveQuery(async () => (session?.routineId ? await db.routines.get(session.routineId) : undefined), [session?.routineId])
  const [editing, setEditing] = useState(false)

  if (!session || !sets || !exercises || !logs) return null

  const back = (
    <button type="button" onClick={() => navigate(-1)} className="tap -ml-2 flex items-center gap-1 self-start text-sm text-muted">
      <IconBack width={18} height={18} /> Voltar
    </button>
  )

  if (session.kind === 'run') {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {back}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="label">{fmtWeekday(session.startedAt)}</div>
            <h1 className="font-display text-[24px] font-extrabold tracking-tight">Corrida</h1>
          </div>
          <button type="button" onClick={() => setEditing((v) => !v)} className="min-h-9 rounded-full bg-surface-2 px-4 text-xs font-semibold">
            {editing ? 'Cancelar' : 'Editar'}
          </button>
        </header>
        {editing ? (
          <RunEditor session={session} onDone={() => setEditing(false)} />
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            <Stat label="Distância" value={fmtKm(session.distanceKm ?? 0)} unit="km" />
            <Stat label="Tempo" value={fmtClock((session.durationSec ?? 0) * 1000)} />
            <Stat label="Ritmo" value={fmtPace(session.durationSec ?? 0, session.distanceKm ?? 0)} />
          </div>
        )}
        <button
          type="button"
          onClick={async () => {
            if (!confirm('Apagar esta corrida?')) return
            await discardSession(id)
            navigate('/historico')
          }}
          className="tap mt-2 self-center text-sm font-medium text-muted underline-offset-4 hover:underline"
        >
          Apagar corrida
        </button>
      </div>
    )
  }

  const byId = new Map(exercises.map((e) => [e.id, e]))
  const logByEx = new Map(logs.map((l) => [l.exerciseId, l]))

  const grouped = session.exerciseIds
    .map((exId) => ({ ex: byId.get(exId), list: sets.filter((s) => s.exerciseId === exId), log: logByEx.get(exId) }))
    .filter((g) => g.ex && g.list.length > 0)

  // Exercícios do treino que não foram feitos (nem o principal nem uma alternativa).
  const doneIds = new Set(grouped.map((g) => g.ex!.id))
  const skipped = (routine?.items ?? [])
    .filter((it) => !doneIds.has(it.exerciseId) && !(it.alternativeIds ?? []).some((id) => doneIds.has(id)))
    .map((it) => byId.get(it.exerciseId)?.name)
    .filter(Boolean) as string[]

  const asText = grouped
    .map(({ ex, list, log }) => formatLine(ex!.name, Math.max(...list.map((s) => s.weightKg)), list.map((s) => s.reps), log?.decision ?? null))
    .join('\n')

  async function onDelete() {
    if (!confirm('Apagar este treino e todas as séries? Não dá para desfazer.')) return
    await discardSession(id)
    navigate('/historico')
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(asText)
    } catch {
      /* sem clipboard */
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {back}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label">{fmtWeekday(session.startedAt)}</div>
          <h1 className="font-display text-[24px] font-extrabold tracking-tight">{session.name}</h1>
          <div className="num mt-1 text-sm font-medium text-muted">
            {session.endedAt ? fmtDuration(session.endedAt - session.startedAt) : ''} · {fmtInt(volumeKg(sets))} kg ·{' '}
            {sets.filter((s) => !s.isWarmup).length} séries
          </div>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <button type="button" onClick={onCopy} className="min-h-9 rounded-full bg-surface-2 px-4 text-xs font-semibold">
              Copiar como texto
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={`min-h-9 rounded-full px-4 text-xs font-semibold ${editing ? 'bg-surface-2' : 'bg-accent text-accent-ink'}`}
          >
            {editing ? 'Cancelar' : 'Editar'}
          </button>
        </div>
      </header>

      {editing ? (
        <SessionEditor
          key={session.updatedAt ?? 0}
          session={session}
          sets={sets}
          logs={logs}
          exercises={exercises}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          <ul className="card flex flex-col divide-y divide-line p-0">
            {grouped.map(({ ex, list, log }) => (
              <li key={ex!.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="font-medium">{ex!.name}</span>
                <span className="flex items-center gap-3">
                  <span className="num text-sm">
                    {fmtKg(Math.max(...list.map((s) => s.weightKg)))} kg{' '}
                    <span className="text-muted">× {list.map((s) => (s.isWarmup ? `${s.reps}a` : s.reps)).join(' · ')}</span>
                  </span>
                  {log?.decision && <Decision value={log.decision} />}
                </span>
              </li>
            ))}
          </ul>

          {skipped.length > 0 && (
            <p className="text-sm text-muted">
              <span className="font-semibold">Pulados:</span> {skipped.join(', ')}
            </p>
          )}

          <button type="button" onClick={onDelete} className="tap mt-2 self-center text-sm font-medium text-muted underline-offset-4 hover:underline">
            Apagar treino
          </button>
        </>
      )}
    </div>
  )
}

interface Row {
  exerciseId: string
  weight: string
  reps: string[]
  decision: DecisionValue | null
}

/** Edição de um treino salvo: carga, reps por série, decisão, exercícios e data. */
function SessionEditor({
  session,
  sets,
  logs,
  exercises,
  onDone,
}: {
  session: Session
  sets: SetEntry[]
  logs: ExerciseLog[]
  exercises: Exercise[]
  onDone: () => void
}) {
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const logByEx = new Map(logs.map((l) => [l.exerciseId, l]))

  const [rows, setRows] = useState<Row[]>(() =>
    session.exerciseIds
      .filter((exId) => byId.has(exId))
      .map((exId) => {
        const list = sets.filter((s) => s.exerciseId === exId && !s.isWarmup).sort((a, b) => a.setNumber - b.setNumber)
        return {
          exerciseId: exId,
          weight: list.length ? String(Math.max(...list.map((s) => s.weightKg))).replace('.', ',') : '',
          reps: list.length ? list.map((s) => String(s.reps)) : ['', ''],
          decision: logByEx.get(exId)?.decision ?? null,
        }
      }),
  )
  const [date, setDate] = useState(() => toInputDate(session.startedAt))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const patch = (i: number, p: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const move = (i: number, dir: -1 | 1) =>
    setRows((rs) => {
      const j = i + dir
      if (j < 0 || j >= rs.length) return rs
      const next = [...rs]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const available = exercises.filter((e) => !rows.some((r) => r.exerciseId === e.id)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  async function onSave() {
    setErr('')
    const prepared = rows.map((r) => ({
      ...r,
      weightKg: toNum(r.weight),
      repsNum: r.reps.map(toNum).filter((n): n is number => n !== null && n > 0),
    }))
    const bad = prepared.find((p) => p.repsNum.length > 0 && (p.weightKg === null || !Number.isFinite(p.weightKg)))
    if (bad) {
      setErr(`${byId.get(bad.exerciseId)?.name}: falta a carga.`)
      return
    }
    const kept = prepared.filter((p) => p.repsNum.length > 0)
    if (kept.length === 0) {
      setErr('Deixe pelo menos um exercício com reps, ou apague o treino.')
      return
    }

    setSaving(true)
    try {
      const startedAt = withDate(session.startedAt, date)
      const duration = session.endedAt ? session.endedAt - session.startedAt : HOUR
      await db.transaction('rw', [db.sessions, db.sets, db.logs], async () => {
        await db.sets.where('sessionId').equals(session.id).delete()
        await db.logs.where('sessionId').equals(session.id).delete()
        let t = startedAt
        for (const p of kept) {
          const entries: SetEntry[] = p.repsNum.map((reps, i) => {
            t += 60 * 1000
            return { id: newId(), sessionId: session.id, exerciseId: p.exerciseId, setNumber: i + 1, weightKg: p.weightKg!, reps, isWarmup: false, doneAt: t }
          })
          await db.sets.bulkAdd(entries)
          await db.logs.add({
            id: newId(),
            sessionId: session.id,
            exerciseId: p.exerciseId,
            decision: p.decision,
            raw: formatLine(byId.get(p.exerciseId)?.name ?? '', p.weightKg!, p.repsNum, p.decision),
          })
        }
        await db.sessions.update(session.id, {
          exerciseIds: kept.map((p) => p.exerciseId),
          startedAt,
          endedAt: startedAt + duration,
          updatedAt: Date.now(),
        })
      })
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 self-start text-sm">
        <span className="label">Dia</span>
        <input id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field h-10 px-3 text-sm" />
      </label>

      <ul className="card flex flex-col divide-y divide-line p-0">
        {rows.map((row, i) => {
          const ex = byId.get(row.exerciseId)
          return (
            <li key={row.exerciseId} className="flex flex-col gap-2 px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[15px] font-semibold">{ex?.name}</span>
                <div className="flex shrink-0 gap-1">
                  <button type="button" aria-label="Subir" onClick={() => move(i, -1)} className="grid size-8 place-items-center rounded-lg bg-surface-2 text-muted">↑</button>
                  <button type="button" aria-label="Descer" onClick={() => move(i, 1)} className="grid size-8 place-items-center rounded-lg bg-surface-2 text-muted">↓</button>
                  <button
                    type="button"
                    aria-label="Remover exercício"
                    onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                    className="grid size-8 place-items-center rounded-lg bg-surface-2 text-muted"
                  >
                    <IconTrash width={16} height={16} />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5">
                  <input
                    id={`ed-w-${i}`}
                    inputMode="decimal"
                    value={row.weight}
                    placeholder="kg"
                    onChange={(e) => patch(i, { weight: e.target.value })}
                    className="field num h-12 w-[72px] text-center text-[17px]"
                    aria-label="Carga em kg"
                  />
                  <span className="text-xs text-muted">kg</span>
                </label>
                <span className="text-muted">×</span>
                {row.reps.map((r, k) => (
                  <input
                    key={k}
                    id={`ed-r-${i}-${k}`}
                    inputMode="numeric"
                    value={r}
                    placeholder="reps"
                    onChange={(e) => {
                      const reps = [...row.reps]
                      reps[k] = e.target.value.replace(/\D/g, '')
                      patch(i, { reps })
                    }}
                    className="field num h-12 w-14 text-center text-[17px]"
                    aria-label={`Reps da série ${k + 1}`}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => patch(i, { reps: [...row.reps, ''] })}
                  className="grid size-9 place-items-center rounded-full bg-surface-2 text-sm font-semibold text-muted"
                  aria-label="Adicionar série"
                >
                  +
                </button>
                {row.reps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => patch(i, { reps: row.reps.slice(0, -1) })}
                    className="grid size-9 place-items-center rounded-full bg-surface-2 text-sm font-semibold text-muted"
                    aria-label="Remover última série"
                  >
                    −
                  </button>
                )}
                <div className="ml-auto flex items-center gap-1">
                  {(['manter', 'aumentar', 'diminuir'] as DecisionValue[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => patch(i, { decision: row.decision === d ? null : d })}
                      className={`rounded-full ${row.decision === d ? '' : 'opacity-40'}`}
                      aria-pressed={row.decision === d}
                    >
                      <Decision value={d} size="md" />
                    </button>
                  ))}
                </div>
              </div>
            </li>
          )
        })}
        <li className="px-3 py-3">
          <select
            id="ed-add"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) setRows((rs) => [...rs, { exerciseId: e.target.value, weight: '', reps: ['', ''], decision: null }])
              e.target.value = ''
            }}
            className="field h-10 w-full px-2 text-sm"
          >
            <option value="">+ Adicionar exercício…</option>
            {available.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </li>
      </ul>

      {err && <p className="text-sm text-warn">{err}</p>}

      <div className="flex items-center gap-3">
        <button type="button" onClick={onSave} disabled={saving} className="tap rounded-full bg-accent px-6 font-semibold text-accent-ink disabled:opacity-45">
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
        <button type="button" onClick={onDone} className="tap rounded-full bg-surface-2 px-5 text-sm font-semibold">
          Cancelar
        </button>
      </div>
    </div>
  )
}

function RunEditor({ session, onDone }: { session: Session; onDone: () => void }) {
  const [date, setDate] = useState(() => toInputDate(session.startedAt))
  const [km, setKm] = useState(() => String(session.distanceKm ?? '').replace('.', ','))
  const [time, setTime] = useState(() => fmtClock((session.durationSec ?? 0) * 1000))
  const [err, setErr] = useState('')

  async function onSave() {
    const distanceKm = toNum(km)
    const parts = time.split(':').map(Number)
    const durationSec = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts.length === 2 ? parts[0] * 60 + parts[1] : NaN
    if (distanceKm === null || !Number.isFinite(distanceKm) || distanceKm <= 0) return setErr('Distância inválida.')
    if (!Number.isFinite(durationSec) || durationSec <= 0) return setErr('Tempo no formato mm:ss ou h:mm:ss.')
    const startedAt = withDate(session.startedAt, date)
    await db.sessions.update(session.id, { startedAt, endedAt: startedAt + durationSec * 1000, distanceKm, durationSec })
    onDone()
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          <span className="label">Dia</span>
          <input id="run-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field h-11 px-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">km</span>
          <input id="run-km" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} className="field num h-11 px-2 text-center" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Tempo</span>
          <input id="run-time" inputMode="numeric" value={time} onChange={(e) => setTime(e.target.value)} placeholder="28:30" className="field num h-11 px-2 text-center" />
        </label>
      </div>
      {err && <p className="text-sm text-warn">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onSave} className="tap rounded-full bg-accent px-6 font-semibold text-accent-ink">
          Salvar
        </button>
        <button type="button" onClick={onDone} className="tap rounded-full bg-surface-2 px-5 text-sm font-semibold">
          Cancelar
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="card p-3">
      <div className="label">{label}</div>
      <div className="num mt-0.5 text-[24px] font-extrabold tracking-tight">
        {value}
        {unit && <small className="ml-1 text-[13px] text-muted">{unit}</small>}
      </div>
    </div>
  )
}
