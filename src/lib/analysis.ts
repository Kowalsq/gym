import type { Exercise, ExerciseLog, Session, SetEntry } from '../db/schema'
import type { Decision } from './parse'

const DAY = 24 * 60 * 60 * 1000

export function dayKey(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Um ponto por sessão: carga máxima do exercício e reps de cada série. */
export interface ExercisePoint {
  sessionId: string
  date: number
  maxWeightKg: number
  reps: number[]
  decision: Decision | null
  isPR: boolean
}

export interface ExerciseSummary {
  exercise: Exercise
  points: ExercisePoint[]
  current: ExercisePoint | null
  /** Variação de carga em relação ao primeiro ponto dentro da janela. */
  deltaKg: number | null
  sessionsCount: number
}

export interface Analysis {
  byExercise: Map<string, ExerciseSummary>
  /** Contagem de exercícios por dia (meia-noite local). */
  dayCounts: Map<number, number>
  sessionsInRange: Session[]
  prsInRange: number
}

export function analyze(
  exercises: Exercise[],
  sessions: Session[],
  sets: SetEntry[],
  logs: ExerciseLog[],
  rangeStart: number,
): Analysis {
  const finished = sessions.filter((s) => s.endedAt !== undefined).sort((a, b) => a.startedAt - b.startedAt)
  const sessionById = new Map(finished.map((s) => [s.id, s]))
  const logByKey = new Map(logs.map((l) => [`${l.sessionId}|${l.exerciseId}`, l]))

  // Agrupa séries por exercício e sessão.
  const grouped = new Map<string, Map<string, SetEntry[]>>()
  for (const s of sets) {
    if (s.isWarmup || !sessionById.has(s.sessionId)) continue
    let bySession = grouped.get(s.exerciseId)
    if (!bySession) grouped.set(s.exerciseId, (bySession = new Map()))
    const list = bySession.get(s.sessionId) ?? []
    list.push(s)
    bySession.set(s.sessionId, list)
  }

  const byExercise = new Map<string, ExerciseSummary>()
  let prsInRange = 0
  const dayCounts = new Map<number, number>()

  for (const ex of exercises) {
    const bySession = grouped.get(ex.id)
    const points: ExercisePoint[] = []
    if (bySession) {
      let runningMax = 0
      const ordered = [...bySession.entries()]
        .map(([sid, list]) => ({ session: sessionById.get(sid)!, list }))
        .sort((a, b) => a.session.startedAt - b.session.startedAt)
      for (const { session, list } of ordered) {
        const maxWeightKg = Math.max(...list.map((s) => s.weightKg))
        const reps = list.sort((a, b) => a.setNumber - b.setNumber).map((s) => s.reps)
        const isPR = maxWeightKg > runningMax && runningMax > 0
        runningMax = Math.max(runningMax, maxWeightKg)
        const log = logByKey.get(`${session.id}|${ex.id}`)
        points.push({ sessionId: session.id, date: session.startedAt, maxWeightKg, reps, decision: log?.decision ?? null, isPR })
        if (isPR && session.startedAt >= rangeStart) prsInRange++
        const k = dayKey(session.startedAt)
        dayCounts.set(k, (dayCounts.get(k) ?? 0) + 1)
      }
    }
    const inRange = points.filter((p) => p.date >= rangeStart)
    const current = points[points.length - 1] ?? null
    const first = inRange[0]
    const deltaKg = current && first && inRange.length > 1 ? current.maxWeightKg - first.maxWeightKg : null
    byExercise.set(ex.id, { exercise: ex, points, current, deltaKg, sessionsCount: points.length })
  }

  return {
    byExercise,
    dayCounts,
    sessionsInRange: finished.filter((s) => s.startedAt >= rangeStart),
    prsInRange,
  }
}

export const RANGES = [
  { key: '30', label: '30 dias', days: 30 },
  { key: '90', label: '90 dias', days: 90 },
  { key: '180', label: '6 meses', days: 180 },
  { key: '365', label: '1 ano', days: 365 },
  { key: 'all', label: 'Tudo', days: null },
] as const

export type RangeKey = (typeof RANGES)[number]['key']

export function rangeStartFor(key: RangeKey, now = Date.now()): number {
  const r = RANGES.find((x) => x.key === key)
  return r?.days ? dayKey(now) - (r.days - 1) * DAY : 0
}

/** Sugestão de próxima carga para quem marcou "aumentar": 2,5 kg em barra/halter, 5 em máquina/cabo. */
export function suggestNext(ex: Exercise, currentKg: number): number {
  const step = ex.equipment === 'maquina' || ex.equipment === 'cabo' ? 5 : 2.5
  return Math.round((currentKg + step) * 100) / 100
}
