import { describe, expect, it } from 'vitest'
import type { Exercise, Routine, Session, SetEntry } from '../db/schema'
import { emptySnapshot, mergeSnapshots, sameContent, type Snapshot } from './merge'

const ex = (id: string, name: string, createdAt = 1, extra: Partial<Exercise> = {}): Exercise => ({
  id,
  name,
  muscleGroup: 'x',
  equipment: 'maquina',
  createdAt,
  updatedAt: createdAt,
  ...extra,
})
const session = (id: string, startedAt: number, updatedAt: number, exerciseIds: string[] = [], routineId?: string): Session => ({
  id,
  name: 'Treino',
  startedAt,
  endedAt: startedAt + 1,
  exerciseIds,
  updatedAt,
  routineId,
})
const set = (id: string, sessionId: string, exerciseId: string, weightKg: number): SetEntry => ({
  id,
  sessionId,
  exerciseId,
  setNumber: 1,
  weightKg,
  reps: 8,
  isWarmup: false,
  doneAt: 0,
})
const snap = (p: Partial<Snapshot>): Snapshot => ({ ...emptySnapshot(), ...p })

describe('mergeSnapshots', () => {
  it('une registros de lados diferentes', () => {
    const m = mergeSnapshots(snap({ sessions: [session('s1', 1, 1)] }), snap({ sessions: [session('s2', 2, 2)] }))
    expect(m.sessions.map((s) => s.id)).toEqual(['s1', 's2'])
  })

  it('em conflito vence o updatedAt maior e leva suas séries', () => {
    const local = snap({ sessions: [session('s1', 1, 10, ['e1'])], sets: [set('a', 's1', 'e1', 80)] })
    const remote = snap({ sessions: [session('s1', 1, 20, ['e1'])], sets: [set('b', 's1', 'e1', 82.5)] })
    const m = mergeSnapshots(local, remote)
    expect(m.sets).toHaveLength(1)
    expect(m.sets[0].weightKg).toBe(82.5)
  })

  it('empate fica com o local', () => {
    const local = snap({ sessions: [session('s1', 1, 10)], sets: [set('a', 's1', 'e1', 80)] })
    const remote = snap({ sessions: [session('s1', 1, 10)], sets: [set('b', 's1', 'e1', 82.5)] })
    expect(mergeSnapshots(local, remote).sets[0].id).toBe('a')
  })

  it('tombstone apaga o registro do outro lado e descarta séries órfãs', () => {
    const local = snap({ tombstones: [{ id: 's1', table: 'sessions', deletedAt: 50 }] })
    const remote = snap({ sessions: [session('s1', 1, 10)], sets: [set('a', 's1', 'e1', 80)] })
    const m = mergeSnapshots(local, remote)
    expect(m.sessions).toEqual([])
    expect(m.sets).toEqual([])
    expect(m.tombstones).toHaveLength(1)
  })

  it('registro modificado depois do tombstone sobrevive', () => {
    const local = snap({ tombstones: [{ id: 'e1', table: 'exercises', deletedAt: 50 }] })
    const remote = snap({ exercises: [ex('e1', 'Supino', 1, { updatedAt: 60 })] })
    expect(mergeSnapshots(local, remote).exercises).toHaveLength(1)
  })

  it('exercícios com o mesmo nome em ids diferentes viram um só, remapeando séries e treinos', () => {
    const local = snap({
      exercises: [ex('e1', 'Supino Inclinado Halteres', 1)],
      routines: [{ id: 'r1', name: 'A', order: 0, items: [{ exerciseId: 'e1', targetSets: 2, targetRepsMin: 6, targetRepsMax: 8 }], updatedAt: 5 }],
      sessions: [session('s1', 1, 1, ['e1'], 'r1')],
      sets: [set('a', 's1', 'e1', 20)],
    })
    const remote = snap({
      exercises: [ex('e9', 'supino inclinado halteres', 2, { aliases: ['Supino inclinado'] })],
      routines: [{ id: 'r9', name: 'A', order: 0, items: [{ exerciseId: 'e9', targetSets: 2, targetRepsMin: 6, targetRepsMax: 8 }], updatedAt: 9 }],
      sessions: [session('s2', 2, 2, ['e9'], 'r9')],
      sets: [set('b', 's2', 'e9', 22)],
      settings: [{ key: 'weekPlan', value: [{ type: 'rest' }, { type: 'routine', routineId: 'r9' }, { type: 'rest' }, { type: 'rest' }, { type: 'rest' }, { type: 'rest' }, { type: 'rest' }], updatedAt: 1 }],
    })
    const m = mergeSnapshots(local, remote)
    expect(m.exercises).toHaveLength(1)
    expect(m.exercises[0].id).toBe('e1')
    expect(m.exercises[0].aliases).toEqual(['Supino inclinado'])
    expect(m.routines).toHaveLength(1)
    expect(m.routines[0].id).toBe('r9')
    expect(m.routines[0].items[0].exerciseId).toBe('e1')
    expect(m.sets.map((s) => s.exerciseId)).toEqual(['e1', 'e1'])
    expect(m.sessions.map((s) => s.routineId)).toEqual(['r9', 'r9'])
    expect((m.settings[0].value as { type: string; routineId?: string }[])[1].routineId).toBe('r9')
  })

  it('alternativa que virou o próprio exercício é removida', () => {
    const r: Routine = { id: 'r1', name: 'A', order: 0, items: [{ exerciseId: 'e1', alternativeIds: ['e2'], targetSets: 2, targetRepsMin: 8, targetRepsMax: 10 }], updatedAt: 1 }
    const m = mergeSnapshots(snap({ exercises: [ex('e1', 'Remada', 1), ex('e2', 'remada', 2)], routines: [r] }), emptySnapshot())
    expect(m.routines[0].items[0].alternativeIds).toEqual([])
  })
})

describe('sameContent', () => {
  it('ignora exportedAt e ordem', () => {
    const a = snap({ exportedAt: 1, sessions: [session('s1', 1, 1), session('s2', 2, 2)] })
    const b = snap({ exportedAt: 2, sessions: [session('s2', 2, 2), session('s1', 1, 1)] })
    expect(sameContent(a, b)).toBe(true)
    expect(sameContent(a, snap({ sessions: [session('s1', 1, 1)] }))).toBe(false)
  })
})
