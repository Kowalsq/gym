/**
 * Parser das anotações no formato usado no WhatsApp, uma linha por exercício:
 *
 *   Desenvolvimento máquina 75 10 7 manter
 *   Crucifixo invertido 30kg 10 8 manter
 *   Crucifixo 2x8 55kg manter
 *   Corrida 5km 28:30
 *
 * Regras: o nome vem primeiro; o peso é o número com "kg" ou, sem "kg", o
 * primeiro número; "NxR" vira N séries de R reps; os demais números são reps
 * de cada série; a última palavra pode ser a decisão para o próximo treino.
 * Linha começando com "Corrida" é corrida: distância em km e tempo.
 *
 * Linhas de data ("21/09", "21/09/2026", "Segunda 21/09") abrem um novo dia.
 * Prefixos de exportação do WhatsApp ("21/09/2026 18:32 - Felipe: ") são
 * removidos e a data deles é usada.
 */

import type { LoadUnit } from './units'

export type Decision = 'manter' | 'aumentar' | 'diminuir'

export interface ParsedLine {
  raw: string
  kind: 'lift' | 'run'
  name: string
  weightKg: number | null
  /** Unidade escrita na linha (kg, lb ou tijolos), se houver. */
  unit?: LoadUnit
  reps: number[]
  decision: Decision | null
  /** Corrida. */
  distanceKm?: number
  durationSec?: number
  warnings: string[]
}

export interface ParsedDay {
  /** Meia-noite local do dia, em ms. */
  date: number
  lines: ParsedLine[]
}

const DECISIONS: Record<string, Decision> = {
  manter: 'manter',
  mantem: 'manter',
  mantém: 'manter',
  aumentar: 'aumentar',
  aumenta: 'aumentar',
  subir: 'aumentar',
  sobe: 'aumentar',
  diminuir: 'diminuir',
  diminui: 'diminuir',
  descer: 'diminuir',
  baixar: 'diminuir',
  reduzir: 'diminuir',
}

const RUN_WORDS = new Set(['corrida', 'correr', 'corri', 'run', 'caminhada', 'esteira'])

const WA_PREFIX = /^\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+\d{1,2}:\d{2}(?::\d{2})?\]?\s*-?\s*[^:]+:\s*/
const DATE_LINE = /^(?:[a-zçà-ü-]+\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*$/i
const NUM = /^(\d+(?:[.,]\d+)?)(kg|lbs?)?$/i
const BRICK_WORDS = new Set(['tijolo', 'tijolos', 'placa', 'placas', 'pino'])
const SETS = /^(\d+)\s*x\s*(\d+)$/i
const DIST = /^(\d+(?:[.,]\d+)?)\s*(km|k|m)$/i
const TIME_MIN = /^(\d+(?:[.,]\d+)?)\s*(min|m|minutos)$/i
const TIME_CLOCK = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
const TIME_H = /^(\d{1,2})h(\d{2})?$/i

const toNumber = (s: string) => Number(s.replace(',', '.'))

function localDate(day: number, month: number, year?: number): number {
  const now = new Date()
  let y = year ?? now.getFullYear()
  if (y < 100) y += 2000
  const d = new Date(y, month - 1, day)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function parseRun(raw: string, tokens: string[]): ParsedLine {
  const warnings: string[] = []
  let distanceKm: number | undefined
  let durationSec: number | undefined
  const rest = tokens.slice(1)
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i]
    const next = rest[i + 1]?.toLowerCase()
    let m: RegExpExecArray | null
    if ((m = DIST.exec(t))) {
      const v = toNumber(m[1])
      distanceKm = m[2].toLowerCase() === 'm' ? v / 1000 : v
      continue
    }
    if ((m = TIME_CLOCK.exec(t))) {
      const a = Number(m[1])
      const b = Number(m[2])
      const c = m[3] !== undefined ? Number(m[3]) : null
      durationSec = c === null ? a * 60 + b : a * 3600 + b * 60 + c
      continue
    }
    if ((m = TIME_H.exec(t))) {
      durationSec = Number(m[1]) * 3600 + Number(m[2] ?? 0) * 60
      continue
    }
    if ((m = TIME_MIN.exec(t))) {
      durationSec = Math.round(toNumber(m[1]) * 60)
      continue
    }
    if (NUM.test(t) && !/kg$/i.test(t)) {
      // Número solto: "5 km" ou "28 min" separados por espaço.
      if (next === 'km' || next === 'k') {
        distanceKm = toNumber(t)
        i++
        continue
      }
      if (next === 'min' || next === 'minutos') {
        durationSec = Math.round(toNumber(t) * 60)
        i++
        continue
      }
      if (distanceKm === undefined) {
        distanceKm = toNumber(t)
        continue
      }
      if (durationSec === undefined) {
        durationSec = Math.round(toNumber(t) * 60)
        continue
      }
    }
    warnings.push(`Não entendi "${t}".`)
  }
  if (distanceKm === undefined) warnings.push('Sem distância.')
  if (durationSec === undefined) warnings.push('Sem tempo.')
  return { raw, kind: 'run', name: 'Corrida', weightKg: null, reps: [], decision: null, distanceKm, durationSec, warnings }
}

