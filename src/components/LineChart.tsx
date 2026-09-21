import { useEffect, useMemo, useRef, useState } from 'react'

export interface ChartPoint {
  x: number
  y: number
  /** Texto extra no tooltip (ex.: "10 · 8 reps"). */
  detail?: string
}

export interface ChartSeries {
  id: string
  name: string
  /** Cor CSS, normalmente var(--chart-n). */
  color: string
  points: ChartPoint[]
}

interface Props {
  series: ChartSeries[]
  height?: number
  formatY?: (v: number) => string
  formatX?: (ts: number) => string
  unit?: string
}

// Direita folgada para o rótulo de data do último ponto não cortar.
const PAD = { top: 12, right: 36, bottom: 26, left: 44 }

function niceStep(range: number, targetTicks: number): number {
  const rough = range / Math.max(1, targetTicks)
  const pow = 10 ** Math.floor(Math.log10(rough || 1))
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * pow >= rough) return m * pow
  }
  return 10 * pow
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

const defaultX = (ts: number) =>
  new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(ts).replace('.', '')

/**
 * Gráfico de linha temporal. Um eixo Y, linhas de 2px, marcador só no último
 * ponto e no ponto sob o cursor, grade fina e tooltip com todas as séries no X.
 */
export function LineChart({ series, height = 260, formatY = (v) => String(v), formatX = defaultX, unit = '' }: Props) {
  const [wrapRef, width] = useWidth<HTMLDivElement>()
  const [hoverX, setHoverX] = useState<number | null>(null)

  const xs = useMemo(() => {
    const all = new Set<number>()
    for (const s of series) for (const p of s.points) all.add(p.x)
    return [...all].sort((a, b) => a - b)
  }, [series])

  const visible = series.filter((s) => s.points.length > 0)
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom

  const { xMin, xMax, yMin, yMax, ticks } = useMemo(() => {
    let yLo = Infinity
    let yHi = -Infinity
    for (const s of visible) for (const p of s.points) {
      yLo = Math.min(yLo, p.y)
      yHi = Math.max(yHi, p.y)
    }
    if (!Number.isFinite(yLo)) {
      yLo = 0
      yHi = 10
    }
    if (yHi === yLo) {
      yLo -= 5
      yHi += 5
    }
    const step = niceStep(yHi - yLo, 4)
    const yMin = Math.floor(yLo / step) * step
    const yMax = Math.ceil(yHi / step) * step
    const ticks: number[] = []
    for (let t = yMin; t <= yMax + 1e-9; t += step) ticks.push(Math.round(t * 1000) / 1000)
    const xMin = xs[0] ?? 0
    const xMax = xs[xs.length - 1] ?? 1
    return { xMin, xMax, yMin, yMax, ticks }
  }, [visible, xs])

  const sx = (x: number) => PAD.left + (xMax === xMin ? plotW / 2 : ((x - xMin) / (xMax - xMin)) * plotW)
  const sy = (y: number) => PAD.top + plotH - ((y - yMin) / (yMax - yMin || 1)) * plotH

  // Rótulos de X: até 5, escolhidos entre as datas existentes.
  const xTicks = useMemo(() => {
    if (xs.length <= 5) return xs
    const out: number[] = []
    for (let i = 0; i < 5; i++) out.push(xs[Math.round((i * (xs.length - 1)) / 4)])
    return out
  }, [xs])

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    if (xs.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    let best = xs[0]
    let bestD = Infinity
    for (const x of xs) {
      const d = Math.abs(sx(x) - px)
      if (d < bestD) {
        bestD = d
        best = x
      }
    }
    setHoverX(best)
  }

  function onKey(e: React.KeyboardEvent<SVGSVGElement>) {
    if (xs.length === 0) return
    const i = hoverX === null ? xs.length - 1 : xs.indexOf(hoverX)
    if (e.key === 'ArrowLeft') setHoverX(xs[Math.max(0, i - 1)])
    if (e.key === 'ArrowRight') setHoverX(xs[Math.min(xs.length - 1, i + 1)])
    if (e.key === 'Escape') setHoverX(null)
  }

  const hovered = hoverX === null ? null : visible.map((s) => ({ s, p: s.points.find((p) => p.x === hoverX) })).filter((r) => r.p)
  const tooltipLeft = hoverX === null ? 0 : sx(hoverX)
  const flip = tooltipLeft > width * 0.6

  return (
    <div ref={wrapRef} className="relative w-full select-none">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Gráfico de ${visible.map((s) => s.name).join(', ')}`}
          tabIndex={0}
          onPointerMove={onMove}
          onPointerLeave={() => setHoverX(null)}
          onKeyDown={onKey}
          onFocus={() => hoverX === null && xs.length && setHoverX(xs[xs.length - 1])}
          onBlur={() => setHoverX(null)}
          className="block outline-none focus-visible:[outline:2px_solid_var(--accent)]"
        >
          {/* grade */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={sy(t)} y2={sy(t)} stroke="var(--line)" strokeWidth={1} />
              <text
                x={PAD.left - 8}
                y={sy(t)}
                dy="0.35em"
                textAnchor="end"
                fontSize={11}
                fill="var(--muted)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatY(t)}
              </text>
            </g>
          ))}
          {xTicks.map((x) => (
            <text key={x} x={sx(x)} y={height - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
              {formatX(x)}
            </text>
          ))}

          {/* áreas (só quando há uma série) */}
          {visible.length === 1 &&
            visible.map((s) => {
              const pts = s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' L')
              const first = s.points[0]
              const last = s.points[s.points.length - 1]
              return (
                <path
                  key={s.id}
                  d={`M${sx(first.x)},${sy(yMin)} L${pts} L${sx(last.x)},${sy(yMin)} Z`}
                  fill={s.color}
                  opacity={0.1}
                />
              )
            })}

          {/* linhas */}
          {visible.map((s) => (
            <polyline
              key={s.id}
              points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* marcador do último ponto, com anel da superfície */}
          {visible.map((s) => {
            const last = s.points[s.points.length - 1]
            return (
              <circle key={s.id} cx={sx(last.x)} cy={sy(last.y)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
            )
          })}

          {/* crosshair */}
          {hoverX !== null && (
            <g>
              <line x1={sx(hoverX)} x2={sx(hoverX)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--muted)" strokeWidth={1} />
              {hovered?.map(({ s, p }) => (
                <circle key={s.id} cx={sx(p!.x)} cy={sy(p!.y)} r={5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
      )}

      {hoverX !== null && hovered && hovered.length > 0 && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-[140px] rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs shadow-lg"
          style={flip ? { right: width - tooltipLeft + 10 } : { left: tooltipLeft + 10 }}
        >
          <div className="label mb-1">{formatX(hoverX)}</div>
          {hovered.map(({ s, p }) => (
            <div key={s.id} className="flex items-center gap-2 py-0.5">
              <span className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} />
              <span className="num text-sm text-text">
                {formatY(p!.y)}
                {unit && <span className="ml-0.5 text-[11px] font-medium text-muted">{unit}</span>}
              </span>
              {visible.length > 1 && <span className="truncate text-muted">{s.name}</span>}
              {p!.detail && <span className="text-muted">{p!.detail}</span>}
            </div>
          ))}
        </div>
      )}

      {visible.length === 0 && (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted">Sem dados no período.</div>
      )}
    </div>
  )
}
