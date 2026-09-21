/**
 * Parser das anotações no formato usado no WhatsApp, uma linha por exercício:
 *
 *   Desenvolvimento máquina 75 10 7 manter
 *   Crucifixo invertido 30kg 10 8 manter
 *   Crucifixo 2x8 55kg manter
 *
 * Regras: o nome vem primeiro; o peso é o número com "kg" ou, sem "kg", o
 * primeiro número; "NxR" vira N séries de R reps; os demais números são reps
 * de cada série; a última palavra pode ser a decisão para o próximo treino.
 *
 * Linhas de data ("21/09", "21/09/2026", "Segunda 21/09") abrem um novo dia.
 * Prefixos de exportação do WhatsApp ("21/09/2026 18:32 - Felipe: ") são
 * removidos e a data deles é usada.
 */

export type Decision = 'manter' | 'aumentar' | 'diminuir'

export interface ParsedLine {
  raw: string
  name: string
  weightKg: number | null
  reps: number[]
  decision: Decision | null
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

const WA_PREFIX = /^\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+\d{1,2}:\d{2}(?::\d{2})?\]?\s*-?\s*[^:]+:\s*/
const DATE_LINE = /^(?:[a-zçà-ü-]+\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*$/i
const NUM = /^(\d+(?:[.,]\d+)?)(kg)?$/i
const SETS = /^(\d+)\s*x\s*(\d+)$/i

const toNumber = (s: string) => Number(s.replace(',', '.'))

function localDate(day: number, month: number, year?: number): number {
  const now = new Date()
  let y = year ?? now.getFullYear()
  if (y < 100) y += 2000
  const d = new Date(y, month - 1, day)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function parseLine(input: string): ParsedLine | null {
  const raw = input.trim()
  if (!raw) return null
  const tokens = raw.split(/\s+/)
  const warnings: string[] = []

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
  if (!name) return { raw, name: '', weightKg: null, reps: [], decision, warnings: ['Linha sem nome de exercício.'] }

  let weightKg: number | null = null
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
      if (n[2]) {
        if (weightKg !== null) warnings.push('Mais de um peso com "kg"; usei o primeiro.')
        else weightKg = value
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

  return { raw, name, weightKg, reps, decision, warnings }
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

/** Formata uma linha no mesmo padrão do WhatsApp, para exportar ou copiar. */
export function formatLine(name: string, weightKg: number, reps: number[], decision: Decision | null): string {
  const w = String(weightKg).replace('.', ',')
  const allSame = reps.length > 1 && reps.every((r) => r === reps[0])
  const repsPart = allSame ? `${reps.length}x${reps[0]}` : reps.join(' ')
  return [name, w, repsPart, decision ?? ''].filter(Boolean).join(' ')
}
