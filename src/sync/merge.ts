import type { Exercise, ExerciseLog, Routine, Session, SetEntry, Setting, Tombstone, WeekPlan } from '../db/schema'
import { normalizeName } from '../lib/parse'

/** O banco inteiro em um objeto. É o que vai e volta do Gist. */
export interface Snapshot {
  app: 'ferro'
  version: 1
  exportedAt: number
  exercises: Exercise[]
  routines: Routine[]
  sessions: Session[]
  sets: SetEntry[]
  logs: ExerciseLog[]
  settings: Setting[]
  tombstones: Tombstone[]
}

export function emptySnapshot(): Snapshot {
  return { app: 'ferro', version: 1, exportedAt: 0, exercises: [], routines: [], sessions: [], sets: [], logs: [], settings: [], tombstones: [] }
}

export function isSnapshot(x: unknown): x is Snapshot {
  return !!x && typeof x === 'object' && (x as Snapshot).app === 'ferro' && Array.isArray((x as Snapshot).exercises)
}

type Stamped = { updatedAt?: number }
const stamp = (r: Stamped) => r.updatedAt ?? 0

/** União por id; em conflito vence o updatedAt maior; empate fica com o local. */
function unionById<T extends Stamped>(local: T[], remote: T[], idOf: (r: T) => string, dead: Map<string, number>): T[] {
  const out = new Map<string, T>()
  for (const r of local) out.set(idOf(r), r)
  for (const r of remote) {
    const id = idOf(r)
    const cur = out.get(id)
    if (!cur || stamp(r) > stamp(cur)) out.set(id, r)
  }
  return [...out.values()].filter((r) => {
    const deletedAt = dead.get(idOf(r))
    return deletedAt === undefined || stamp(r) > deletedAt
  })
}

/**
 * Mescla dois snapshots. Sessões são documentos: as séries e logs vêm do lado
 * cuja sessão venceu. Exercícios e treinos com o mesmo nome são unificados,
 * remapeando ids, para dois aparelhos que começaram separados não duplicarem.
 */
export function mergeSnapshots(local: Snapshot, remote: Snapshot): Snapshot {
  // Tombstones: união, ficando com o apagamento mais recente.
  const tomb = new Map<string, Tombstone>()
  for (const t of [...local.tombstones, ...remote.tombstones]) {
    const cur = tomb.get(t.id)
    if (!cur || t.deletedAt > cur.deletedAt) tomb.set(t.id, t)
  }
  const dead = new Map([...tomb.values()].map((t) => [t.id, t.deletedAt]))

  let exercises = unionById(local.exercises, remote.exercises, (e) => e.id, dead)
  let routines = unionById(local.routines, remote.routines, (r) => r.id, dead)
  const sessions = unionById(local.sessions, remote.sessions, (s) => s.id, dead)
  const settings = unionById(local.settings, remote.settings, (s) => s.key, dead)

  // Séries e logs seguem a sessão vencedora.
  const localSessionIds = new Set(local.sessions.map((s) => s.id))
  const remoteSessionIds = new Set(remote.sessions.map((s) => s.id))
  const fromLocal = new Set<string>()
  const fromRemote = new Set<string>()
  for (const s of sessions) {
    const l = localSessionIds.has(s.id) ? local.sessions.find((x) => x.id === s.id)! : undefined
    const r = remoteSessionIds.has(s.id) ? remote.sessions.find((x) => x.id === s.id)! : undefined
    if (l && r) (stamp(r) > stamp(l) ? fromRemote : fromLocal).add(s.id)
    else if (l) fromLocal.add(s.id)
    else fromRemote.add(s.id)
  }
  let sets = [...local.sets.filter((x) => fromLocal.has(x.sessionId)), ...remote.sets.filter((x) => fromRemote.has(x.sessionId))]
  let logs = [...local.logs.filter((x) => fromLocal.has(x.sessionId)), ...remote.logs.filter((x) => fromRemote.has(x.sessionId))]

  // Unifica exercícios com o mesmo nome (ou alias igual ao nome do outro).
  const exMap = new Map<string, string>()
  {
    const byKey = new Map<string, Exercise>()
    const keep: Exercise[] = []
    const sorted = [...exercises].sort((a, b) => a.createdAt - b.createdAt)
    for (const e of sorted) {
      const key = normalizeName(e.name)
      const winner = byKey.get(key)
      if (winner) {
        exMap.set(e.id, winner.id)
        // Herda aliases e metadados que o vencedor não tinha.
        const merged = new Set([...(winner.aliases ?? []), ...(e.aliases ?? [])])
        if (merged.size) winner.aliases = [...merged]
        if (winner.isCompound === undefined && e.isCompound) winner.isCompound = true
        if (!winner.notes && e.notes) winner.notes = e.notes
      } else {
        byKey.set(key, e)
        keep.push(e)
      }
    }
    exercises = keep
  }
  const ex = (id: string) => exMap.get(id) ?? id

  // Unifica treinos com o mesmo nome: fica o mais recente.
  const rtMap = new Map<string, string>()
  {
    const byKey = new Map<string, Routine>()
    for (const r of [...routines].sort((a, b) => stamp(b) - stamp(a))) {
      const key = normalizeName(r.name)
      const winner = byKey.get(key)
      if (winner) rtMap.set(r.id, winner.id)
      else byKey.set(key, r)
    }
    routines = [...byKey.values()].sort((a, b) => a.order - b.order)
  }
  const rt = (id: string) => rtMap.get(id) ?? id

  if (exMap.size || rtMap.size) {
    routines = routines.map((r) => ({
      ...r,
      items: r.items.map((it) => ({
        ...it,
        exerciseId: ex(it.exerciseId),
        alternativeIds: it.alternativeIds?.map(ex).filter((id, i, arr) => arr.indexOf(id) === i && id !== ex(it.exerciseId)),
      })),
    }))
    for (const s of sessions) {
      s.exerciseIds = s.exerciseIds.map(ex).filter((id, i, arr) => arr.indexOf(id) === i)
      if (s.routineId) s.routineId = rt(s.routineId)
    }
    sets = sets.map((x) => ({ ...x, exerciseId: ex(x.exerciseId) }))
    logs = logs.map((x) => ({ ...x, exerciseId: ex(x.exerciseId) }))
    for (const s of settings) {
      if (s.key === 'weekPlan' && Array.isArray(s.value)) {
        s.value = (s.value as WeekPlan).map((slot) => (slot.type === 'routine' ? { ...slot, routineId: rt(slot.routineId) } : slot)) as WeekPlan
      }
    }
  }

  return {
    app: 'ferro',
    version: 1,
    exportedAt: Date.now(),
    exercises,
    routines,
    sessions: sessions.sort((a, b) => a.startedAt - b.startedAt),
    sets,
    logs,
    settings,
    tombstones: [...tomb.values()],
  }
}

/** Igualdade de conteúdo, ignorando exportedAt e ordem. */
export function sameContent(a: Snapshot, b: Snapshot): boolean {
  const norm = (s: Snapshot) => {
    const byId = <T>(arr: T[], k: (x: T) => string) => [...arr].sort((x, y) => k(x).localeCompare(k(y)))
    return JSON.stringify({
      exercises: byId(s.exercises, (x) => x.id),
      routines: byId(s.routines, (x) => x.id),
      sessions: byId(s.sessions, (x) => x.id),
      sets: byId(s.sets, (x) => x.id),
      logs: byId(s.logs, (x) => x.id),
      settings: byId(s.settings, (x) => x.key),
      tombstones: byId(s.tombstones, (x) => x.id),
    })
  }
  return norm(a) === norm(b)
}
