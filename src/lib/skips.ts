import type { Exercise, Routine, Session, SetEntry } from '../db/schema'

export interface SkipStreak {
  routine: Routine
  exercise: Exercise
  /** Quantos treinos seguidos dessa rotina, do mais recente para trás, sem o exercício. */
  streak: number
  /** Quando foi feito pela última vez nessa rotina, ou null se nunca. */
  lastDoneAt: number | null
}

/**
 * Exercícios de uma rotina que vêm sendo pulados: contam os treinos mais
 * recentes daquela rotina em que nem o exercício nem uma alternativa foi
 * feita, parando no primeiro em que foi. Só rotinas com pelo menos
 * `minStreak` sessões podem gerar aviso.
 */
export function skipStreaks(
  routines: Routine[],
  sessions: Session[],
  sets: SetEntry[],
  exercises: Exercise[],
  minStreak = 2,
): SkipStreak[] {
  const exById = new Map(exercises.map((e) => [e.id, e]))
  const doneBySession = new Map<string, Set<string>>()
  for (const s of sets) {
    if (s.isWarmup) continue
    let set = doneBySession.get(s.sessionId)
    if (!set) doneBySession.set(s.sessionId, (set = new Set()))
    set.add(s.exerciseId)
  }

  const out: SkipStreak[] = []
  for (const routine of routines) {
    const recent = sessions
      .filter((s) => s.endedAt !== undefined && s.kind !== 'run' && s.routineId === routine.id)
      .sort((a, b) => b.startedAt - a.startedAt)
    if (recent.length < minStreak) continue

    for (const item of routine.items) {
      const ids = [item.exerciseId, ...(item.alternativeIds ?? [])]
      let streak = 0
      let lastDoneAt: number | null = null
      for (const s of recent) {
        const done = doneBySession.get(s.id)
        if (done && ids.some((id) => done.has(id))) {
          lastDoneAt = s.startedAt
          break
        }
        streak++
      }
      const exercise = exById.get(item.exerciseId)
      if (streak >= minStreak && exercise) out.push({ routine, exercise, streak, lastDoneAt })
    }
  }
  return out.sort((a, b) => b.streak - a.streak)
}
