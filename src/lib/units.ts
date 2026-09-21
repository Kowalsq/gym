import type { Exercise, SetEntry } from '../db/schema'

/** Unidade em que a carga de um exercício é anotada. "tijolo" é a posição do pino na máquina. */
export type LoadUnit = 'kg' | 'lb' | 'tijolo'

export const LOAD_UNITS: LoadUnit[] = ['kg', 'lb', 'tijolo']

const LB_TO_KG = 0.45359237

export const unitOf = (ex: Pick<Exercise, 'loadUnit'> | undefined | null): LoadUnit => ex?.loadUnit ?? 'kg'

export function unitLabel(unit: LoadUnit, value = 2): string {
  if (unit === 'tijolo') return value === 1 ? 'tijolo' : 'tijolos'
  return unit
}

const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

/** "22,5 kg", "60 lb", "9 tijolos". */
export function fmtLoad(value: number, unit: LoadUnit): string {
  return `${num.format(value)} ${unitLabel(unit, value)}`
}

/** Só o número, para colunas que já têm a unidade no cabeçalho. */
export const fmtLoadValue = (value: number): string => num.format(value)

/** Converte para kg quando faz sentido; tijolo não tem conversão. */
export function toKg(value: number, unit: LoadUnit): number | null {
  if (unit === 'kg') return value
  if (unit === 'lb') return value * LB_TO_KG
  return null
}

/** Passo padrão de progressão na unidade do exercício. */
export function progressionStep(ex: Pick<Exercise, 'loadUnit' | 'equipment'>): number {
  const unit = unitOf(ex)
  if (unit === 'tijolo') return 1
  if (unit === 'lb') return 5
  return ex.equipment === 'maquina' || ex.equipment === 'cabo' ? 5 : 2.5
}

/** Volume em kg de um conjunto de séries, convertendo lb e ignorando tijolos e aquecimento. */
export function volumeKgOf(sets: Pick<SetEntry, 'weightKg' | 'reps' | 'isWarmup' | 'exerciseId'>[], unitFor: (exerciseId: string) => LoadUnit): number {
  let total = 0
  for (const s of sets) {
    if (s.isWarmup) continue
    const kg = toKg(s.weightKg, unitFor(s.exerciseId))
    if (kg !== null) total += kg * s.reps
  }
  return total
}

/** Sufixo para a anotação em texto: "" para kg, "lb" ou " tijolos". */
export function unitSuffixForText(unit: LoadUnit, value: number): string {
  if (unit === 'kg') return ''
  if (unit === 'lb') return 'lb'
  return value === 1 ? ' tijolo' : ' tijolos'
}
