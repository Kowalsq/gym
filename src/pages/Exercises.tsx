import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { IconPlus, IconSearch } from '../components/Icons'
import { db, newId, type Equipment } from '../db/schema'
import { EQUIPMENT_LABEL, muscleLabel } from '../lib/format'

const EQUIPMENTS = Object.keys(EQUIPMENT_LABEL) as Equipment[]
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function Exercises() {
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<string>('')
  const [creating, setCreating] = useState(false)

  const groups = useMemo(
    () => [...new Set((exercises ?? []).map((e) => e.muscleGroup))].sort((a, b) => muscleLabel(a).localeCompare(muscleLabel(b), 'pt-BR')),
    [exercises],
  )

  const list = (exercises ?? [])
    .filter((e) => (group ? e.muscleGroup === group : true))
    .filter((e) => norm(e.name).includes(norm(q)) || (e.aliases ?? []).some((a) => norm(a).includes(norm(q))))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
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
        <input id="ex-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="h-11 w-full bg-transparent outline-0" />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        <FilterChip active={group === ''} onClick={() => setGroup('')}>
          Todos
        </FilterChip>
        {groups.map((g) => (
          <FilterChip key={g} active={group === g} onClick={() => setGroup(g)}>
            {muscleLabel(g)}
          </FilterChip>
        ))}
      </div>

      <ul className="flex flex-col gap-2">
        {list.map((e) => (
          <li key={e.id}>
            <Link to={`/exercicios/${e.id}`} className="card flex items-center justify-between py-3">
              <div>
                <div className="font-medium">
                  {e.name}
                  {e.isCompound && <span className="ml-2 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">composto</span>}
                </div>
                <div className="text-xs text-muted">
                  {EQUIPMENT_LABEL[e.equipment]} · {muscleLabel(e.muscleGroup)}
                  {e.aliases?.length ? ` · também: ${e.aliases.join(', ')}` : ''}
                </div>
              </div>
              <span className="text-muted">›</span>
            </Link>
          </li>
        ))}
      </ul>

      {creating && <NewExerciseSheet groups={groups} onClose={() => setCreating(false)} />}
    </div>
  )
}

function FilterChip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-medium ${active ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text'}`}
    >
      {children}
    </button>
  )
}

function NewExerciseSheet({ groups, onClose }: { groups: string[]; onClose: () => void }) {
  const [name, setName] = useState('')
  const [muscleGroup, setMuscleGroup] = useState('')
  const [equipment, setEquipment] = useState<Equipment>('maquina')
  const [isCompound, setIsCompound] = useState(false)

  async function onSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    await db.exercises.add({
      id: newId(),
      name: trimmed,
      muscleGroup: muscleGroup.trim() || 'Outro',
      equipment,
      isCompound: isCompound || undefined,
      createdAt: Date.now(),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-end bg-black/50 lg:items-center lg:justify-center" onClick={onClose}>
      <div
        className="flex w-full flex-col gap-3 rounded-t-2xl bg-surface px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] lg:max-w-md lg:rounded-2xl lg:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-bold">Novo exercício</h2>
        <label className="flex flex-col gap-1">
          <span className="label">Nome</span>
          <input id="new-ex-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Remada unilateral" className="field h-12 px-3" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Grupo muscular</span>
          <input id="new-ex-group" list="muscle-groups" value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value)} placeholder="Ex.: Costas/Dorsal" className="field h-12 px-3" />
          <datalist id="muscle-groups">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
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
        <label className="flex items-center gap-2 text-sm">
          <input id="new-ex-compound" type="checkbox" checked={isCompound} onChange={(e) => setIsCompound(e.target.checked)} className="size-4 accent-accent" />
          Composto (6–8 reps, RIR 1–2)
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
