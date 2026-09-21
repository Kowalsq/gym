import type { SetEntry } from '../db/schema'

/** Volume em kg: soma de peso × reps, ignorando aquecimento. */
export function volumeKg(sets: Pick<SetEntry, 'weightKg' | 'reps' | 'isWarmup'>[]): number {
  return sets.reduce((sum, s) => (s.isWarmup ? sum : sum + s.weightKg * s.reps), 0)
}

/** 1RM estimado pela fórmula de Epley. Para 1 rep, é o próprio peso. */
export function epley1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

export interface Records {
  maxWeightKg: number
  best1RM: number
}

/** Recordes de um exercício a partir de todas as séries válidas. */
export function records(sets: Pick<SetEntry, 'weightKg' | 'reps' | 'isWarmup'>[]): Records {
  let maxWeightKg = 0
  let best1RM = 0
  for (const s of sets) {
    if (s.isWarmup || s.reps < 1) continue
    if (s.weightKg > maxWeightKg) maxWeightKg = s.weightKg
    const rm = epley1RM(s.weightKg, s.reps)
    if (rm > best1RM) best1RM = rm
  }
  return { maxWeightKg, best1RM }
}

/** Uma série é PR se supera o maior peso anterior (com pelo menos 1 rep). */
export function isWeightPR(previous: Records, weightKg: number, reps: number): boolean {
  return reps >= 1 && weightKg > previous.maxWeightKg
}
