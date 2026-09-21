import Dexie, { type EntityTable } from 'dexie'
import type { Decision } from '../lib/parse'

/** Grupo muscular é texto livre: as categorias são as do próprio programa. */
export type MuscleGroup = string

export type Equipment = 'barra' | 'halter' | 'maquina' | 'cabo' | 'corporal' | 'outro'

export interface Exercise {
  id: string
  name: string
  muscleGroup: MuscleGroup
  equipment: Equipment
  /** Exercício composto (multiarticular), alvo em 6–8 reps com RIR maior. */
  isCompound?: boolean
  /** Outros nomes que a anotação por texto deve reconhecer. */
  aliases?: string[]
  notes?: string
  createdAt: number
}

export interface RoutineItem {
  exerciseId: string
  /** Alternativas aceitas no lugar do principal ("Polia ou Máquina"). */
  alternativeIds?: string[]
  targetSets: number
  targetRepsMin: number
  targetRepsMax: number
  rirMin?: number
  rirMax?: number
  restSeconds?: number
}

export interface Routine {
  id: string
  /** Letra curta: "A", "B", "C". */
  name: string
  /** Descrição opcional, ex.: "Full body, ênfase em peito". */
  description?: string
  order: number
  items: RoutineItem[]
}

export type SessionKind = 'gym' | 'run'

export interface Session {
  id: string
  kind?: SessionKind
  routineId?: string
  name: string
  startedAt: number
  endedAt?: number
  notes?: string
  /** Ordem dos exercícios nesta sessão, inclusive os sem série ainda. */
  exerciseIds: string[]
  /** Corrida. */
  distanceKm?: number
  durationSec?: number
}

export interface SetEntry {
  id: string
  sessionId: string
  exerciseId: string
  setNumber: number
  weightKg: number
  reps: number
  isWarmup: boolean
  rpe?: number
  doneAt: number
}

/** Um registro por exercício por sessão: a decisão para o próximo treino e anotação. */
export interface ExerciseLog {
  id: string
  sessionId: string
  exerciseId: string
  decision: Decision | null
  note?: string
  /** Texto original digitado, quando veio da anotação rápida. */
  raw?: string
}

/** O que está planejado para cada dia da semana (0 = domingo). */
export type PlanSlot = { type: 'routine'; routineId: string } | { type: 'run' } | { type: 'rest' }
export type WeekPlan = [PlanSlot, PlanSlot, PlanSlot, PlanSlot, PlanSlot, PlanSlot, PlanSlot]

export interface Setting<T = unknown> {
  key: string
  value: T
}

export class FerroDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  routines!: EntityTable<Routine, 'id'>
  sessions!: EntityTable<Session, 'id'>
  sets!: EntityTable<SetEntry, 'id'>
  logs!: EntityTable<ExerciseLog, 'id'>
  settings!: EntityTable<Setting, 'key'>

  constructor() {
    super('ferro')
    this.version(1).stores({
      exercises: 'id, name, muscleGroup',
      routines: 'id, order',
      sessions: 'id, startedAt, endedAt',
      sets: 'id, sessionId, [exerciseId+doneAt], [sessionId+exerciseId]',
    })
    this.version(2).stores({
      logs: 'id, sessionId, exerciseId, [sessionId+exerciseId]',
    })
    this.version(3).stores({
      settings: 'key',
    })
  }
}

export const db = new FerroDB()

export const newId = (): string => crypto.randomUUID()

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key)
  return row?.value as T | undefined
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value })
}
