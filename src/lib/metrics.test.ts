import { describe, expect, it } from 'vitest'
import { epley1RM, isWeightPR, records, volumeKg } from './metrics'

describe('volumeKg', () => {
  it('soma peso × reps e ignora aquecimento', () => {
    const sets = [
      { weightKg: 40, reps: 10, isWarmup: true },
      { weightKg: 80, reps: 8, isWarmup: false },
      { weightKg: 80, reps: 7, isWarmup: false },
    ]
    expect(volumeKg(sets)).toBe(1200)
  })

  it('retorna 0 sem séries', () => {
    expect(volumeKg([])).toBe(0)
  })
})

describe('epley1RM', () => {
  it('para 1 rep é o próprio peso', () => {
    expect(epley1RM(100, 1)).toBe(100)
  })

  it('82,5 × 6 dá cerca de 99', () => {
    expect(epley1RM(82.5, 6)).toBeCloseTo(99, 0)
  })

  it('entradas inválidas dão 0', () => {
    expect(epley1RM(0, 5)).toBe(0)
    expect(epley1RM(80, 0)).toBe(0)
  })
})

describe('records', () => {
  it('separa maior peso de melhor 1RM estimado', () => {
    const r = records([
      { weightKg: 100, reps: 1, isWarmup: false },
      { weightKg: 90, reps: 8, isWarmup: false },
      { weightKg: 120, reps: 0, isWarmup: false },
    ])
    expect(r.maxWeightKg).toBe(100)
    expect(r.best1RM).toBeCloseTo(114, 0)
  })
})

describe('isWeightPR', () => {
  const prev = { maxWeightKg: 80, best1RM: 100 }
  it('é PR quando supera o maior peso com ao menos 1 rep', () => {
    expect(isWeightPR(prev, 82.5, 5)).toBe(true)
    expect(isWeightPR(prev, 80, 10)).toBe(false)
    expect(isWeightPR(prev, 90, 0)).toBe(false)
  })
})
