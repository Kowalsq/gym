import { useSyncExternalStore } from 'react'
import { db, onLocalChange, withRemoteApply } from '../db/schema'
import { GistError, createGist, findGist, readGist, whoAmI, writeGist } from './gist'
import { emptySnapshot, isSnapshot, mergeSnapshots, sameContent, type Snapshot } from './merge'

export interface SyncConfig {
  token: string
  gistId: string
  login: string
}

export interface SyncStatus {
  state: 'off' | 'idle' | 'syncing' | 'offline' | 'error'
  lastSyncAt: number | null
  error: string | null
  login: string | null
}

const CONFIG_KEY = 'ferro:sync'
const LAST_KEY = 'ferro:sync-last'

function readConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    return raw ? (JSON.parse(raw) as SyncConfig) : null
  } catch {
    return null
  }
}
function writeConfig(c: SyncConfig | null) {
  try {
    if (c) localStorage.setItem(CONFIG_KEY, JSON.stringify(c))
    else localStorage.removeItem(CONFIG_KEY)
  } catch {
    /* sem storage */
  }
}
function readLast(): number | null {
  try {
    const v = localStorage.getItem(LAST_KEY)
    return v ? Number(v) : null
  } catch {
    return null
  }
}

let status: SyncStatus = (() => {
  const c = readConfig()
  return { state: c ? 'idle' : 'off', lastSyncAt: readLast(), error: null, login: c?.login ?? null }
})()
const listeners = new Set<() => void>()
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch }
  for (const l of listeners) l()
}
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => status,
    () => status,
  )
}
export const isSyncOn = () => readConfig() !== null

/** Lê o banco inteiro. */
export async function exportSnapshot(): Promise<Snapshot> {
  const [exercises, routines, sessions, sets, logs, settings, tombstones] = await Promise.all([
    db.exercises.toArray(),
    db.routines.toArray(),
    db.sessions.toArray(),
    db.sets.toArray(),
    db.logs.toArray(),
    db.settings.toArray(),
    db.tombstones.toArray(),
  ])
  return { app: 'ferro', version: 1, exportedAt: Date.now(), exercises, routines, sessions, sets, logs, settings, tombstones }
}

/** Substitui o banco inteiro pelo snapshot, sem carimbar nem agendar sincronização. */
export async function applySnapshot(snap: Partial<Snapshot>): Promise<void> {
  await withRemoteApply(() =>
    db.transaction('rw', [db.exercises, db.routines, db.sessions, db.sets, db.logs, db.settings, db.tombstones], async () => {
      await Promise.all([
        db.exercises.clear(),
        db.routines.clear(),
        db.sessions.clear(),
        db.sets.clear(),
        db.logs.clear(),
        db.settings.clear(),
        db.tombstones.clear(),
      ])
      await db.exercises.bulkPut(snap.exercises ?? [])
      await db.routines.bulkPut(snap.routines ?? [])
      await db.sessions.bulkPut(snap.sessions ?? [])
      await db.sets.bulkPut(snap.sets ?? [])
      await db.logs.bulkPut(snap.logs ?? [])
      await db.settings.bulkPut(snap.settings ?? [])
      await db.tombstones.bulkPut(snap.tombstones ?? [])
    }),
  )
}

function parseRemote(content: string): Snapshot {
  const data = JSON.parse(content) as unknown
  if (!isSnapshot(data)) throw new Error('O conteúdo do Gist não é um snapshot do Ferro.')
  return { ...emptySnapshot(), ...data }
}

function describeError(e: unknown): { state: 'offline' | 'error'; error: string } {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { state: 'offline', error: 'Sem internet. Sincroniza quando voltar.' }
  if (e instanceof GistError) {
    if (e.status === 401) return { state: 'error', error: 'Token inválido ou expirado. Conecte de novo em Ajustes.' }
    if (e.status === 404) return { state: 'error', error: 'Gist não encontrado. Desconecte e conecte de novo.' }
    if (e.status === 403) return { state: 'error', error: 'GitHub recusou (limite de uso ou permissão). Tente mais tarde.' }
    return { state: 'error', error: `GitHub: ${e.message}` }
  }
  if (e instanceof TypeError) return { state: 'offline', error: 'Não deu para falar com o GitHub. Sincroniza quando voltar.' }
  return { state: 'error', error: e instanceof Error ? e.message : String(e) }
}

let inFlight: Promise<void> | null = null
let runAgain = false
let debounce: ReturnType<typeof setTimeout> | null = null

/**
 * Sincroniza: baixa o remoto, mescla com o local, aplica o resultado e envia
 * se algo mudou. `replaceRemote` sobrescreve o Gist com o local (usado após
 * importar um backup).
 */
export function syncNow(opts: { replaceRemote?: boolean } = {}): Promise<void> {
  const config = readConfig()
  if (!config) return Promise.resolve()
  if (inFlight) {
    runAgain = true
    return inFlight
  }
  inFlight = (async () => {
    setStatus({ state: 'syncing', error: null })
    try {
      const local = await exportSnapshot()
      let remote: Snapshot | null = null
      let merged = local
      if (!opts.replaceRemote) {
        const { content } = await readGist(config.token, config.gistId)
        remote = content.trim() ? parseRemote(content) : emptySnapshot()
        merged = mergeSnapshots(local, remote)
      }
      if (!sameContent(merged, local)) await applySnapshot(merged)
      if (opts.replaceRemote || !remote || !sameContent(merged, remote)) {
        await writeGist(config.token, config.gistId, JSON.stringify(merged))
      }
      const now = Date.now()
      try {
        localStorage.setItem(LAST_KEY, String(now))
      } catch {
        /* sem storage */
      }
      setStatus({ state: 'idle', lastSyncAt: now, error: null })
    } catch (e) {
      setStatus(describeError(e))
    } finally {
      inFlight = null
      if (runAgain) {
        runAgain = false
        schedule(1500)
      }
    }
  })()
  return inFlight
}

/** Agenda uma sincronização daqui a pouco, juntando mudanças seguidas. */
export function schedule(delayMs = 3000): void {
  if (!readConfig()) return
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => {
    debounce = null
    void syncNow()
  }, delayMs)
}

/**
 * Conecta com um token do GitHub (escopo gist). Acha ou cria o Gist. Num
 * aparelho sem treinos registrados, adota o remoto inteiro em vez de mesclar,
 * para os treinos A/B/C recém-semeados não competirem com os já editados.
 */
export async function connect(token: string): Promise<void> {
  const clean = token.trim()
  if (!clean) throw new Error('Cole o token.')
  const login = await whoAmI(clean)
  let gistId = await findGist(clean)
  const local = await exportSnapshot()
  if (!gistId) {
    gistId = await createGist(clean, JSON.stringify(local))
  } else {
    const { content } = await readGist(clean, gistId)
    const remote = content.trim() ? parseRemote(content) : null
    const fresh = local.sessions.length === 0
    if (remote && fresh && remote.sessions.length > 0) await applySnapshot(remote)
  }
  writeConfig({ token: clean, gistId, login })
  setStatus({ state: 'idle', login, error: null })
  await syncNow()
}

export function disconnect(): void {
  writeConfig(null)
  if (debounce) clearTimeout(debounce)
  setStatus({ state: 'off', login: null, error: null })
}

let started = false
/** Liga os gatilhos: mudança local, volta ao app, internet de volta, abertura. */
export function startSyncEngine(): void {
  if (started) return
  started = true
  onLocalChange(() => schedule())
  window.addEventListener('online', () => schedule(500))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') schedule(500)
  })
  schedule(800)
}
