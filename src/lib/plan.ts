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
  reason: 'hoje' | 'sequencia'
}

/**
 * Qual treino fazer agora. Se o plano de hoje tem um treino e ele ainda não foi
 * feito hoje, é ele. Senão, o próximo na sequência depois do último treino
 * registrado (A → B → C → A).
 */
export function suggestRoutine(plan: WeekPlan | undefined, routines: Routine[], sessions: Session[], now = Date.now()): Suggestion | null {
  const ordered = [...routines].sort((a, b) => a.order - b.order)
  if (ordered.length === 0) return null

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const todayStart = today.getTime()
  const gym = sessions.filter((s) => s.endedAt !== undefined && s.kind !== 'run')
  const doneToday = new Set(gym.filter((s) => s.startedAt >= todayStart).map((s) => s.routineId))

  const slot = plan?.[today.getDay()]
  if (slot?.type === 'routine') {
    const r = ordered.find((x) => x.id === slot.routineId)
    if (r && !doneToday.has(r.id)) return { routine: r, reason: 'hoje' }
  }

  const last = gym.filter((s) => s.routineId).sort((a, b) => b.startedAt - a.startedAt)[0]
  if (!last) return { routine: ordered[0], reason: 'sequencia' }
  const idx = ordered.findIndex((r) => r.id === last.routineId)
  return { routine: ordered[(idx + 1) % ordered.length], reason: 'sequencia' }
}

/** Domingo da semana corrente, meia-noite local. */
export function weekStart(now = Date.now()): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d.getTime()
}
