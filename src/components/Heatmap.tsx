import { fmtDayMonth } from '../lib/format'

const DAY = 24 * 60 * 60 * 1000
const ROWS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/**
 * Frequência: uma coluna por semana, uma linha por dia. Célula preenchida no
 * acento quando houve treino; intensidade pela quantidade de exercícios.
 */
export function Heatmap({ counts, weeks = 26 }: { counts: Map<number, number>; weeks?: number }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = today.getTime()
  const startSunday = end - today.getDay() * DAY - (weeks - 1) * 7 * DAY
  const max = Math.max(1, ...counts.values())

  const cols: number[][] = []
  for (let w = 0; w < weeks; w++) {
    const col: number[] = []
    for (let d = 0; d < 7; d++) col.push(startSunday + (w * 7 + d) * DAY)
    cols.push(col)
  }

  const monthLabels: { col: number; label: string }[] = []
  let lastMonth = -1
  cols.forEach((col, i) => {
    const m = new Date(col[0]).getMonth()
    if (m !== lastMonth) {
      monthLabels.push({ col: i, label: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(col[0]).replace('.', '') })
      lastMonth = m
    }
  })

  return (
    <div className="overflow-x-auto">
      <div className="grid gap-1" style={{ gridTemplateColumns: `20px repeat(${weeks}, 12px)` }}>
        <div />
        {cols.map((_, i) => {
          const m = monthLabels.find((ml) => ml.col === i)
          return (
            <div key={i} className="h-4 text-[10px] leading-4 text-muted">
              {m?.label ?? ''}
            </div>
          )
        })}
        {ROWS.map((r, d) => (
          <div key={d} className="contents">
            <div className="text-[10px] leading-3 text-muted">{d % 2 === 1 ? r : ''}</div>
            {cols.map((col, w) => {
              const ts = col[d]
              const n = counts.get(ts) ?? 0
              const future = ts > end
              const alpha = n === 0 ? 0 : 0.35 + 0.65 * (n / max)
              return (
                <div
                  key={w}
                  title={future ? '' : `${fmtDayMonth(ts)}: ${n ? `${n} exercício${n === 1 ? '' : 's'}` : 'sem treino'}`}
                  className={`size-3 rounded-[3px] ${future ? 'opacity-0' : ''} ${ts === end ? 'outline-1 outline-accent' : ''}`}
                  style={{ background: n ? `color-mix(in oklab, var(--accent) ${Math.round(alpha * 100)}%, var(--surface-2))` : 'var(--surface-2)' }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
