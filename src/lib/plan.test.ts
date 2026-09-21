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
  it('segue o plano do dia', () => {
    expect(suggestRoutine(plan, routines, [], monday)).toEqual({ routine: A, reason: 'hoje' })
  })

  it('se o treino do dia já foi feito, vai para o próximo da sequência', () => {
    const s = suggestRoutine(plan, routines, [done('a', monday - 3600e3)], monday)
    expect(s).toEqual({ routine: B, reason: 'sequencia' })
  })

  it('dia sem treino planejado usa a sequência depois do último', () => {
    expect(suggestRoutine(plan, routines, [done('b', monday)], tuesday)).toEqual({ routine: C, reason: 'sequencia' })
    expect(suggestRoutine(plan, routines, [done('c', monday)], tuesday)).toEqual({ routine: A, reason: 'sequencia' })
  })

  it('sem histórico e sem plano começa pelo primeiro', () => {
    expect(suggestRoutine(undefined, routines, [], tuesday)).toEqual({ routine: A, reason: 'sequencia' })
  })

  it('sem rotinas retorna null', () => {
    expect(suggestRoutine(plan, [], [], monday)).toBeNull()
  })
})
