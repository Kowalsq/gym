import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { IconPlus, IconSearch } from '../components/Icons'
import { db, newId, type Equipment, type MuscleGroup } from '../db/schema'
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '../lib/format'

const GROUPS = Object.keys(MUSCLE_LABEL) as MuscleGroup[]
const EQUIPMENTS = Object.keys(EQUIPMENT_LABEL) as Equipment[]

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function Exercises() {
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<MuscleGroup | ''>('')
  const [creating, setCreating] = useState(false)

  const list = (exercises ?? [])
    .filter((e) => (group ? e.muscleGroup === group : true))
    .filter((e) => norm(e.name).includes(norm(q)))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[28px] font-extrabold tracking-tight">Exercícios</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label="Novo exercício"
          className="grid size-11 place-items-center rounded-full bg-accent text-accent-ink"
        >
          <IconPlus />
        </button>
      </div>

      <div className="field flex items-center gap-2 px-3">
        <IconSearch width={18} height={18} className="text-muted" />
        <input
          id="ex-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar"
          className="h-11 w-full bg-transparent outline-0"
        />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <FilterChip active={group === ''} onClick={() => setGroup('')}>
          Todos
        </FilterChip>
        {GROUPS.map((g) => (
          <FilterChip key={g} active={group === g} onClick={() => setGroup(g)}>
            {MUSCLE_LABEL[g]}
          </FilterChip>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {list.map((e) => (
          <li key={e.id}>
            <Link to={`/exercicios/${e.id}`} className="card flex items-center justify-between py-3">
              <div>
                <div className="font-medium">{e.name}</div>
                <div className="text-xs text-muted">
                  {EQUIPMENT_LABEL[e.equipment]} · {MUSCLE_LABEL[e.muscleGroup]}
                </div>
              </div>
              <span className="text-muted">›</span>
            </Link>
          </li>
        ))}
      </ul>

      {creating && <NewExerciseSheet onClose={() => setCreating(false)} />}
    </div>
  )
}

function FilterChip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-medium ${
        active ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text'
      }`}
    >
      {children}
    </button>
  )
}

function NewExerciseSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('peito')
  const [equipment, setEquipment] = useState<Equipment>('barra')

  async function onSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    await db.exercises.add({ id: newId(), name: trimmed, muscleGroup, equipment, createdAt: Date.now() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex flex-col gap-3 rounded-t-2xl bg-surface px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-bold">Novo exercício</h2>
        <label className="flex flex-col gap-1">
          <span className="label">Nome</span>
          <input
            id="new-ex-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Remada unilateral"
            className="field h-12 px-3"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Grupo muscular</span>
          <select id="new-ex-group" value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)} className="field h-12 px-3">
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {MUSCLE_LABEL[g]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Equipamento</span>
          <select id="new-ex-equip" value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)} className="field h-12 px-3">
            {EQUIPMENTS.map((g) => (
              <option key={g} value={g}>
                {EQUIPMENT_LABEL[g]}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-1 flex gap-2">
          <button type="button" onClick={onClose} className="tap flex-1 rounded-full bg-surface-2 font-semibold">
            Cancelar
          </button>
          <button type="button" onClick={onSave} className="tap flex-1 rounded-full bg-accent font-semibold text-accent-ink">
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
