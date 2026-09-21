import { db, newId, type Session, type SetEntry } from './schema'

/** Sessão em andamento (sem endedAt), se houver. */
export function activeSession(): Promise<Session | undefined> {
  return db.sessions.filter((s) => s.endedAt === undefined).first()
}

export async function startSession(name: string, routineId?: string): Promise<Session> {
  const session: Session = {
    id: newId(),
    name,
    routineId,
    startedAt: Date.now(),
    exerciseIds: [],
  }
  await db.sessions.add(session)
  return session
}

export async function finishSession(sessionId: string): Promise<void> {
  const setCount = await db.sets.where('sessionId').equals(sessionId).count()
  if (setCount === 0) {
    // Treino sem nenhuma série não vale registro.
    await db.sessions.delete(sessionId)
    return
  }
  await db.sessions.update(sessionId, { endedAt: Date.now() })
}

export async function discardSession(sessionId: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.sets, db.logs, async () => {
    await db.sets.where('sessionId').equals(sessionId).delete()
    await db.logs.where('sessionId').equals(sessionId).delete()
    await db.sessions.delete(sessionId)
  })
}

export async function addExerciseToSession(sessionId: string, exerciseId: string): Promise<void> {
  const s = await db.sessions.get(sessionId)
  if (!s || s.exerciseIds.includes(exerciseId)) return
  await db.sessions.update(sessionId, { exerciseIds: [...s.exerciseIds, exerciseId] })
}

export async function removeExerciseFromSession(sessionId: string, exerciseId: string): Promise<void> {
  const s = await db.sessions.get(sessionId)
  if (!s) return
  await db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sets.where('[sessionId+exerciseId]').equals([sessionId, exerciseId]).delete()
    await db.sessions.update(sessionId, { exerciseIds: s.exerciseIds.filter((id) => id !== exerciseId) })
  })
}

export function setsOfSession(sessionId: string): Promise<SetEntry[]> {
  return db.sets.where('sessionId').equals(sessionId).sortBy('doneAt')
}

export async function addSet(
  input: Omit<SetEntry, 'id' | 'doneAt' | 'setNumber'>,
): Promise<SetEntry> {
  const existing = await db.sets
    .where('[sessionId+exerciseId]')
    .equals([input.sessionId, input.exerciseId])
    .count()
  const entry: SetEntry = { ...input, id: newId(), setNumber: existing + 1, doneAt: Date.now() }
  await db.sets.add(entry)
  return entry
}

export async function updateSet(id: string, patch: Partial<Pick<SetEntry, 'weightKg' | 'reps' | 'isWarmup'>>) {
  await db.sets.update(id, patch)
}

export async function deleteSet(id: string): Promise<void> {
  const target = await db.sets.get(id)
  if (!target) return
  await db.transaction('rw', db.sets, async () => {
    await db.sets.delete(id)
    // Renumera as séries restantes do mesmo exercício na sessão.
    const rest = await db.sets
      .where('[sessionId+exerciseId]')
      .equals([target.sessionId, target.exerciseId])
      .sortBy('doneAt')
    await Promise.all(rest.map((s, i) => db.sets.update(s.id, { setNumber: i + 1 })))
  })
}

/**
 * Séries da última sessão concluída em que este exercício foi feito,
 * excluindo a sessão atual. É a coluna "Anterior".
 */
export async function previousSets(exerciseId: string, excludeSessionId: string): Promise<SetEntry[]> {
  const recent = await db.sets
    .where('[exerciseId+doneAt]')
    .between([exerciseId, Dexie_MIN], [exerciseId, Dexie_MAX])
    .reverse()
    .filter((s) => s.sessionId !== excludeSessionId)
    .limit(30)
    .toArray()
  const lastSessionId = recent[0]?.sessionId
  if (!lastSessionId) return []
  return recent.filter((s) => s.sessionId === lastSessionId).sort((a, b) => a.setNumber - b.setNumber)
}

/** Todas as séries válidas de um exercício, em ordem cronológica. */
export function allSetsOfExercise(exerciseId: string): Promise<SetEntry[]> {
  return db.sets
    .where('[exerciseId+doneAt]')
    .between([exerciseId, Dexie_MIN], [exerciseId, Dexie_MAX])
    .toArray()
}

export function finishedSessions(limit = 100): Promise<Session[]> {
  return db.sessions
    .orderBy('startedAt')
    .reverse()
    .filter((s) => s.endedAt !== undefined)
    .limit(limit)
    .toArray()
}

// Limites para consultas em índice composto [exerciseId+doneAt].
const Dexie_MIN = -Infinity
const Dexie_MAX = Infinity
