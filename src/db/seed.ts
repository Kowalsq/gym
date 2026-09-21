import { normalizeName } from '../lib/parse'
import { db, newId, setSetting, type Equipment, type Exercise, type Routine, type RoutineItem, type WeekPlan } from './schema'

/**
 * Programa real: três treinos full body (A, B, C), 2 séries por exercício.
 * Compostos em 6–8 reps com RIR 1–2; isolados em 8–10 ou 10–12 com RIR 0–1.
 */
interface ExerciseSeed {
  name: string
  muscleGroup: string
  equipment: Equipment
  isCompound?: boolean
  aliases?: string[]
}

const EXERCISES: ExerciseSeed[] = [
  { name: 'Supino Inclinado Halteres', muscleGroup: 'Peito Composto', equipment: 'halter', isCompound: true, aliases: ['Supino inclinado'] },
  { name: 'Puxada Alta Frontal', muscleGroup: 'Costas/Dorsal', equipment: 'cabo', aliases: ['Puxada frontal', 'Puxada alta'] },
  { name: 'Crucifixo', muscleGroup: 'Peito', equipment: 'maquina', aliases: ['Crucifixo polia', 'Crucifixo máquina', 'Crucifixo na polia', 'Crucifixo na máquina'] },
  { name: 'Elevação Lateral', muscleGroup: 'Deltoide', equipment: 'halter' },
  { name: 'Tríceps na Polia', muscleGroup: 'Tríceps', equipment: 'cabo', aliases: ['Tríceps polia', 'Tríceps corda'] },
  { name: 'Bíceps na Polia', muscleGroup: 'Bíceps', equipment: 'cabo', aliases: ['Bíceps polia', 'Rosca polia'] },
  { name: 'Bíceps Barra W', muscleGroup: 'Bíceps', equipment: 'barra', aliases: ['Rosca barra W', 'Rosca W'] },
  { name: 'Cadeira Flexora', muscleGroup: 'Posterior de Coxa', equipment: 'maquina', aliases: ['Flexora', 'Mesa flexora'] },
  { name: 'Cadeira Extensora', muscleGroup: 'Quadríceps', equipment: 'maquina', aliases: ['Extensora'] },
  { name: 'Agachamento Livre', muscleGroup: 'Quadríceps Composto', equipment: 'barra', isCompound: true, aliases: ['Agachamento'] },
  { name: 'Stiff', muscleGroup: 'Posterior de Coxa', equipment: 'barra', isCompound: true },
  { name: 'Cadeira Romana', muscleGroup: 'Lombar/Glúteo/Posterior', equipment: 'maquina', aliases: ['Romana', 'Extensão lombar'] },
  { name: 'Desenvolvimento Halteres', muscleGroup: 'Deltoide Composto', equipment: 'halter', isCompound: true, aliases: ['Desenvolvimento'] },
  { name: 'Remada Baixa no Cabo', muscleGroup: 'Costas/Meio', equipment: 'cabo', aliases: ['Remada baixa'] },
  { name: 'Remada em Máquina', muscleGroup: 'Costas/Meio', equipment: 'maquina', aliases: ['Remada máquina'] },
  { name: 'Crucifixo Invertido', muscleGroup: 'Deltoide Posterior', equipment: 'maquina', aliases: ['Crucifixo inverso', 'Crucifixo invertido máquina', 'Crucifixo invertido polia'] },
  { name: 'Puxada Alta Supinada', muscleGroup: 'Costas/Dorsal', equipment: 'cabo', aliases: ['Puxada supinada'] },
  { name: 'Leg Press', muscleGroup: 'Quadríceps/Glúteo', equipment: 'maquina', isCompound: true },
]

type ItemSeed = [name: string, sets: number, repsMin: number, repsMax: number, rirMin: number, rirMax: number, alternatives?: string[]]

