import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { activeSession, finishedSessions, startSession } from '../db/queries'
import { db, type SetEntry } from '../db/schema'
import { fmtDayMonth, fmtDuration, fmtInt, fmtWeekday } from '../lib/format'
import { volumeKg } from '../lib/metrics'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function startOfWeek(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d.getTime()
}

export function Home() {
  const navigate = useNavigate()
  const active = useLiveQuery(activeSession)
  const recent = useLiveQuery(() => finishedSessions(30), [])
  const last = recent?.[0]
  const lastSets = useLiveQuery(
    () => (last ? db.sets.where('sessionId').equals(last.id).toArray() : Promise.resolve([] as SetEntry[])),
    [last?.id],
  )

  const [now] = useState(() => Date.now())
  const weekStart = startOfWeek(now)
  const trainedDays = new Set(
    (recent ?? []).filter((s) => s.startedAt >= weekStart).map((s) => new Date(s.startedAt).getDay()),
  )
  const today = new Date(now).getDay()

  async function onStart() {
    if (active) {
      navigate('/treino')
      return
    }
    const s = await startSession('Treino livre')
    navigate('/treino', { state: { sessionId: s.id } })
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <div className="label">{fmtWeekday(now)}</div>
        <h1 className="font-display text-[28px] font-extrabold tracking-tight">Bora, Felipe</h1>
      </header>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <span className="label">Esta semana</span>
          <span className="label">{trainedDays.size} treino{trainedDays.size === 1 ? '' : 's'}</span>
        </div>
        <div className="flex justify-between gap-1.5">
          {WEEKDAYS.map((w, i) => {
            const on = trainedDays.has(i)
            return (
              <span
                key={i}
                className={`grid size-9 place-items-center rounded-full text-xs font-semibold ${
                  on ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted'
                } ${i === today ? 'outline-2 outline-offset-2 outline-accent' : ''}`}
              >
                {w}
              </span>
            )
          })}
        </div>
      </section>

      <button
        type="button"
        onClick={onStart}
        className="tap rounded-full bg-accent px-6 py-4 text-base font-semibold text-accent-ink active:scale-[.98]"
      >
        {active ? 'Continuar treino em andamento' : 'Iniciar treino'}
      </button>

      <section>
        <div className="label mb-2">Último treino</div>
        {last ? (
          <button
            type="button"
            onClick={() => navigate(`/historico/${last.id}`)}
            className="card grid w-full grid-cols-[46px_1fr] items-center gap-3 text-left"
          >
            <div className="text-center leading-none">
              <div className="font-display text-[22px] font-extrabold">{new Date(last.startedAt).getDate()}</div>
              <div className="label mt-0.5 text-[10px]">{fmtDayMonth(last.startedAt).split(' ')[2] ?? ''}</div>
            </div>
            <div>
              <div className="font-semibold">{last.name}</div>
              <div className="num mt-0.5 text-xs font-medium text-muted">
                {last.endedAt ? fmtDuration(last.endedAt - last.startedAt) : ''} · {fmtInt(volumeKg(lastSets ?? []))} kg
                · {last.exerciseIds.length} exercício{last.exerciseIds.length === 1 ? '' : 's'}
              </div>
            </div>
          </button>
        ) : (
          <p className="text-sm text-muted">Nenhum treino registrado ainda. O primeiro é o mais importante.</p>
        )}
      </section>
    </div>
  )
}
