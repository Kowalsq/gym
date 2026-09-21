import { describe, expect, it } from 'vitest'
import type { Exercise, ExerciseLog, Session, SetEntry } from '../db/schema'
import { analyze, rangeStartFor, suggestNext } from './analysis'

const ex: Exercise = { id: 'e1', name: 'Supino', muscleGroup: 'peito', equipment: 'barra', createdAt: 0 }
const day = (n: number) => new Date(2026, 8, n, 18).getTime()

function session(id: string, n: number): Session {
  return { id, name: 'Treino', startedAt: day(n), endedAt: day(n) + 3600e3, exerciseIds: ['e1'] }
}
function set(sessionId: string, w: number, reps: number, setNumber: number): SetEntry {
  return { id: `${sessionId}-${setNumber}`, sessionId, exerciseId: 'e1', setNumber, weightKg: w, reps, isWarmup: false, doneAt: 0 }
}

describe('analyze', () => {
  const sessions = [session('s1', 1), session('s2', 8), session('s3', 15)]
  const sets = [set('s1', 80, 8, 1), set('s1', 80, 7, 2), set('s2', 80, 8, 1), set('s2', 80, 8, 2), set('s3', 82.5, 8, 1), set('s3', 82.5, 6, 2)]
  const logs: ExerciseLog[] = [
    { id: 'l1', sessionId: 's1', exerciseId: 'e1', decision: 'manter' },
    { id: 'l2', sessionId: 's2', exerciseId: 'e1', decision: 'aumentar' },
    { id: 'l3', sessionId: 's3', exerciseId: 'e1', decision: 'manter' },
  ]

  it('um ponto por sessão com carga máxima, reps e decisão', () => {
    const a = analyze([ex], sessions, sets, logs, 0)
    const s = a.byExercise.get('e1')!
    expect(s.points).toHaveLength(3)
    expect(s.points[0]).toMatchObject({ maxWeightKg: 80, reps: [8, 7], decision: 'manter', isPR: false })
    expect(s.points[2]).toMatchObject({ maxWeightKg: 82.5, reps: [8, 6], isPR: true })
    expect(s.current?.maxWeightKg).toBe(82.5)
    expect(s.deltaKg).toBe(2.5)
    expect(a.prsInRange).toBe(1)
  })

  it('janela limita delta e contagem de sessões', () => {
    const a = analyze([ex], sessions, sets, logs, day(10))
    const s = a.byExercise.get('e1')!
    expect(a.sessionsInRange).toHaveLength(1)
    expect(s.deltaKg).toBeNull()
    expect(s.current?.maxWeightKg).toBe(82.5)
  })

  it('conta exercícios por dia', () => {
    const a = analyze([ex], sessions, sets, logs, 0)
    expect(a.dayCounts.get(new Date(2026, 8, 1).getTime())).toBe(1)
  })
})

describe('suggestNext', () => {
  it('2,5 em barra, 5 em máquina', () => {
    expect(suggestNext(ex, 82.5)).toBe(85)
    expect(suggestNext({ ...ex, equipment: 'maquina' }, 75)).toBe(80)
  })
})

describe('rangeStartFor', () => {
  it('tudo começa em zero', () => {
    expect(rangeStartFor('all')).toBe(0)
  })
  it('30 dias inclui hoje', () => {
    const now = new Date(2026, 8, 21, 15).getTime()
    expect(rangeStartFor('30', now)).toBe(new Date(2026, 7, 23).getTime())
  })
})