export function parseLine(input: string): ParsedLine | null {
  const raw = input.trim()
  if (!raw) return null
  const tokens = raw.split(/\s+/)
  const warnings: string[] = []

  if (RUN_WORDS.has(tokens[0].toLowerCase().replace(/[:\-–]+$/, ''))) return parseRun(raw, tokens)

  let decision: Decision | null = null
  const lastKey = tokens[tokens.length - 1].toLowerCase().replace(/[.!]+$/, '')
  if (DECISIONS[lastKey]) {
    decision = DECISIONS[lastKey]
    tokens.pop()
  }

  // Nome = tokens iniciais até o primeiro número ou NxR.
  const nameTokens: string[] = []
  let i = 0
  for (; i < tokens.length; i++) {
    const t = tokens[i]
    if (NUM.test(t) || SETS.test(t)) break
    nameTokens.push(t)
  }
  const name = nameTokens.join(' ').replace(/[:\-–]+$/, '').trim()
  if (!name) return { raw, kind: 'lift', name: '', weightKg: null, reps: [], decision, warnings: ['Linha sem nome de exercício.'] }

  let weightKg: number | null = null
  let unit: LoadUnit | undefined
  const reps: number[] = []
  const plainNumbers: number[] = []
  let setsPattern: [number, number] | null = null

  for (; i < tokens.length; i++) {
    const t = tokens[i]
    const s = SETS.exec(t)
    if (s) {
      setsPattern = [Number(s[1]), Number(s[2])]
      continue
    }
    const n = NUM.exec(t)
    if (n) {
      const value = toNumber(n[1])
      const next = tokens[i + 1]?.toLowerCase()
      if (n[2] || (next && BRICK_WORDS.has(next))) {
        if (weightKg !== null) warnings.push('Mais de um peso com unidade; usei o primeiro.')
        else {
          weightKg = value
          unit = n[2] ? (n[2].toLowerCase().startsWith('lb') ? 'lb' : 'kg') : 'tijolo'
        }
        if (!n[2]) i++
      } else {
        plainNumbers.push(value)
      }
      continue
    }
    warnings.push(`Não entendi "${t}".`)
  }

  if (setsPattern) {
    for (let k = 0; k < setsPattern[0]; k++) reps.push(setsPattern[1])
  }

  if (weightKg === null && plainNumbers.length > 0) {
    weightKg = plainNumbers.shift()!
  }
  for (const n of plainNumbers) {
    if (!Number.isInteger(n)) warnings.push(`Reps com decimal (${n}).`)
    reps.push(n)
  }

  if (weightKg === null) warnings.push('Sem peso.')
  if (reps.length === 0) warnings.push('Sem repetições.')

  return { raw, kind: 'lift', name, weightKg, unit, reps, decision, warnings }
}

/** Divide o texto em dias. Linhas sem data caem no dia informado em `defaultDate`. */
export function parseNotes(text: string, defaultDate: number): ParsedDay[] {
  const days: ParsedDay[] = []
  let current: ParsedDay | null = null

  const ensureDay = (date: number) => {
    const found = days.find((d) => d.date === date)
    if (found) {
      current = found
      return found
    }
    const day = { date, lines: [] as ParsedLine[] }
    days.push(day)
    current = day
    return day
  }

  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim()
    if (!line) continue

    const wa = WA_PREFIX.exec(line)
    if (wa) {
      ensureDay(localDate(Number(wa[1]), Number(wa[2]), Number(wa[3])))
      line = line.slice(wa[0].length).trim()
      if (!line) continue
    }

    const dl = DATE_LINE.exec(line)
    if (dl) {
      ensureDay(localDate(Number(dl[1]), Number(dl[2]), dl[3] ? Number(dl[3]) : undefined))
      continue
    }

    const parsed = parseLine(line)
    if (!parsed) continue
    ;(current ?? ensureDay(defaultDate)).lines.push(parsed)
  }

  return days.sort((a, b) => a.date - b.date)
}

/** Normaliza para comparação de nomes: sem acento, minúsculo, espaços únicos. */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Formata uma linha no mesmo padrão do WhatsApp, para exportar ou copiar. Unidade só quando não é kg. */
export function formatLine(name: string, weightKg: number | null, reps: number[], decision: Decision | null, unit: LoadUnit = 'kg'): string {
  const suffix = weightKg === null || unit === 'kg' ? '' : unit === 'lb' ? 'lb' : weightKg === 1 ? ' tijolo' : ' tijolos'
  const w = weightKg === null ? '' : String(weightKg).replace('.', ',') + suffix
  const allSame = reps.length > 1 && reps.every((r) => r === reps[0])
  const repsPart = reps.length === 0 ? '' : allSame ? `${reps.length}x${reps[0]}` : reps.join(' ')
  return [name, w, repsPart, decision ?? ''].filter(Boolean).join(' ')
}

/** "Corrida 5,2km 28:30". */
export function formatRunLine(distanceKm: number, durationSec: number): string {
  const m = Math.floor(durationSec / 60)
  const s = durationSec % 60
  return `Corrida ${String(distanceKm).replace('.', ',')}km ${m}:${String(s).padStart(2, '0')}`
}
