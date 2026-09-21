import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Decision } from '../components/Decision'
import { IconBack } from '../components/Icons'
import { LineChart } from '../components/LineChart'
import { db, type Equipment, type MuscleGroup } from '../db/schema'
import { analyze } from '../lib/analysis'
import { EQUIPMENT_LABEL, MUSCLE_LABEL, fmtDayMonth, fmtKg } from '../lib/format'
import { epley1RM } from '../lib/metrics'

const GROUPS = Object.keys(MUSCLE_LABEL) as MuscleGroup[]
const EQUIPMENTS = Object.keys(EQUIPMENT_LABEL) as Equipment[]

export function ExerciseDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const exercise = useLiveQuery(() => db.exercises.get(id), [id])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const sets = useLiveQuery(() => db.sets.where('[exerciseId+doneAt]').between([id, -Infinity], [id, Infinity]).toArray(), [id])
  const logs = useLiveQuery(() => db.logs.where('exerciseId').equals(id).toArray(), [id])
  const [editing, setEditing] = useState(false)

  const summary = useMemo(() => {
    if (!exercise || !sessions || !sets || !logs) return null
    return analyze([exercise], sessions, sets, logs, 0).byExercise.get(id) ?? null
  }, [exercise, sessions, sets, logs, id])

  if (!exercise || !summary) return null
  const points = summary.points
  const maxWeight = Math.max(0, ...points.map((p) => p.maxWeightKg))
  const best1RM = Math.max(0, ...(sets ?? []).filter((s) => !s.isWarmup).map((s) => epley1RM(s.weightKg, s.reps)))
  const recent = [...points].reverse().slice(0, 12)

  async function onDelete() {
    if (points.length > 0) {
      alert('Este exercício tem registros. Apague os treinos primeiro.')
      return
    }
    if (!confirm(`Apagar ${exercise!.name}?`)) return
    await db.exercises.delete(id)
    navigate('/exercicios')
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <button type="button" onClick={() => navigate(-1)} className="tap -ml-2 flex items-center gap-1 self-start text-sm text-muted">
        <IconBack width={18} height={18} /> Voltar
      </button>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label">
            {MUSCLE_LABEL[exercise.muscleGroup]} · {EQUIPMENT_LABEL[exercise.equipment]}
          </div>
          <h1 className="font-display text-[24px] font-extrabold tracking-tight lg:text-[30px]">{exercise.name}</h1>
        </div>
        <button type="button" onClick={() => setEditing((v) => !v)} className="min-h-9 rounded-full bg-surface-2 px-4 text-xs font-semibold">
          {editing ? 'Fechar' : 'Editar'}
        </button>
      </header>

      {editing && (
        <section className="card grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 sm:col-span-3">
            <span className="label">Nome</span>
            <input
              id="ex-name"
              defaultValue={exercise.name}
              onBlur={(e) => e.target.value.trim() && db.exercises.update(id, { name: e.target.value.trim() })}
              className="field h-11 px-3"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Grupo</span>
            <select id="ex-group" value={exercise.muscleGroup} onChange={(e) => db.exercises.update(id, { muscleGroup: e.target.value as MuscleGroup })} className="field h-11 px-3">
              {GROUPS.map((g) => (
                <option key={g} value={g}>{MUSCLE_LABEL[g]}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Equipamento</span>
            <select id="ex-equip" value={exercise.equipment} onChange={(e) => db.exercises.update(id, { equipment: e.target.value as Equipment })} className="field h-11 px-3">
              {EQUIPMENTS.map((g) => (
                <option key={g} value={g}>{EQUIPMENT_LABEL[g]}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-3">
            <span className="label">Anotações fixas (ajuste de banco, pegada…)</span>
            <input
              id="ex-notes"
              defaultValue={exercise.notes ?? ''}
              onBlur={(e) => db.exercises.update(id, { notes: e.target.value.trim() || undefined })}
              className="field h-11 px-3"
            />
          </label>
        </section>
      )}

      {exercise.notes && !editing && <p className="text-sm text-muted">{exercise.notes}</p>}

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Carga atual" value={summary.current ? fmtKg(summary.current.maxWeightKg) : '—'} unit="kg" />
        <Stat label="Recorde" value={fmtKg(maxWeight)} unit="kg" />
        <Stat label="1RM estimado" value={fmtKg(Math.round(best1RM))} unit="kg" />
        <Stat label="Sessões" value={String(points.length)} />
      </div>

      <section className="card flex flex-col gap-2">
        <div className="label">Carga máxima por sessão</div>
        <LineChart
          series={[{ id, name: exercise.name, color: 'var(--chart-1)', points: points.map((p) => ({ x: p.date, y: p.maxWeightKg, detail: `${p.reps.join(' · ')} reps` })) }]}
          height={260}
          formatY={fmtKg}
          unit="kg"
        />
      </section>

      <section>
        <div className="label mb-2">Sessões</div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">
            Ainda sem registros. Anote em <Link to="/anotar" className="font-semibold text-accent">Anotar</Link>.
          </p>
        ) : (
          <ul className="card flex flex-col divide-y divide-line p-0">
            {recent.map((p) => (
              <li key={p.sessionId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <Link to={`/historico/${p.sessionId}`} className="font-medium hover:text-accent">
                  {fmtDayMonth(p.date)}
                </Link>
                <div className="flex items-center gap-3">
                  {p.isPR && <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent">PR</span>}
                  <span className="num text-sm">
                    {fmtKg(p.maxWeightKg)} kg <span className="text-muted">× {p.reps.join(' · ')}</span>
                  </span>
                  {p.decision && <Decision value={p.decision} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button type="button" onClick={onDelete} className="tap mt-2 self-center text-sm font-medium text-muted underline-offset-4 hover:underline">
        Apagar exercício
      </button>
    </div>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="card p-3">
      <div className="label">{label}</div>
      <div className="mt-1 font-display text-[26px] font-extrabold leading-none tracking-tight">
        {value}
        {unit && <span className="ml-1 text-[13px] font-semibold text-muted">{unit}</span>}
      </div>
    </div>
  )
}
