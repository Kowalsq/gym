import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Decision } from '../components/Decision'
import { Heatmap } from '../components/Heatmap'
import { LineChart, type ChartSeries } from '../components/LineChart'
import { IconPlus } from '../components/Icons'
import { db } from '../db/schema'
import { RANGES, analyze, rangeStartFor, suggestNext, type RangeKey } from '../lib/analysis'
import { fmtDayMonth, fmtKg } from '../lib/format'

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)']

function readRange(): RangeKey {
  try {
    const v = localStorage.getItem('ferro:range')
    return (RANGES.some((r) => r.key === v) ? v : '90') as RangeKey
  } catch {
    return '90'
  }
}

/** Painel de evolução. No PC é a tela principal; no celular, um resumo. */
export function Home() {
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const sets = useLiveQuery(() => db.sets.toArray(), [])
  const logs = useLiveQuery(() => db.logs.toArray(), [])

  const [range, setRange] = useState<RangeKey>(readRange)
  const [selected, setSelected] = useState<string[] | null>(null)

  const rangeStart = rangeStartFor(range)
  const analysis = useMemo(
    () => (exercises && sessions && sets && logs ? analyze(exercises, sessions, sets, logs, rangeStart) : null),
    [exercises, sessions, sets, logs, rangeStart],
  )

  const summaries = useMemo(() => {
    if (!analysis) return []
    return [...analysis.byExercise.values()]
      .filter((s) => s.current)
      .sort((a, b) => b.current!.date - a.current!.date || b.sessionsCount - a.sessionsCount)
  }, [analysis])

  // Seleção padrão: os 3 exercícios com mais sessões no período.
  const defaultSelected = useMemo(
    () =>
      [...summaries]
        .sort((a, b) => b.points.filter((p) => p.date >= rangeStart).length - a.points.filter((p) => p.date >= rangeStart).length)
        .slice(0, 3)
        .map((s) => s.exercise.id),
    [summaries, rangeStart],
  )
  const chosen = selected ?? defaultSelected

  const chartSeries: ChartSeries[] = chosen.slice(0, 4).map((id, i) => {
    const s = analysis?.byExercise.get(id)
    return {
      id,
      name: s?.exercise.name ?? '',
      color: COLORS[i],
      points: (s?.points ?? [])
        .filter((p) => p.date >= rangeStart)
        .map((p) => ({ x: p.date, y: p.maxWeightKg, detail: `${p.reps.join(' · ')} reps` })),
    }
  })

  const toIncrease = summaries.filter((s) => s.current?.decision === 'aumentar')
  const toDecrease = summaries.filter((s) => s.current?.decision === 'diminuir')

  function changeRange(k: RangeKey) {
    setRange(k)
    try {
      localStorage.setItem('ferro:range', k)
    } catch {
      /* sem storage */
    }
  }

  function toggle(id: string) {
    const cur = chosen
    if (cur.includes(id)) setSelected(cur.filter((x) => x !== id))
    else if (cur.length < 4) setSelected([...cur, id])
    else setSelected([...cur.slice(1), id])
  }

  if (!analysis) return null

  const empty = summaries.length === 0

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight lg:text-[32px]">Evolução</h1>
          <p className="text-sm text-muted">Carga por exercício, o que aumentar no próximo treino e frequência.</p>
        </div>
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => changeRange(r.key)}
              className={`min-h-9 rounded-full px-3 text-xs font-medium ${
                range === r.key ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <Link
        to="/anotar"
        className="tap flex items-center justify-center gap-2 rounded-full bg-accent px-6 font-semibold text-accent-ink lg:hidden"
      >
        <IconPlus /> Anotar treino de hoje
      </Link>

      {empty ? (
        <div className="card flex flex-col items-start gap-3 p-6">
          <p className="max-w-prose text-muted">
            Nada registrado ainda. Cole suas anotações do WhatsApp em <Link to="/anotar" className="font-semibold text-accent">Anotar</Link>, com uma
            linha de data antes de cada dia, e o painel se preenche sozinho.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Treinos no período" value={String(analysis.sessionsInRange.length)} />
            <Stat label="Exercícios acompanhados" value={String(summaries.length)} />
            <Stat label="Recordes no período" value={String(analysis.prsInRange)} />
            <Stat label="Para aumentar" value={String(toIncrease.length)} hint={toIncrease.length ? 'no próximo treino' : ''} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <section className="card flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="label">Carga máxima por sessão</div>
                <div className="text-xs text-muted">até 4 exercícios · clique para trocar</div>
              </div>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {summaries.slice(0, 14).map((s) => {
                  const idx = chosen.indexOf(s.exercise.id)
                  const on = idx >= 0
                  return (
                    <button
                      key={s.exercise.id}
                      type="button"
                      onClick={() => toggle(s.exercise.id)}
                      className={`flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${
                        on ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2'
                      }`}
                    >
                      {on && <span className="inline-block h-0.5 w-3 rounded" style={{ background: COLORS[idx] }} />}
                      {s.exercise.name}
                    </button>
                  )
                })}
              </div>
              <LineChart series={chartSeries} height={280} formatY={fmtKg} unit="kg" />
              {chartSeries.length > 1 && (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {chartSeries.map((s) => (
                    <li key={s.id} className="flex items-center gap-1.5">
                      <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
                      {s.name}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card flex flex-col gap-3">
              <div className="label">Próximo treino</div>
              {toIncrease.length === 0 && toDecrease.length === 0 ? (
                <p className="text-sm text-muted">Nenhum ajuste marcado. Tudo em "manter".</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {[...toIncrease, ...toDecrease].map((s) => {
                    const cur = s.current!
                    const up = cur.decision === 'aumentar'
                    const next = up ? suggestNext(s.exercise, cur.maxWeightKg) : Math.max(0, cur.maxWeightKg - 2.5)
                    return (
                      <li key={s.exercise.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <Link to={`/exercicios/${s.exercise.id}`} className="block truncate font-medium hover:text-accent">
                            {s.exercise.name}
                          </Link>
                          <div className="text-xs text-muted">{fmtDayMonth(cur.date)} · {cur.reps.join(' · ')} reps</div>
                        </div>
                        <div className="num shrink-0 text-right text-sm">
                          <span className="text-muted">{fmtKg(cur.maxWeightKg)}</span>
                          <span className="mx-1 text-muted">→</span>
                          <span className={up ? 'text-good' : 'text-warn'}>{fmtKg(next)}</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>

          <section className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="label px-4 py-3 font-semibold">Exercício</th>
                  <th className="label px-3 py-3 text-right font-semibold">Carga</th>
                  <th className="label px-3 py-3 font-semibold">Reps</th>
                  <th className="label px-3 py-3 text-right font-semibold">Variação</th>
                  <th className="label px-3 py-3 font-semibold">Próximo</th>
                  <th className="label px-4 py-3 text-right font-semibold">Última vez</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {summaries.map((s) => {
                  const c = s.current!
                  return (
                    <tr key={s.exercise.id} className="hover:bg-surface-2/60">
                      <td className="px-4 py-2.5">
                        <Link to={`/exercicios/${s.exercise.id}`} className="font-medium hover:text-accent">
                          {s.exercise.name}
                        </Link>
                        {c.isPR && <span className="ml-2 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent">PR</span>}
                      </td>
                      <td className="num px-3 py-2.5 text-right">{fmtKg(c.maxWeightKg)} kg</td>
                      <td className="num px-3 py-2.5 text-muted">{c.reps.join(' · ')}</td>
                      <td className={`num px-3 py-2.5 text-right ${s.deltaKg === null ? 'text-muted' : s.deltaKg > 0 ? 'text-good' : s.deltaKg < 0 ? 'text-warn' : 'text-muted'}`}>
                        {s.deltaKg === null ? '—' : `${s.deltaKg > 0 ? '+' : ''}${fmtKg(s.deltaKg)}`}
                      </td>
                      <td className="px-3 py-2.5">{c.decision ? <Decision value={c.decision} /> : <span className="text-muted">—</span>}</td>
                      <td className="px-4 py-2.5 text-right text-muted">{fmtDayMonth(c.date)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          <section className="card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="label">Frequência · últimas 26 semanas</div>
              <div className="text-xs text-muted">{analysis.dayCounts.size} dias com treino no total</div>
            </div>
            <Heatmap counts={analysis.dayCounts} />
          </section>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-3 lg:p-4">
      <div className="label">{label}</div>
      <div className="mt-1 font-display text-[28px] font-extrabold leading-none tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  )
}
