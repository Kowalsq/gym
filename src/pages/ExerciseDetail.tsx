import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router'
import { IconBack } from '../components/Icons'
import { allSetsOfExercise } from '../db/queries'
import { db } from '../db/schema'
import { EQUIPMENT_LABEL, MUSCLE_LABEL, fmtDayMonth, fmtKg } from '../lib/format'
import { records } from '../lib/metrics'

export function ExerciseDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const exercise = useLiveQuery(() => db.exercises.get(id), [id])
  const sets = useLiveQuery(() => allSetsOfExercise(id), [id])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])

  if (!exercise || !sets || !sessions) return null
  const rec = records(sets)
  const sessionById = new Map(sessions.map((s) => [s.id, s]))

  // Agrupa por sessão, mais recente primeiro, até 8.
  const bySession = new Map<string, typeof sets>()
  for (const s of sets) bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s])
  const recent = [...bySession.entries()]
    .map(([sid, list]) => ({ session: sessionById.get(sid), list: list.sort((a, b) => a.setNumber - b.setNumber) }))
    .filter((g) => g.session?.endedAt)
    .sort((a, b) => b.session!.startedAt - a.session!.startedAt)
    .slice(0, 8)

  const setCount = sets.length

  async function onDelete() {
    if (setCount > 0) {
      alert('Este exercício tem séries registradas. Apague as sessões primeiro.')
      return
    }
    if (!confirm(`Apagar ${exercise!.name}?`)) return
    await db.exercises.delete(id)
    navigate('/exercicios')
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => navigate(-1)} className="tap -ml-2 flex items-center gap-1 self-start text-sm text-muted">
        <IconBack width={18} height={18} /> Exercícios
      </button>
      <header>
        <div className="label">
          {MUSCLE_LABEL[exercise.muscleGroup]} · {EQUIPMENT_LABEL[exercise.equipment]}
        </div>
        <h1 className="font-display text-[24px] font-extrabold tracking-tight">{exercise.name}</h1>
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="card p-3">
          <div className="label">PR de carga</div>
          <div className="num mt-0.5 text-[26px] font-extrabold tracking-tight">
            {fmtKg(rec.maxWeightKg)} <small className="text-[13px] font-semibold text-muted">kg</small>
          </div>
        </div>
        <div className="card p-3">
          <div className="label">1RM estimado</div>
          <div className="num mt-0.5 text-[26px] font-extrabold tracking-tight">
            {fmtKg(Math.round(rec.best1RM))} <small className="text-[13px] font-semibold text-muted">kg</small>
          </div>
        </div>
      </div>

      <section>
        <div className="label mb-2">Últimas sessões</div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">Ainda sem registros. Adicione este exercício a um treino.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map(({ session, list }) => (
              <li key={session!.id} className="card flex items-center justify-between py-3">
                <span className="font-semibold">{fmtDayMonth(session!.startedAt)}</span>
                <span className="num text-sm">
                  {list.map((s) => `${fmtKg(s.weightKg)} × ${s.reps}`).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button type="button" onClick={onDelete} className="tap mt-4 self-center text-sm font-medium text-muted underline-offset-4 hover:underline">
        Apagar exercício
      </button>
    </div>
  )
}
