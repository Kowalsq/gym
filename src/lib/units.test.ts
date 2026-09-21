import { describe, expect, it } from 'vitest'
import { fmtLoad, progressionStep, toKg, volumeKgOf, type LoadUnit } from './units'

describe('units', () => {
  it('formata com a unidade certa', () => {
    expect(fmtLoad(22.5, 'kg')).toBe('22,5 kg')
    expect(fmtLoad(60, 'lb')).toBe('60 lb')
    expect(fmtLoad(9, 'tijolo')).toBe('9 tijolos')
    expect(fmtLoad(1, 'tijolo')).toBe('1 tijolo')
  })

  it('converte lb para kg e não converte tijolo', () => {
    expect(toKg(100, 'lb')).toBeCloseTo(45.36, 2)
    expect(toKg(9, 'tijolo')).toBeNull()
  })

  it('passo de progressão por unidade e equipamento', () => {
    expect(progressionStep({ equipment: 'barra' })).toBe(2.5)
    expect(progressionStep({ equipment: 'maquina' })).toBe(5)
    expect(progressionStep({ equipment: 'cabo', loadUnit: 'lb' })).toBe(5)
    expect(progressionStep({ equipment: 'cabo', loadUnit: 'tijolo' })).toBe(1)
  })

  it('volume ignora tijolos e converte lb', () => {
    const sets = [
      { exerciseId: 'kg', weightKg: 50, reps: 10, isWarmup: false },
      { exerciseId: 'lb', weightKg: 100, reps: 10, isWarmup: false },
      { exerciseId: 'tj', weightKg: 9, reps: 12, isWarmup: false },
    ]
    const unitFor = (id: string): LoadUnit => (id === 'lb' ? 'lb' : id === 'tj' ? 'tijolo' : 'kg')
    expect(volumeKgOf(sets, unitFor)).toBeCloseTo(500 + 453.59, 1)
  })
})
