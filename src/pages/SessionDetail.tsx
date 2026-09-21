import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router'
import { IconBack } from '../components/Icons'
import { discardSession, setsOfSession } from '../db/queries'
import { db } from '../db/schema'
import { fmtDuration, fmtInt, fmtKg, fmtWeekday } from '../lib/format'
import { volumeKg } from '../lib/metrics'

export function SessionDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const session = useLiveQuery(() => db.sessions.get(id), [id])
  const sets = useLiveQuery(() => setsOfSession(id), [id])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])

  if (!session || !sets || !exercises) return null
  const byId = new Map(exercises.map((e) => [e.id, e]))

  const grouped = session.exerciseIds
    .map((exId) => ({ ex: byId.get(exId), list: sets.filter((s) => s.exerciseId === exId) }))
    .filter((g) => g.ex && g.list.length > 0)

  async function onDelete() {
    if (!confirm('Apagar este treino e todas as séries? Não dá para desfazer.')) return
    await discardSession(id)
    navigate('/historico')
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => navigate(-1)} className="tap -ml-2 flex items-center gap-1 self-start text-sm text-muted">
        <IconBack width={18} height={18} /> Voltar
      </button>
      <header>
        <div className="label">{fmtWeekday(session.startedAt)}</div>
        <h1 className="font-display text-[24px] font-extrabold tracking-tight">{session.name}</h1>
        <div className="num mt-1 text-sm font-medium text-muted">
          {session.endedAt ? fmtDuration(session.endedAt - session.startedAt) : ''} · {fmtInt(volumeKg(sets))} kg ·{' '}
          {sets.filter((s) => !s.isWarmup).length} séries
        </div>
      </header>

      {grouped.map(({ ex, list }) => (
        <section key={ex!.id} className="card">
          <div className="mb-2 font-semibold">{ex!.name}</div>
          <div className="grid grid-cols-[28px_1fr_1fr] gap-y-1.5 text-sm">
            {list.map((s) => (
              <div key={s.id} className="contents">
                <span className="text-xs font-semibold text-muted">{s.isWarmup ? 'A' : s.setNumber}</span>
                <span className="num">{fmtKg(s.weightKg)} kg</span>
                <span className="num">{s.reps} reps</span>
              </div>
            ))}
          </div>
        </section>
      ))}

      <button type="button" onClick={onDelete} className="tap mt-4 self-center text-sm font-medium text-muted underline-offset-4 hover:underline">
        Apagar treino
      </button>
    </div>
  )
}
