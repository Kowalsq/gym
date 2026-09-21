import { describe, expect, it } from 'vitest'
import type { Exercise, Routine, Session, SetEntry } from '../db/schema'
import { skipStreaks } from './skips'

const ex = (id: string, name: string): Exercise => ({ id, name, muscleGroup: 'x', equipment: 'maquina', createdAt: 0 })
const exercises = [ex('flex', 'Cadeira Flexora'), ex('ext', 'Cadeira Extensora'), ex('sup', 'Supino'), ex('bw', 'Bíceps Barra W'), ex('bp', 'Bíceps na Polia')]

const A: Routine = {
  id: 'a',
  name: 'A',
  order: 0,
  items: [
    { exerciseId: 'sup', targetSets: 2, targetRepsMin: 6, targetRepsMax: 8 },
    { exerciseId: 'flex', targetSets: 2, targetRepsMin: 10, targetRepsMax: 12 },
    { exerciseId: 'bp', alternativeIds: ['bw'], targetSets: 2, targetRepsMin: 10, targetRepsMax: 12 },
  ],
}

const day = (n: number) => new Date(2026, 8, n, 18).getTime()
const session = (id: string, n: number, routineId = 'a'): Session => ({ id, name: 'Treino', routineId, startedAt: day(n), endedAt: day(n) + 1, exerciseIds: [] })
const set = (sessionId: string, exerciseId: string): SetEntry => ({ id: `${sessionId}-${exerciseId}`, sessionId, exerciseId, setNumber: 1, weightKg: 10, reps: 10, isWarmup: false, doneAt: 0 })

describe('skipStreaks', () => {
  const sessions = [session('s1', 1), session('s2', 8), session('s3', 15)]

  it('conta treinos seguidos sem o exercício, do mais recente para trás', () => {
    const sets = [set('s1', 'sup'), set('s1', 'flex'), set('s1', 'bp'), set('s2', 'sup'), set('s2', 'bp'), set('s3', 'sup'), set('s3', 'bp')]
    const r = skipStreaks([A], sessions, sets, exercises)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ exercise: { id: 'flex' }, streak: 2, lastDoneAt: day(1) })
  })

  it('alternativa feita conta como feito', () => {
    const sets = [set('s1', 'sup'), set('s1', 'flex'), set('s2', 'sup'), set('s2', 'flex'), set('s2', 'bw'), set('s3', 'sup'), set('s3', 'flex'), set('s3', 'bw')]
    expect(skipStreaks([A], sessions, sets, exercises)).toEqual([])
  })

  it('nunca feito em 3 treinos dá streak 3 e lastDoneAt null', () => {
    const sets = [set('s1', 'sup'), set('s2', 'sup'), set('s3', 'sup')]
    const r = skipStreaks([A], sessions, sets, exercises)
    expect(r.map((x) => [x.exercise.id, x.streak, x.lastDoneAt])).toEqual([
      ['flex', 3, null],
      ['bp', 3, null],
    ])
  })

  it('pular uma vez só não avisa', () => {
    const sets = [set('s1', 'sup'), set('s1', 'flex'), set('s1', 'bp'), set('s2', 'sup'), set('s2', 'flex'), set('s2', 'bp'), set('s3', 'sup'), set('s3', 'bp')]
    expect(skipStreaks([A], sessions, sets, exercises)).toEqual([])
  })

  it('rotina com menos sessões que o mínimo não avisa', () => {
    expect(skipStreaks([A], [session('s1', 1)], [set('s1', 'sup')], exercises)).toEqual([])
  })

  it('sessões de outra rotina não entram na conta', () => {
    const mixed = [session('s1', 1), session('b1', 3, 'b'), session('s2', 8)]
    const sets = [set('s1', 'sup'), set('s1', 'flex'), set('s1', 'bp'), set('s2', 'sup'), set('s2', 'bp'), set('b1', 'sup')]
    expect(skipStreaks([A], mixed, sets, exercises)).toEqual([])
  })
})
