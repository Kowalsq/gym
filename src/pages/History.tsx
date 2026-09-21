import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { finishedSessions } from '../db/queries'
import { db } from '../db/schema'
import { fmtClock, fmtDuration, fmtInt, fmtKm, fmtPace } from '../lib/format'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function History() {
  const sessions = useLiveQuery(() => finishedSessions(300), [])
  const allSets = useLiveQuery(() => db.sets.toArray(), [])
  const routines = useLiveQuery(() => db.routines.toArray(), [])
  const routineSize = new Map((routines ?? []).map((r) => [r.id, r.items.length]))

  const volumeBySession = new Map<string, number>()
  for (const s of allSets ?? []) {
    if (s.isWarmup) continue
    volumeBySession.set(s.sessionId, (volumeBySession.get(s.sessionId) ?? 0) + s.weightKg * s.reps)
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const thisMonth = (sessions ?? []).filter((s) => s.startedAt >= monthStart)
  const gymMonth = thisMonth.filter((s) => s.kind !== 'run')
  const runMonth = thisMonth.filter((s) => s.kind === 'run')
  const runKm = runMonth.reduce((n, s) => n + (s.distanceKm ?? 0), 0)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <h1 className="font-display text-[28px] font-extrabold tracking-tight">Histórico</h1>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="card p-3">
          <div className="label">Treinos em {MONTHS[now.getMonth()]}</div>
          <div className="num mt-0.5 text-[26px] font-extrabold tracking-tight">{gymMonth.length}</div>
        </div>
        <div className="card p-3">
          <div className="label">Corridas em {MONTHS[now.getMonth()]}</div>
          <div className="num mt-0.5 text-[26px] font-extrabold tracking-tight">
            {runMonth.length} {runKm > 0 && <small className="text-[13px] font-semibold text-muted">{fmtKm(Math.round(runKm * 10) / 10)} km</small>}
          </div>
        </div>
      </div>

      <ul className="flex flex-col gap-2.5">
        {(sessions ?? []).map((s) => {
          const d = new Date(s.startedAt)
          const isRun = s.kind === 'run'
          return (
            <li key={s.id}>
              <Link to={`/historico/${s.id}`} className="card grid grid-cols-[46px_1fr] items-center gap-3">
                <div className="text-center leading-none">
                  <div className="font-display text-[22px] font-extrabold">{d.getDate()}</div>
                  <div className="label mt-0.5 text-[10px]">{MONTHS[d.getMonth()]}</div>
                </div>
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    {isRun && <span className="inline-block size-2 rounded-full bg-chart-2" aria-hidden />}
                    {s.name}
                  </div>
                  <div className="num mt-0.5 text-xs font-medium text-muted">
                    {isRun
                      ? `${fmtKm(s.distanceKm ?? 0)} km · ${fmtClock((s.durationSec ?? 0) * 1000)} · ${fmtPace(s.durationSec ?? 0, s.distanceKm ?? 0)}`
                      : `${s.endedAt ? fmtDuration(s.endedAt - s.startedAt) : ''} · ${fmtInt(volumeBySession.get(s.id) ?? 0)} kg · ${s.exerciseIds.length}${s.routineId && routineSize.has(s.routineId) ? ` de ${routineSize.get(s.routineId)}` : ''} exercícios`}
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
        {sessions && sessions.length === 0 && <li className="py-10 text-center text-sm text-muted">Seus treinos e corridas vão aparecer aqui.</li>}
      </ul>
    </div>
  )
}
