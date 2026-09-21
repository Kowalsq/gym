import Dexie, { type EntityTable } from 'dexie'
import type { Decision } from '../lib/parse'
import type { LoadUnit } from '../lib/units'

/** Grupo muscular é texto livre: as categorias são as do próprio programa. */
export type MuscleGroup = string

export type Equipment = 'barra' | 'halter' | 'maquina' | 'cabo' | 'corporal' | 'outro'

export interface Exercise {
  id: string
  name: string
  muscleGroup: MuscleGroup
  equipment: Equipment
  /** Unidade em que a carga é anotada. Padrão kg. */
  loadUnit?: LoadUnit
  /** Exercício composto (multiarticular), alvo em 6–8 reps com RIR maior. */
  isCompound?: boolean
  /** Outros nomes que a anotação por texto deve reconhecer. */
  aliases?: string[]
  notes?: string
  createdAt: number
  /** Última modificação, usada na sincronização. Preenchido automaticamente. */
  updatedAt?: number
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
  updatedAt?: number
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
  /** Sobe sempre que a sessão ou suas séries/logs mudam. */
  updatedAt?: number
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
  updatedAt?: number
}

export type SyncedTable = 'exercises' | 'routines' | 'sessions' | 'settings'

/** Marca de apagamento, para a sincronização não ressuscitar o registro. */
export interface Tombstone {
  id: string
  table: SyncedTable
  deletedAt: number
}

/** Enquanto a sincronização aplica dados remotos, os hooks não mexem em updatedAt nem agendam nova sincronização. */
let applyingRemote = false
export function withRemoteApply<T>(fn: () => Promise<T>): Promise<T> {
  applyingRemote = true
  return fn().finally(() => {
    applyingRemote = false
  })
}

type ChangeListener = () => void
const changeListeners = new Set<ChangeListener>()
/** Avisa quando algo local mudou (fora da aplicação de dados remotos). */
export function onLocalChange(listener: ChangeListener): () => void {
  changeListeners.add(listener)
  return () => changeListeners.delete(listener)
}
function notifyChange() {
  if (applyingRemote) return
  for (const l of changeListeners) l()
}

export class FerroDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  routines!: EntityTable<Routine, 'id'>
  sessions!: EntityTable<Session, 'id'>
  sets!: EntityTable<SetEntry, 'id'>
  logs!: EntityTable<ExerciseLog, 'id'>
  settings!: EntityTable<Setting, 'key'>
  tombstones!: EntityTable<Tombstone, 'id'>

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
    this.version(4)
      .stores({
        tombstones: 'id, deletedAt',
      })
      .upgrade(async (tx) => {
        const now = Date.now()
        await tx.table('exercises').toCollection().modify((e) => {
          e.updatedAt ??= e.createdAt ?? now
        })
        await tx.table('sessions').toCollection().modify((s) => {
          s.updatedAt ??= s.endedAt ?? s.startedAt ?? now
        })
        await tx.table('routines').toCollection().modify((r) => {
          r.updatedAt ??= now
        })
        await tx.table('settings').toCollection().modify((s) => {
          s.updatedAt ??= now
        })
      })

    // Carimbo de modificação automático nas tabelas sincronizadas por registro.
    for (const table of [this.exercises, this.routines, this.sessions, this.settings] as Dexie.Table[]) {
      table.hook('creating', (_key, obj) => {
        if (!applyingRemote) obj.updatedAt = Date.now()
        else obj.updatedAt ??= Date.now()
        queueMicrotask(notifyChange)
      })
      table.hook('updating', () => {
        queueMicrotask(notifyChange)
        return applyingRemote ? undefined : { updatedAt: Date.now() }
      })
      table.hook('deleting', () => queueMicrotask(notifyChange))
    }
    for (const table of [this.sets, this.logs] as Dexie.Table[]) {
      table.hook('creating', () => queueMicrotask(notifyChange))
      table.hook('updating', () => {
        queueMicrotask(notifyChange)
        return undefined
      })
      table.hook('deleting', () => queueMicrotask(notifyChange))
    }
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

/** Registra o apagamento de um registro sincronizado. Chamar dentro da mesma transação do delete. */
export async function markDeleted(table: SyncedTable, id: string): Promise<void> {
  await db.tombstones.put({ id, table, deletedAt: Date.now() })
}

/** Sobe o carimbo da sessão quando suas séries ou logs mudam. */
export async function touchSession(sessionId: string): Promise<void> {
  await db.sessions.update(sessionId, { updatedAt: Date.now() })
}
