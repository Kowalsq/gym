import Dexie, { type EntityTable } from 'dexie'
import type { Decision } from '../lib/parse'

export type MuscleGroup =
  | 'peito'
  | 'costas'
  | 'ombro'
  | 'biceps'
  | 'triceps'
  | 'pernas'
  | 'gluteo'
  | 'core'
  | 'cardio'
  | 'outro'

export type Equipment = 'barra' | 'halter' | 'maquina' | 'cabo' | 'corporal' | 'outro'

export interface Exercise {
  id: string
  name: string
  muscleGroup: MuscleGroup
  equipment: Equipment
  notes?: string
  createdAt: number
}

export interface RoutineItem {
  exerciseId: string
  targetSets: number
  targetRepsMin: number
  targetRepsMax: number
  restSeconds?: number
}

export interface Routine {
  id: string
  name: string
  order: number
  items: RoutineItem[]
}

export interface Session {
  id: string
  routineId?: string
  name: string
  startedAt: number
  endedAt?: number
  notes?: string
  /** Ordem dos exercícios nesta sessão, inclusive os sem série ainda. */
  exerciseIds: string[]
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

export class FerroDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  routines!: EntityTable<Routine, 'id'>
  sessions!: EntityTable<Session, 'id'>
  sets!: EntityTable<SetEntry, 'id'>
  logs!: EntityTable<ExerciseLog, 'id'>

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
  }
}

export const db = new FerroDB()

export const newId = (): string => crypto.randomUUID()
