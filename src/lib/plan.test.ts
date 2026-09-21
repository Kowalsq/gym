import { describe, expect, it } from 'vitest'
import type { Routine, Session, WeekPlan } from '../db/schema'
import { suggestRoutine } from './plan'

const A: Routine = { id: 'a', name: 'A', order: 0, items: [] }
const B: Routine = { id: 'b', name: 'B', order: 1, items: [] }
const C: Routine = { id: 'c', name: 'C', order: 2, items: [] }
const routines = [C, A, B]

// 2026-09-21 é segunda-feira.
const monday = new Date(2026, 8, 21, 10).getTime()
const tuesday = new Date(2026, 8, 22, 10).getTime()
const wednesday = new Date(2026, 8, 23, 10).getTime()

const plan: WeekPlan = [
  { type: 'rest' },
  { type: 'routine', routineId: 'a' },
  { type: 'run' },
  { type: 'routine', routineId: 'b' },
  { type: 'run' },
  { type: 'routine', routineId: 'c' },
  { type: 'rest' },
]

function done(routineId: string, at: number): Session {
  return { id: `${routineId}-${at}`, name: 'Treino', routineId, startedAt: at, endedAt: at + 3600e3, exerciseIds: [] }
}

describe('suggestRoutine', () => {
  it('sem histórico começa pelo primeiro; coincide com o plano de segunda', () => {
    const s = suggestRoutine(plan, routines, [], monday)!
    expect(s.routine).toBe(A)
    expect(s.reason).toBe('hoje')
  })

  it('depois de A vem B, mesmo que o dia diga outra coisa', () => {
    const s = suggestRoutine(plan, routines, [done('a', monday - 3600e3)], monday)!
    expect(s.routine).toBe(B)
    expect(s.reason).toBe('sequencia')
  })

  it('treino atrasado: quarta pede B no plano, mas o último foi C, então é A', () => {
    const s = suggestRoutine(plan, routines, [done('c', monday - 7 * 24 * 3600e3)], wednesday)!
    expect(s.routine).toBe(A)
    expect(s.reason).toBe('sequencia')
    expect(s.todaySlot).toEqual({ type: 'routine', routineId: 'b' })
  })

  it('dia de corrida informa o plano e mantém a sequência', () => {
    const s = suggestRoutine(plan, routines, [done('b', monday)], tuesday)!
    expect(s.routine).toBe(C)
    expect(s.todaySlot).toEqual({ type: 'run' })
    expect(suggestRoutine(plan, routines, [done('c', monday)], tuesday)!.routine).toBe(A)
  })

  it('sessão sem rotina (livre) não conta na sequência', () => {
    const free: Session = { id: 'f', name: 'Treino', startedAt: monday, endedAt: monday + 1, exerciseIds: [] }
    expect(suggestRoutine(plan, routines, [done('a', monday - 86400e3), free], monday)!.routine).toBe(B)
  })

  it('sem rotinas retorna null', () => {
    expect(suggestRoutine(plan, [], [], monday)).toBeNull()
  })
})
