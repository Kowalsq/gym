import { describe, expect, it } from 'vitest'
import type { Exercise } from './schema'
import { resolveNames } from './notes'

const lib: Exercise[] = [
  { id: '1', name: 'Remada baixa no cabo', muscleGroup: 'costas', equipment: 'cabo', createdAt: 0 },
  { id: '2', name: 'Crucifixo na máquina', muscleGroup: 'peito', equipment: 'maquina', createdAt: 0 },
  { id: '3', name: 'Supino reto', muscleGroup: 'peito', equipment: 'barra', createdAt: 0 },
  { id: '4', name: 'Supino inclinado com halteres', muscleGroup: 'peito', equipment: 'halter', createdAt: 0 },
]

describe('resolveNames', () => {
  it('casa nome exato ignorando acento e caixa', () => {
    const r = resolveNames(['supino RETO', 'crucifixo na maquina'], lib)
    expect(r.get('supino reto')?.id).toBe('3')
    expect(r.get('crucifixo na maquina')?.id).toBe('2')
  })

  it('duas palavras casam por prefixo único', () => {
    const r = resolveNames(['Remada baixa'], lib)
    expect(r.get('remada baixa')?.id).toBe('1')
  })

  it('uma palavra nunca casa por prefixo', () => {
    const r = resolveNames(['Crucifixo'], lib)
    expect(r.get('crucifixo')).toBeNull()
  })

  it('prefixo ambíguo não casa', () => {
    const r = resolveNames(['Supino inclinado'], lib)
    // "Supino inclinado" é prefixo de um só, então casa; "Supino" sozinho, não.
    expect(r.get('supino inclinado')?.id).toBe('4')
    expect(resolveNames(['Supino'], lib).get('supino')).toBeNull()
  })

  it('o mesmo nome resolve uma vez para o texto inteiro', () => {
    const r = resolveNames(['Crucifixo', 'Crucifixo invertido', 'Crucifixo'], lib)
    expect([...r.keys()]).toEqual(['crucifixo', 'crucifixo invertido'])
  })
})
