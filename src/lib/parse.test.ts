import { describe, expect, it } from 'vitest'
import { formatLine, normalizeName, parseLine, parseNotes } from './parse'

describe('parseLine', () => {
  it('nome, peso, reps e decisão', () => {
    const p = parseLine('Desenvolvimento máquina 75 10 7 manter')!
    expect(p.name).toBe('Desenvolvimento máquina')
    expect(p.weightKg).toBe(75)
    expect(p.reps).toEqual([10, 7])
    expect(p.decision).toBe('manter')
    expect(p.warnings).toEqual([])
  })

  it('peso com kg no meio', () => {
    const p = parseLine('Crucifixo invertido 30kg 10 8 manter')!
    expect(p.name).toBe('Crucifixo invertido')
    expect(p.weightKg).toBe(30)
    expect(p.reps).toEqual([10, 8])
  })

  it('NxR com peso depois', () => {
    const p = parseLine('Crucifixo 2x8 55kg manter')!
    expect(p.name).toBe('Crucifixo')
    expect(p.weightKg).toBe(55)
    expect(p.reps).toEqual([8, 8])
    expect(p.decision).toBe('manter')
  })

  it('peso decimal com vírgula e decisão em sinônimo', () => {
    const p = parseLine('Rosca direta 22,5 12 10 subir')!
    expect(p.weightKg).toBe(22.5)
    expect(p.reps).toEqual([12, 10])
    expect(p.decision).toBe('aumentar')
  })

  it('sem decisão', () => {
    const p = parseLine('Remada baixa 120 10 8')!
    expect(p.decision).toBeNull()
    expect(p.warnings).toEqual([])
  })

  it('avisa quando falta reps', () => {
    const p = parseLine('Prancha 60')!
    expect(p.weightKg).toBe(60)
    expect(p.warnings).toContain('Sem repetições.')
  })

  it('linha vazia é null', () => {
    expect(parseLine('   ')).toBeNull()
  })
})

describe('parseNotes', () => {
  const today = new Date(2026, 8, 21).getTime()

  it('linhas sem data caem no dia padrão', () => {
    const days = parseNotes('Remada baixa 120 10 8 manter\nCrucifixo 2x8 55kg manter', today)
    expect(days).toHaveLength(1)
    expect(days[0].date).toBe(today)
    expect(days[0].lines).toHaveLength(2)
  })

  it('linha de data abre novo dia', () => {
    const text = ['18/09', 'Supino 80 8 8 aumentar', 'Segunda 21/09', 'Supino 82,5 8 7 manter'].join('\n')
    const days = parseNotes(text, today)
    expect(days).toHaveLength(2)
    expect(days[0].date).toBe(new Date(2026, 8, 18).getTime())
    expect(days[1].date).toBe(today)
    expect(days[1].lines[0].weightKg).toBe(82.5)
  })

  it('remove prefixo de exportação do WhatsApp e usa a data', () => {
    const text = [
      '15/09/2026 18:32 - Felipe: Remada baixa 120 10 8 manter',
      '15/09/2026 18:33 - Felipe: Crucifixo 2x8 55kg manter',
      '17/09/2026 19:01 - Felipe: Agachamento 100 8 8 aumentar',
    ].join('\n')
    const days = parseNotes(text, today)
    expect(days).toHaveLength(2)
    expect(days[0].date).toBe(new Date(2026, 8, 15).getTime())
    expect(days[0].lines.map((l) => l.name)).toEqual(['Remada baixa', 'Crucifixo'])
    expect(days[1].lines[0].decision).toBe('aumentar')
  })
})

describe('normalizeName', () => {
  it('ignora acento, caixa e espaços', () => {
    expect(normalizeName('  Desenvolvimento   MÁQUINA ')).toBe('desenvolvimento maquina')
  })
})

describe('formatLine', () => {
  it('compacta reps iguais em NxR', () => {
    expect(formatLine('Crucifixo', 55, [8, 8], 'manter')).toBe('Crucifixo 55 2x8 manter')
  })
  it('mantém reps diferentes separadas', () => {
    expect(formatLine('Remada baixa', 120, [10, 8], null)).toBe('Remada baixa 120 10 8')
  })
})
