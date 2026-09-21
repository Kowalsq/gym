import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { finishedSessions } from '../db/queries'
import { db } from '../db/schema'
import { fmtDuration, fmtInt } from '../lib/format'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function History() {
  const sessions = useLiveQuery(() => finishedSessions(200), [])
  const allSets = useLiveQuery(() => db.sets.toArray(), [])

  const volumeBySession = new Map<string, number>()
  for (const s of allSets ?? []) {
    if (s.isWarmup) continue
    volumeBySession.set(s.sessionId, (volumeBySession.get(s.sessionId) ?? 0) + s.weightKg * s.reps)
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const thisMonth = (sessions ?? []).filter((s) => s.startedAt >= monthStart)
  const monthVolume = thisMonth.reduce((sum, s) => sum + (volumeBySession.get(s.id) ?? 0), 0)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-[28px] font-extrabold tracking-tight">Histórico</h1>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="card p-3">
          <div className="label">{MONTHS[now.getMonth()]}</div>
          <div className="num mt-0.5 text-[26px] font-extrabold tracking-tight">
            {thisMonth.length} <small className="text-[13px] font-semibold text-muted">treino{thisMonth.length === 1 ? '' : 's'}</small>
          </div>
        </div>
        <div className="card p-3">
          <div className="label">Volume</div>
          <div className="num mt-0.5 text-[26px] font-extrabold tracking-tight">
            {monthVolume >= 10000 ? (monthVolume / 1000).toFixed(1).replace('.', ',') : fmtInt(monthVolume)}{' '}
            <small className="text-[13px] font-semibold text-muted">{monthVolume >= 10000 ? 't' : 'kg'}</small>
          </div>
        </div>
      </div>

      <ul className="flex flex-col gap-2.5">
        {(sessions ?? []).map((s) => {
          const d = new Date(s.startedAt)
          return (
            <li key={s.id}>
              <Link to={`/historico/${s.id}`} className="card grid grid-cols-[46px_1fr] items-center gap-3">
                <div className="text-center leading-none">
                  <div className="font-display text-[22px] font-extrabold">{d.getDate()}</div>
                  <div className="label mt-0.5 text-[10px]">{MONTHS[d.getMonth()]}</div>
                </div>
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="num mt-0.5 text-xs font-medium text-muted">
                    {s.endedAt ? fmtDuration(s.endedAt - s.startedAt) : ''} · {fmtInt(volumeBySession.get(s.id) ?? 0)} kg
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
        {sessions && sessions.length === 0 && (
          <li className="py-10 text-center text-sm text-muted">Seus treinos concluídos vão aparecer aqui.</li>
        )}
      </ul>
    </div>
  )
}
