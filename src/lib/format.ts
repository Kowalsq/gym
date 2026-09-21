const kgFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const intFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

export const fmtKg = (kg: number): string => kgFormatter.format(kg)
export const fmtInt = (n: number): string => intFormatter.format(n)

/** "58 min" ou "1 h 04" para durações em ms. */
export function fmtDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000)
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h} h ${String(m).padStart(2, '0')}`
}

/** "31:04" para cronômetro em ms. */
export function fmtClock(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

const dayMonth = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })
const weekdayLong = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })

export const fmtDayMonth = (ts: number): string => dayMonth.format(ts).replace('.', '')
export const fmtWeekday = (ts: number): string => {
  const s = weekdayLong.format(ts).replace('.', '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const MUSCLE_LABEL: Record<string, string> = {
  peito: 'Peito',
  costas: 'Costas',
  ombro: 'Ombro',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  pernas: 'Pernas',
  gluteo: 'Glúteo',
  core: 'Core',
  cardio: 'Cardio',
  outro: 'Outro',
}

export const EQUIPMENT_LABEL: Record<string, string> = {
  barra: 'Barra',
  halter: 'Halter',
  maquina: 'Máquina',
  cabo: 'Cabo',
  corporal: 'Peso corporal',
  outro: 'Outro',
}
