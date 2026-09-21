import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { IconPlus, IconTrash } from '../components/Icons'
import { db, getSetting, newId, setSetting, type Exercise, type PlanSlot, type Routine, type RoutineItem, type WeekPlan } from '../db/schema'
import { muscleLabel } from '../lib/format'
import { WEEKDAY_LONG, WEEKDAY_SHORT, emptyPlan } from '../lib/plan'

/** Rotinas A, B, C e o plano da semana. */
export function Routines() {
  const routines = useLiveQuery(() => db.routines.orderBy('order').toArray(), [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const plan = useLiveQuery(() => getSetting<WeekPlan>('weekPlan'), [])
  const [editing, setEditing] = useState<string | null>(null)

  if (!routines || !exercises) return null
  const exById = new Map(exercises.map((e) => [e.id, e]))

  async function addRoutine() {
    const name = prompt('Nome do treino (ex.: D)')?.trim()
    if (!name) return
    await db.routines.add({ id: newId(), name, order: routines!.length, items: [] })
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight">Treinos</h1>
          <p className="text-sm text-muted">Seus treinos com alvo de séries, faixa de reps e RIR, e o plano da semana.</p>
        </div>
        <button type="button" onClick={addRoutine} className="flex min-h-10 items-center gap-2 rounded-full bg-surface-2 px-4 text-sm font-semibold">
          <IconPlus width={18} height={18} /> Novo treino
        </button>
      </header>

      <WeekPlanEditor plan={plan ?? emptyPlan()} routines={routines} />

      <div className="grid gap-4 lg:grid-cols-3">
        {routines.map((r) => (
          <RoutineCard
            key={r.id}
            routine={r}
            exById={exById}
            exercises={exercises}
            editing={editing === r.id}
            onToggleEdit={() => setEditing(editing === r.id ? null : r.id)}
          />
        ))}
      </div>

      <p className="text-xs text-muted">
        Compostos: 6–8 reps com RIR 1–2. Isolados: 8–10 ou 10–12 com RIR 0–1. RIR é quantas repetições sobrariam no tanque ao fim da série.
      </p>
    </div>
  )
}

function WeekPlanEditor({ plan, routines }: { plan: WeekPlan; routines: Routine[] }) {
  async function update(day: number, value: string) {
    const slot: PlanSlot = value === 'rest' ? { type: 'rest' } : value === 'run' ? { type: 'run' } : { type: 'routine', routineId: value }
    const next = [...plan] as WeekPlan
    next[day] = slot
    await setSetting('weekPlan', next)
  }
  const value = (s: PlanSlot) => (s.type === 'routine' ? s.routineId : s.type)

  return (
    <section className="card">
      <div className="label mb-3">Semana</div>
      <div className="grid grid-cols-7 gap-1.5">
        {plan.map((slot, day) => {
          const isRoutine = slot.type === 'routine'
          return (
            <label key={day} className="flex flex-col items-center gap-1.5">
              <span className="text-[11px] font-semibold text-muted">
                <span className="lg:hidden">{WEEKDAY_SHORT[day]}</span>
                <span className="hidden lg:inline">{WEEKDAY_LONG[day]}</span>
              </span>
              <select
                id={`plan-${day}`}
                value={value(slot)}
                onChange={(e) => update(day, e.target.value)}
                className={`field h-10 w-full appearance-none px-1 text-center text-sm font-semibold ${
                  isRoutine ? 'bg-accent-soft text-accent' : slot.type === 'run' ? 'bg-chart-2/15 text-chart-2' : 'text-muted'
                }`}
              >
                <option value="rest">—</option>
                <option value="run">Corrida</option>
                {routines.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </div>
    </section>
  )
}

function RoutineCard({
  routine,
  exById,
  exercises,
  editing,
  onToggleEdit,
}: {
  routine: Routine
  exById: Map<string, Exercise>
  exercises: Exercise[]
  editing: boolean
  onToggleEdit: () => void
}) {
  async function patchItem(index: number, patch: Partial<RoutineItem>) {
    const items = routine.items.map((it, i) => (i === index ? { ...it, ...patch } : it))
    await db.routines.update(routine.id, { items })
  }
  async function removeItem(index: number) {
    await db.routines.update(routine.id, { items: routine.items.filter((_, i) => i !== index) })
  }
  async function move(index: number, dir: -1 | 1) {
    const j = index + dir
    if (j < 0 || j >= routine.items.length) return
    const items = [...routine.items]
    ;[items[index], items[j]] = [items[j], items[index]]
    await db.routines.update(routine.id, { items })
  }
  async function addItem(exerciseId: string) {
    if (!exerciseId) return
    const ex = exById.get(exerciseId)
    const compound = !!ex?.isCompound
    const item: RoutineItem = compound
      ? { exerciseId, targetSets: 2, targetRepsMin: 6, targetRepsMax: 8, rirMin: 1, rirMax: 2 }
      : { exerciseId, targetSets: 2, targetRepsMin: 10, targetRepsMax: 12, rirMin: 0, rirMax: 1 }
    await db.routines.update(routine.id, { items: [...routine.items, item] })
  }
  async function rename() {
    const name = prompt('Nome do treino', routine.name)?.trim()
    if (name) await db.routines.update(routine.id, { name })
    const description = prompt('Descrição (opcional)', routine.description ?? '')
    if (description !== null) await db.routines.update(routine.id, { description: description.trim() || undefined })
  }
  async function remove() {
    if (!confirm(`Apagar o treino ${routine.name}? O histórico continua.`)) return
    await db.routines.delete(routine.id)
  }

  const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <section className="card flex flex-col gap-3 p-0">
      <header className="flex items-start justify-between gap-2 px-4 pt-4">
        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="font-display text-[26px] font-extrabold leading-none tracking-tight">Treino {routine.name}</h2>
            <span className="text-xs text-muted">{routine.items.length} exercícios</span>
          </div>
          {routine.description && <p className="mt-1 text-xs text-muted">{routine.description}</p>}
        </div>
        <button type="button" onClick={onToggleEdit} className="min-h-8 rounded-full bg-surface-2 px-3 text-xs font-semibold">
          {editing ? 'Concluir' : 'Editar'}
        </button>
      </header>

      <ol className="flex flex-col divide-y divide-line">
        {routine.items.map((it, i) => {
          const ex = exById.get(it.exerciseId)
          const alts = (it.alternativeIds ?? []).map((id) => exById.get(id)?.name).filter(Boolean)
          return (
            <li key={`${it.exerciseId}-${i}`} className="flex flex-col gap-2 px-4 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to={`/exercicios/${it.exerciseId}`} className="block truncate text-sm font-medium hover:text-accent">
                    {ex?.name ?? 'Exercício removido'}
                    {ex?.isCompound && <span className="ml-1 text-accent">*</span>}
                  </Link>
                  <div className="truncate text-[11px] text-muted">
                    {ex ? muscleLabel(ex.muscleGroup) : ''}
                    {alts.length ? ` · ou ${alts.join(' / ')}` : ''}
                  </div>
                </div>
                {!editing && (
                  <div className="num shrink-0 text-right text-xs">
                    <div>
                      {it.targetSets} × {it.targetRepsMin}–{it.targetRepsMax}
                    </div>
                    {it.rirMin !== undefined && (
                      <div className="text-muted">
                        RIR {it.rirMin}
                        {it.rirMax !== undefined && it.rirMax !== it.rirMin ? `–${it.rirMax}` : ''}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {editing && (
                <div className="grid grid-cols-[repeat(5,minmax(0,1fr))_auto] items-end gap-1.5 text-xs">
                  <Num label="Séries" value={it.targetSets} onChange={(v) => patchItem(i, { targetSets: v })} />
                  <Num label="Reps de" value={it.targetRepsMin} onChange={(v) => patchItem(i, { targetRepsMin: v })} />
                  <Num label="até" value={it.targetRepsMax} onChange={(v) => patchItem(i, { targetRepsMax: v })} />
                  <Num label="RIR de" value={it.rirMin ?? 0} onChange={(v) => patchItem(i, { rirMin: v })} />
                  <Num label="até" value={it.rirMax ?? it.rirMin ?? 0} onChange={(v) => patchItem(i, { rirMax: v })} />
                  <div className="flex gap-1">
                    <button type="button" aria-label="Subir" onClick={() => move(i, -1)} className="grid size-9 place-items-center rounded-lg bg-surface-2 text-muted">↑</button>
                    <button type="button" aria-label="Descer" onClick={() => move(i, 1)} className="grid size-9 place-items-center rounded-lg bg-surface-2 text-muted">↓</button>
                    <button type="button" aria-label="Remover" onClick={() => removeItem(i)} className="grid size-9 place-items-center rounded-lg bg-surface-2 text-muted">
                      <IconTrash width={16} height={16} />
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {editing && (
        <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
          <select id={`add-${routine.id}`} defaultValue="" onChange={(e) => { addItem(e.target.value); e.target.value = '' }} className="field h-10 px-2 text-sm">
            <option value="">+ Adicionar exercício…</option>
            {sorted.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <div className="flex justify-between text-xs">
            <button type="button" onClick={rename} className="font-medium text-muted hover:text-text">Renomear</button>
            <button type="button" onClick={remove} className="font-medium text-muted hover:text-warn">Apagar treino</button>
          </div>
        </div>
      )}
    </section>
  )
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="field num h-9 w-full px-1 text-center text-sm"
      />
    </label>
  )
}
