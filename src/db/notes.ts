import { normalizeName, type ParsedDay, type ParsedLine } from '../lib/parse'
import { db, newId, type Exercise, type ExerciseLog, type Session, type SetEntry } from './schema'

export interface MatchedLine extends ParsedLine {
  /** Exercício existente que casou com o nome, ou null se será criado. */
  exercise: Exercise | null
}

/**
 * Resolve cada nome distinto do texto para um exercício da biblioteca, uma vez
 * só, para que o mesmo nome caia sempre no mesmo exercício em todos os dias.
 *
 * Regras: nome ou alias exato (sem acento e caixa); senão, prefixo único quando
 * o nome digitado tem duas ou mais palavras ("Remada baixa" → "Remada baixa no
 * cabo"). Uma palavra só ("Crucifixo") nunca casa por prefixo: vira exercício novo.
 */
export function resolveNames(names: string[], exercises: Exercise[]): Map<string, Exercise | null> {
  const byNorm = new Map<string, Exercise>()
  for (const e of exercises) {
    for (const a of e.aliases ?? []) byNorm.set(normalizeName(a), e)
  }
  // Nome principal vence alias de outro exercício.
  for (const e of exercises) byNorm.set(normalizeName(e.name), e)

  const out = new Map<string, Exercise | null>()
  for (const raw of names) {
    const key = normalizeName(raw)
    if (!key || out.has(key)) continue
    let exercise = byNorm.get(key) ?? null
    if (!exercise && key.includes(' ')) {
      const candidates = exercises.filter((e) => {
        const n = normalizeName(e.name)
        return n.startsWith(key + ' ') || key.startsWith(n + ' ')
      })
      if (candidates.length === 1) exercise = candidates[0]
    }
    out.set(key, exercise)
  }
  return out
}

/** Casa as linhas com a biblioteca usando `resolveNames` sobre todas as linhas dadas. */
export function matchExercises(lines: ParsedLine[], exercises: Exercise[]): MatchedLine[] {
  const resolved = resolveNames(lines.filter((l) => l.kind === 'lift').map((l) => l.name), exercises)
  return lines.map((line) => ({ ...line, exercise: line.kind === 'lift' ? (resolved.get(normalizeName(line.name)) ?? null) : null }))
}

export interface SaveOptions {
  /** Rotina seguida; dá nome à sessão ("Treino A") e alimenta a sugestão do próximo. */
  routineId?: string
  routineName?: string
}

export interface SaveResult {
  sessions: number
  sets: number
  newExercises: number
  runs: number
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export const isUsableLift = (l: ParsedLine) => l.kind === 'lift' && !!l.name && l.weightKg !== null && l.reps.length > 0
export const isUsableRun = (l: ParsedLine) => l.kind === 'run' && l.distanceKm !== undefined && l.durationSec !== undefined

/**
 * Grava dias anotados: uma sessão de musculação por dia (séries com o mesmo
 * peso, um log por exercício com a decisão) e uma sessão de corrida por linha
 * de corrida. Cria exercícios desconhecidos. Se já existe sessão concluída no
 * mesmo dia, os exercícios são anexados a ela.
 */
export async function saveParsedDays(days: ParsedDay[], exercises: Exercise[], opts: SaveOptions = {}): Promise<SaveResult> {
  const result: SaveResult = { sessions: 0, sets: 0, newExercises: 0, runs: 0 }
  const allLines = days.flatMap((d) => d.lines)
  const resolved = resolveNames(allLines.filter((l) => l.kind === 'lift').map((l) => l.name), exercises)

  await db.transaction('rw', db.exercises, db.sessions, db.sets, db.logs, async () => {
    for (const day of days) {
      const dayEnd = day.date + DAY - 1

      // Corridas: uma sessão por linha.
      for (const line of day.lines.filter(isUsableRun)) {
        const startedAt = day.date + 7 * HOUR
        await db.sessions.add({
          id: newId(),
          kind: 'run',
          name: 'Corrida',
          startedAt,
          endedAt: startedAt + line.durationSec! * 1000,
          exerciseIds: [],
          distanceKm: line.distanceKm,
          durationSec: line.durationSec,
        })
        result.runs++
      }

      const usable: MatchedLine[] = day.lines
        .filter(isUsableLift)
        .map((l) => ({ ...l, exercise: resolved.get(normalizeName(l.name)) ?? null }))
      if (usable.length === 0) continue

      let session = await db.sessions
        .where('startedAt')
        .between(day.date, dayEnd, true, true)
        .filter((s) => s.endedAt !== undefined && s.kind !== 'run')
        .first()

      if (!session) {
        // Horário fixo às 18h para não colidir com meia-noite em fusos.
        const startedAt = day.date + 18 * HOUR
        session = {
          id: newId(),
          kind: 'gym',
          routineId: opts.routineId,
          name: opts.routineName ? `Treino ${opts.routineName}` : 'Treino',
          startedAt,
          endedAt: startedAt + HOUR,
          exerciseIds: [],
        }
        await db.sessions.add(session)
        result.sessions++
      } else if (opts.routineId && !session.routineId) {
        await db.sessions.update(session.id, { routineId: opts.routineId, name: `Treino ${opts.routineName ?? ''}`.trim() })
      }

      const exerciseIds = [...session.exerciseIds]
      let t = session.startedAt

      for (const line of usable) {
        let exercise = line.exercise
        if (!exercise) {
          exercise = {
            id: newId(),
            name: line.name,
            muscleGroup: 'Outro',
            equipment: 'outro',
            createdAt: Date.now(),
          }
          await db.exercises.add(exercise)
          resolved.set(normalizeName(line.name), exercise)
          result.newExercises++
        }
        if (!exerciseIds.includes(exercise.id)) exerciseIds.push(exercise.id)

        // Substitui séries e log anteriores deste exercício no mesmo dia.
        await db.sets.where('[sessionId+exerciseId]').equals([session.id, exercise.id]).delete()
        await db.logs.where('[sessionId+exerciseId]').equals([session.id, exercise.id]).delete()

        const sets: SetEntry[] = line.reps.map((reps, i) => {
          t += 60 * 1000
          return {
            id: newId(),
            sessionId: session!.id,
            exerciseId: exercise!.id,
            setNumber: i + 1,
            weightKg: line.weightKg!,
            reps,
            isWarmup: false,
            doneAt: t,
          }
        })
        await db.sets.bulkAdd(sets)
        result.sets += sets.length

        const log: ExerciseLog = {
          id: newId(),
          sessionId: session.id,
          exerciseId: exercise.id,
          decision: line.decision,
          raw: line.raw,
        }
        await db.logs.add(log)
      }

      await db.sessions.update(session.id, { exerciseIds })
    }
  })

  return result
}

/** Última decisão registrada por exercício, com a sessão em que foi tomada. */
export async function latestDecisions(): Promise<Map<string, { log: ExerciseLog; session: Session }>> {
  const [logs, sessions] = await Promise.all([db.logs.toArray(), db.sessions.toArray()])
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  const out = new Map<string, { log: ExerciseLog; session: Session }>()
  for (const log of logs) {
    const session = sessionById.get(log.sessionId)
    if (!session) continue
    const prev = out.get(log.exerciseId)
    if (!prev || session.startedAt > prev.session.startedAt) out.set(log.exerciseId, { log, session })
  }
  return out
}