const ROUTINES: { name: string; description: string; items: ItemSeed[] }[] = [
  {
    name: 'A',
    description: 'Full body · peito composto',
    items: [
      ['Supino Inclinado Halteres', 2, 6, 8, 1, 2],
      ['Puxada Alta Frontal', 2, 8, 10, 0, 1],
      ['Crucifixo', 2, 8, 10, 0, 1],
      ['Elevação Lateral', 2, 10, 12, 0, 1],
      ['Tríceps na Polia', 2, 10, 12, 0, 1],
      ['Bíceps na Polia', 2, 10, 12, 0, 1, ['Bíceps Barra W']],
      ['Cadeira Flexora', 2, 10, 12, 0, 1],
      ['Cadeira Extensora', 2, 10, 12, 0, 1],
    ],
  },
  {
    name: 'B',
    description: 'Full body · pernas e ombro compostos',
    items: [
      ['Agachamento Livre', 2, 6, 8, 1, 2],
      ['Stiff', 2, 6, 8, 1, 2, ['Cadeira Flexora']],
      ['Cadeira Romana', 2, 8, 10, 0, 1],
      ['Desenvolvimento Halteres', 2, 6, 8, 1, 2],
      ['Remada Baixa no Cabo', 2, 8, 10, 0, 1, ['Remada em Máquina']],
      ['Crucifixo Invertido', 2, 10, 12, 0, 1],
      ['Puxada Alta Supinada', 2, 8, 10, 0, 1],
      ['Crucifixo', 2, 8, 10, 0, 1],
    ],
  },
  {
    name: 'C',
    description: 'Full body · costas e peito',
    items: [
      ['Remada Baixa no Cabo', 2, 8, 10, 0, 1, ['Remada em Máquina']],
      ['Supino Inclinado Halteres', 2, 6, 8, 1, 2],
      ['Puxada Alta Supinada', 2, 8, 10, 0, 1],
      ['Elevação Lateral', 2, 10, 12, 0, 1],
      ['Bíceps na Polia', 2, 10, 12, 0, 1, ['Bíceps Barra W']],
      ['Tríceps na Polia', 2, 10, 12, 0, 1],
      ['Leg Press', 2, 6, 8, 1, 2, ['Cadeira Extensora']],
      ['Cadeira Flexora', 2, 10, 12, 0, 1],
    ],
  },
]

/**
 * Garante que os exercícios do programa existam (casando por nome ou alias com
 * o que já está cadastrado) e cria as rotinas A, B, C e o plano semanal se
 * ainda não existirem. Idempotente.
 */
export async function seedProgramIfMissing(): Promise<void> {
  const existingRoutines = await db.routines.count()
  const existing = await db.exercises.toArray()
  const byNorm = new Map<string, Exercise>()
  for (const e of existing) {
    byNorm.set(normalizeName(e.name), e)
    for (const a of e.aliases ?? []) byNorm.set(normalizeName(a), e)
  }

  const idByName = new Map<string, string>()
  const now = Date.now()
  let i = 0
  for (const seed of EXERCISES) {
    const found = byNorm.get(normalizeName(seed.name)) ?? seed.aliases?.map((a) => byNorm.get(normalizeName(a))).find(Boolean)
    if (found) {
      idByName.set(seed.name, found.id)
      // Completa metadados que faltam sem sobrescrever o que o usuário editou.
      const patch: Partial<Exercise> = {}
      if (!found.aliases?.length && seed.aliases) patch.aliases = seed.aliases
      if (found.isCompound === undefined && seed.isCompound) patch.isCompound = true
      if (Object.keys(patch).length) await db.exercises.update(found.id, patch)
      continue
    }
    const ex: Exercise = { id: newId(), createdAt: now + i++, ...seed }
    await db.exercises.add(ex)
    idByName.set(seed.name, ex.id)
    byNorm.set(normalizeName(ex.name), ex)
  }

  if (existingRoutines > 0) return

  const routines: Routine[] = ROUTINES.map((r, order) => ({
    id: newId(),
    name: r.name,
    description: r.description,
    order,
    items: r.items.map(
      ([name, targetSets, targetRepsMin, targetRepsMax, rirMin, rirMax, alternatives]): RoutineItem => ({
        exerciseId: idByName.get(name)!,
        alternativeIds: alternatives?.map((a) => idByName.get(a)!).filter(Boolean),
        targetSets,
        targetRepsMin,
        targetRepsMax,
        rirMin,
        rirMax,
      }),
    ),
  }))
  await db.routines.bulkAdd(routines)

  const [a, b, c] = routines
  const plan: WeekPlan = [
    { type: 'rest' },
    { type: 'routine', routineId: a.id },
    { type: 'run' },
    { type: 'routine', routineId: b.id },
    { type: 'run' },
    { type: 'routine', routineId: c.id },
    { type: 'rest' },
  ]
  await setSetting('weekPlan', plan)
}
