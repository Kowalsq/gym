import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router'
import { Decision } from '../components/Decision'
import { IconBack } from '../components/Icons'
import { discardSession, setsOfSession } from '../db/queries'
import { db } from '../db/schema'
import { fmtClock, fmtDuration, fmtInt, fmtKg, fmtKm, fmtPace, fmtWeekday } from '../lib/format'
import { volumeKg } from '../lib/metrics'
import { formatLine } from '../lib/parse'

export function SessionDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const session = useLiveQuery(() => db.sessions.get(id), [id])
  const sets = useLiveQuery(() => setsOfSession(id), [id])
  const logs = useLiveQuery(() => db.logs.where('sessionId').equals(id).toArray(), [id])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const routine = useLiveQuery(async () => (session?.routineId ? await db.routines.get(session.routineId) : undefined), [session?.routineId])

  if (!session || !sets || !exercises || !logs) return null

  if (session.kind === 'run') {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <button type="button" onClick={() => navigate(-1)} className="tap -ml-2 flex items-center gap-1 self-start text-sm text-muted">
          <IconBack width={18} height={18} /> Voltar
        </button>
        <header>
          <div className="label">{fmtWeekday(session.startedAt)}</div>
          <h1 className="font-display text-[24px] font-extrabold tracking-tight">Corrida</h1>
        </header>
        <div className="grid grid-cols-3 gap-2.5">
          <div className="card p-3">
            <div className="label">Distância</div>
            <div className="num mt-0.5 text-[24px] font-extrabold tracking-tight">{fmtKm(session.distanceKm ?? 0)} <small className="text-[13px] text-muted">km</small></div>
          </div>
          <div className="card p-3">
            <div className="label">Tempo</div>
            <div className="num mt-0.5 text-[24px] font-extrabold tracking-tight">{fmtClock((session.durationSec ?? 0) * 1000)}</div>
          </div>
          <div className="card p-3">
            <div className="label">Ritmo</div>
            <div className="num mt-0.5 text-[24px] font-extrabold tracking-tight">{fmtPace(session.durationSec ?? 0, session.distanceKm ?? 0)}</div>
          </div>
        </div>
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
      <button type="button" onClick={() => navigate(-1)} className="tap -ml-2 flex items-center gap-1 self-start text-sm text-muted">
        <IconBack width={18} height={18} /> Voltar
      </button>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label">{fmtWeekday(session.startedAt)}</div>
          <h1 className="font-display text-[24px] font-extrabold tracking-tight">{session.name}</h1>
          <div className="num mt-1 text-sm font-medium text-muted">
            {session.endedAt ? fmtDuration(session.endedAt - session.startedAt) : ''} · {fmtInt(volumeKg(sets))} kg ·{' '}
            {sets.filter((s) => !s.isWarmup).length} séries
          </div>
        </div>
        <button type="button" onClick={onCopy} className="min-h-9 rounded-full bg-surface-2 px-4 text-xs font-semibold">
          Copiar como texto
        </button>
      </header>

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
    </div>
  )
}
