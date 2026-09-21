import { db, newId, type Exercise } from './schema'

type SeedRow = [name: string, muscleGroup: Exercise['muscleGroup'], equipment: Exercise['equipment']]

const DEFAULT_EXERCISES: SeedRow[] = [
  ['Supino reto', 'peito', 'barra'],
  ['Supino inclinado com halteres', 'peito', 'halter'],
  ['Crucifixo na máquina', 'peito', 'maquina'],
  ['Remada curvada', 'costas', 'barra'],
  ['Puxada alta', 'costas', 'maquina'],
  ['Remada baixa no cabo', 'costas', 'cabo'],
  ['Levantamento terra', 'costas', 'barra'],
  ['Desenvolvimento com halteres', 'ombro', 'halter'],
  ['Elevação lateral', 'ombro', 'halter'],
  ['Rosca direta', 'biceps', 'barra'],
  ['Rosca alternada', 'biceps', 'halter'],
  ['Tríceps na polia', 'triceps', 'cabo'],
  ['Tríceps testa', 'triceps', 'barra'],
  ['Agachamento livre', 'pernas', 'barra'],
  ['Leg press', 'pernas', 'maquina'],
  ['Cadeira extensora', 'pernas', 'maquina'],
  ['Mesa flexora', 'pernas', 'maquina'],
  ['Panturrilha em pé', 'pernas', 'maquina'],
  ['Elevação pélvica', 'gluteo', 'barra'],
  ['Prancha', 'core', 'corporal'],
]

/** Popula a biblioteca de exercícios na primeira abertura. Idempotente. */
export async function seedIfEmpty(): Promise<void> {
  const count = await db.exercises.count()
  if (count > 0) return
  const now = Date.now()
  await db.exercises.bulkAdd(
    DEFAULT_EXERCISES.map(([name, muscleGroup, equipment], i) => ({
      id: newId(),
      name,
      muscleGroup,
      equipment,
      createdAt: now + i,
    })),
  )
}
