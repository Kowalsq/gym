import type { PlanSlot, Routine, Session, WeekPlan } from '../db/schema'

export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const WEEKDAY_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export function emptyPlan(): WeekPlan {
  return [{ type: 'rest' }, { type: 'rest' }, { type: 'rest' }, { type: 'rest' }, { type: 'rest' }, { type: 'rest' }, { type: 'rest' }]
}

export function slotLabel(slot: PlanSlot, routines: Routine[]): string {
  if (slot.type === 'run') return 'Corrida'
  if (slot.type === 'rest') return 'Descanso'
  return routines.find((r) => r.id === slot.routineId)?.name ?? '?'
}

export interface Suggestion {
  routine: Routine
  /** 'hoje' quando o próximo da sequência coincide com o plano de hoje. */
  reason: 'hoje' | 'sequencia'
  /** O que o plano diz para hoje, para informar ("hoje era dia de corrida"). */
  todaySlot?: PlanSlot
}

/**
 * Qual treino fazer agora: sempre o próximo na sequência depois do último
 * treino registrado (A → B → C → A), porque o dia da semana varia. O plano da
 * semana só informa; se coincidir com a sequência, o motivo vira "hoje".
 */
export function suggestRoutine(plan: WeekPlan | undefined, routines: Routine[], sessions: Session[], now = Date.now()): Suggestion | null {
  const ordered = [...routines].sort((a, b) => a.order - b.order)
  if (ordered.length === 0) return null

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const todaySlot = plan?.[today.getDay()]

  const last = sessions
    .filter((s) => s.endedAt !== undefined && s.kind !== 'run' && s.routineId && ordered.some((r) => r.id === s.routineId))
    .sort((a, b) => b.startedAt - a.startedAt)[0]

  const routine = last ? ordered[(ordered.findIndex((r) => r.id === last.routineId) + 1) % ordered.length] : ordered[0]
  const reason = todaySlot?.type === 'routine' && todaySlot.routineId === routine.id ? 'hoje' : 'sequencia'
  return { routine, reason, todaySlot }
}

/** Domingo da semana corrente, meia-noite local. */
export function weekStart(now = Date.now()): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d.getTime()
}
