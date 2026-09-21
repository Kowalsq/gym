import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { IconCheck, IconPlus, IconSearch, IconTrash } from '../components/Icons'
import {
  activeSession,
  addExerciseToSession,
  addSet,
  deleteSet,
  discardSession,
  finishSession,
  previousSets,
  removeExerciseFromSession,
  setsOfSession,
} from '../db/queries'
import { db, type Exercise, type SetEntry } from '../db/schema'
import { EQUIPMENT_LABEL, MUSCLE_LABEL, fmtClock, fmtKg } from '../lib/format'

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function Workout() {
  const navigate = useNavigate()
  const session = useLiveQuery(activeSession)
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const sets = useLiveQuery(() => (session ? setsOfSession(session.id) : Promise.resolve([])), [session?.id])
  const [picking, setPicking] = useState(false)
  const now = useNow(1000)

  const byId = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises])

  if (session === undefined) return null
  if (session === null || !session) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-muted">Nenhum treino em andamento.</p>
        <button type="button" onClick={() => navigate('/')} className="tap rounded-full bg-surface-2 px-5 font-semibold">
          Voltar ao início
        </button>
      </div>
    )
  }

  const setsByExercise = new Map<string, SetEntry[]>()
  for (const s of sets ?? []) {
    const list = setsByExercise.get(s.exerciseId) ?? []
    list.push(s)
    setsByExercise.set(s.exerciseId, list)
  }

  async function onFinish() {
    const total = (sets ?? []).length
    if (total === 0) {
      if (!confirm('Nenhuma série lançada. Descartar este treino?')) return
      await discardSession(session!.id)
    } else {
      await finishSession(session!.id)
    }
    navigate('/')
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top,0px)+14px)] pb-3">
        <div>
          <div className="label">{session.name}</div>
          <div className="num text-[28px] leading-tight">{fmtClock(now - session.startedAt)}</div>
        </div>
        <button
          type="button"
          onClick={onFinish}
          className="tap rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink active:scale-[.98]"
        >
          Concluir
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)]">
        {session.exerciseIds.map((exId) => {
          const ex = byId.get(exId)
          if (!ex) return null
          return (
            <ExerciseBlock
              key={exId}
              sessionId={session.id}
              exercise={ex}
              sets={setsByExercise.get(exId) ?? []}
            />
          )
        })}

        <button
          type="button"
          onClick={() => setPicking(true)}
          className="tap flex items-center justify-center gap-2 rounded-card border border-dashed border-line py-4 font-semibold text-muted"
        >
          <IconPlus /> Adicionar exercício
        </button>
      </div>

      {picking && exercises && (
        <ExercisePicker
          exercises={exercises}
          alreadyIn={new Set(session.exerciseIds)}
          onPick={async (id) => {
            await addExerciseToSession(session.id, id)
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}

function ExerciseBlock({ sessionId, exercise, sets }: { sessionId: string; exercise: Exercise; sets: SetEntry[] }) {
  const previous = useLiveQuery(() => previousSets(exercise.id, sessionId), [exercise.id, sessionId])
  const lastSet = sets[sets.length - 1]
  const prevForNext = previous?.[sets.length]
  const defaultWeight = lastSet?.weightKg ?? prevForNext?.weightKg ?? previous?.[0]?.weightKg ?? 0
  const defaultReps = lastSet?.reps ?? prevForNext?.reps ?? previous?.[0]?.reps ?? 8

  const [weight, setWeight] = useState<string>('')
  const [reps, setReps] = useState<string>('')
  const [warmup, setWarmup] = useState(false)

  const weightValue = weight === '' ? defaultWeight : Number(weight.replace(',', '.'))
  const repsValue = reps === '' ? defaultReps : Number(reps)

  async function onAdd() {
    if (!Number.isFinite(weightValue) || !Number.isFinite(repsValue) || repsValue <= 0) return
    await addSet({ sessionId, exerciseId: exercise.id, weightKg: weightValue, reps: repsValue, isWarmup: warmup })
    setWeight('')
    setReps('')
    setWarmup(false)
  }

  function bump(delta: number) {
    const next = Math.max(0, Math.round((weightValue + delta) * 100) / 100)
    setWeight(String(next))
  }

  return (
    <section className="card">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-[15px] font-semibold">{exercise.name}</div>
          <div className="text-xs text-muted">
            {EQUIPMENT_LABEL[exercise.equipment]} · {MUSCLE_LABEL[exercise.muscleGroup]}
          </div>
        </div>
        <button
          type="button"
          aria-label="Remover exercício do treino"
          onClick={async () => {
            if (sets.length > 0 && !confirm(`Remover ${exercise.name} e suas ${sets.length} séries?`)) return
            await removeExerciseFromSession(sessionId, exercise.id)
          }}
          className="tap grid place-items-center rounded-lg text-muted"
        >
          <IconTrash width={18} height={18} />
        </button>
      </div>

      <div className="grid grid-cols-[22px_1fr_64px_56px_40px] items-center gap-2">
        <div className="label text-[10px]">#</div>
        <div className="label text-[10px]">Anterior</div>
        <div className="label text-center text-[10px]">kg</div>
        <div className="label text-center text-[10px]">Reps</div>
        <div />

        {sets.map((s, i) => (
          <SetRow key={s.id} set={s} prev={previous?.[i]} />
        ))}

        {/* Linha da próxima série */}
        <div className="text-center text-xs font-semibold text-muted">{sets.length + 1}</div>
        <div className="num text-xs font-medium text-muted">
          {prevForNext ? `${fmtKg(prevForNext.weightKg)} × ${prevForNext.reps}` : previous?.length ? '' : '—'}
        </div>
        <input
          id={`w-${exercise.id}`}
          inputMode="decimal"
          value={weight}
          placeholder={fmtKg(defaultWeight)}
          onChange={(e) => setWeight(e.target.value)}
          className="field num h-11 w-full text-center text-[15px] outline-2 outline-accent"
          aria-label="Peso em kg"
        />
        <input
          id={`r-${exercise.id}`}
          inputMode="numeric"
          value={reps}
          placeholder={String(defaultReps)}
          onChange={(e) => setReps(e.target.value.replace(/\D/g, ''))}
          className="field num h-11 w-full text-center text-[15px]"
          aria-label="Repetições"
        />
        <button
          type="button"
          onClick={onAdd}
          aria-label="Concluir série"
          className="grid size-11 place-items-center rounded-field bg-accent text-accent-ink active:scale-[.96]"
        >
          <IconCheck width={18} height={18} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Chip onClick={() => bump(-2.5)}>−2,5</Chip>
        <Chip onClick={() => bump(2.5)}>+2,5</Chip>
        <Chip active={warmup} onClick={() => setWarmup((v) => !v)}>
          Aquecimento
        </Chip>
      </div>
    </section>
  )
}

function SetRow({ set, prev }: { set: SetEntry; prev?: SetEntry }) {
  return (
    <>
      <div className="text-center text-xs font-semibold text-muted">{set.isWarmup ? 'A' : set.setNumber}</div>
      <div className="num text-xs font-medium text-muted">{prev ? `${fmtKg(prev.weightKg)} × ${prev.reps}` : ''}</div>
      <div className="num flex h-11 items-center justify-center rounded-field bg-accent-soft text-[15px]">
        {fmtKg(set.weightKg)}
      </div>
      <div className="num flex h-11 items-center justify-center rounded-field bg-accent-soft text-[15px]">{set.reps}</div>
      <button
        type="button"
        aria-label="Apagar série"
        onClick={() => deleteSet(set.id)}
        className="grid size-11 place-items-center rounded-field bg-accent text-accent-ink"
      >
        <IconCheck width={18} height={18} />
      </button>
    </>
  )
}

function Chip({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 rounded-full px-3 text-xs font-medium ${
        active ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text'
      }`}
    >
      {children}
    </button>
  )
}

function ExercisePicker({
  exercises,
  alreadyIn,
  onPick,
  onClose,
}: {
  exercises: Exercise[]
  alreadyIn: Set<string>
  onPick: (id: string) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const list = exercises
    .filter((e) => !alreadyIn.has(e.id))
    .filter((e) => norm(e.name).includes(norm(q)))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-bg">
      <div className="flex items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top,0px)+14px)] pb-3">
        <div className="field flex flex-1 items-center gap-2 px-3">
          <IconSearch width={18} height={18} className="text-muted" />
          <input
            id="picker-q"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar exercício"
            className="h-11 w-full bg-transparent outline-0"
          />
        </div>
        <button type="button" onClick={onClose} className="tap rounded-full bg-surface-2 px-4 text-sm font-semibold">
          Fechar
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto px-4 pb-6">
        {list.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onPick(e.id)}
              className="tap flex w-full items-center justify-between border-b border-line py-3 text-left"
            >
              <span className="font-medium">{e.name}</span>
              <span className="text-xs text-muted">{MUSCLE_LABEL[e.muscleGroup]}</span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="py-6 text-center text-sm text-muted">Nada encontrado. Cadastre em Exercícios.</li>}
      </ul>
    </div>
  )
}
