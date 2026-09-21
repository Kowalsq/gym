import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Decision } from '../components/Decision'
import { Heatmap } from '../components/Heatmap'
import { LineChart, type ChartSeries } from '../components/LineChart'
import { IconPlus } from '../components/Icons'
import { SyncBadge } from '../components/SyncBadge'
import { db, getSetting, type WeekPlan } from '../db/schema'
import { RANGES, analyze, dayKey, rangeStartFor, suggestNext, suggestPrev, type RangeKey } from '../lib/analysis'
import { fmtDayMonth, fmtKm } from '../lib/format'
import { fmtLoad, fmtLoadValue, unitLabel, unitOf } from '../lib/units'
import { WEEKDAY_SHORT, slotLabel, suggestRoutine, weekStart } from '../lib/plan'
import { skipStreaks } from '../lib/skips'

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)']
const DAY = 24 * 60 * 60 * 1000

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
  const routines = useLiveQuery(() => db.routines.orderBy('order').toArray(), [])
  const plan = useLiveQuery(() => getSetting<WeekPlan>('weekPlan'), [])

  const [range, setRange] = useState<RangeKey>(readRange)
  const [selected, setSelected] = useState<string[] | null>(null)
  const [now] = useState(() => Date.now())

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
      name: s ? `${s.exercise.name}${unitOf(s.exercise) !== 'kg' ? ` (${unitLabel(unitOf(s.exercise))})` : ''}` : '',
      color: COLORS[i],
      points: (s?.points ?? []).filter((p) => p.date >= rangeStart).map((p) => ({ x: p.date, y: p.maxWeightKg, detail: `${p.reps.join(' · ')} reps` })),
    }
  })

  const suggestion = useMemo(() => (routines && sessions ? suggestRoutine(plan, routines, sessions, now) : null), [plan, routines, sessions, now])
  const toIncrease = summaries.filter((s) => s.current?.decision === 'aumentar').length
  // Unidade do eixo: só quando todas as séries escolhidas usam a mesma.
  const chartUnits = new Set(chosen.map((id) => unitOf(analysis?.byExercise.get(id)?.exercise)))
  const chartUnit = chartUnits.size === 1 ? unitLabel([...chartUnits][0]) : ''
  const skips = useMemo(
    () => (routines && sessions && sets && exercises ? skipStreaks(routines, sessions, sets, exercises) : []),
    [routines, sessions, sets, exercises],
  )
  const skipFor = (routineId: string, exerciseId: string) => skips.find((k) => k.routine.id === routineId && k.exercise.id === exerciseId)

  // Semana corrente: plano, feito, hoje.
  const ws = weekStart(now)
  const todayKey = dayKey(now)
  const week = Array.from({ length: 7 }, (_, d) => {
    const dayTs = ws + d * DAY
    const done = (sessions ?? []).filter((s) => s.endedAt !== undefined && dayKey(s.startedAt) === dayTs)
    const slot = plan?.[d]
    return {
      d,
      dayTs,
      slot,
      planned: slot ? slotLabel(slot, routines ?? []) : '',
      doneGym: done.find((s) => s.kind !== 'run'),
      doneRun: done.find((s) => s.kind === 'run'),
      isToday: dayTs === todayKey,
      past: dayTs < todayKey,
    }
  })

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

  if (!analysis || !routines) return null
  const empty = summaries.length === 0
  const runs = analysis.sessionsInRange.filter((s) => s.kind === 'run')
  const gymCount = analysis.sessionsInRange.length - runs.length
  const runKm = runs.reduce((n, s) => n + (s.distanceKm ?? 0), 0)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight lg:text-[32px]">Evolução</h1>
          <p className="text-sm text-muted">Carga por exercício, o próximo treino e a semana.</p>
          <SyncBadge className="mt-1 lg:hidden" />
        </div>
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => changeRange(r.key)}
              className={`min-h-9 rounded-full px-3 text-xs font-medium ${range === r.key ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {/* Semana */}
      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <span className="label">Esta semana</span>
          <Link to="/treinos" className="text-xs font-medium text-muted hover:text-accent">
            Editar plano ›
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((w) => {
            const doneAny = w.doneGym || w.doneRun
            const missed = w.past && !doneAny && w.slot && w.slot.type !== 'rest'
            const label = w.doneGym ? (routines.find((r) => r.id === w.doneGym!.routineId)?.name ?? '✓') : w.doneRun ? 'Corrida' : w.planned
            const isRun = w.doneRun ? !w.doneGym : w.slot?.type === 'run'
            return (
              <div key={w.d} className={`flex flex-col items-center gap-1 rounded-lg py-2 ${w.isToday ? 'bg-surface-2' : ''}`}>
                <span className={`text-[11px] font-semibold ${w.isToday ? 'text-text' : 'text-muted'}`}>{WEEKDAY_SHORT[w.d]}</span>
                <span
                  className={`grid h-8 min-w-8 place-items-center rounded-full px-2 font-display text-sm font-extrabold ${
                    doneAny
                      ? isRun
                        ? 'bg-chart-2 text-white'
                        : 'bg-accent text-accent-ink'
                      : missed
                        ? 'bg-transparent text-muted outline-1 outline-dashed outline-line'
                        : w.slot && w.slot.type !== 'rest'
                          ? isRun
                            ? 'bg-chart-2/15 text-chart-2'
                            : 'bg-accent-soft text-accent'
                          : 'text-muted'
                  }`}
                >
                  {label === 'Corrida' ? 'C' : label === 'Descanso' || !label ? '—' : label}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {skips.length > 0 && (
        <section className="card flex flex-col gap-2 border border-warn/30">
          <div className="flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded-full bg-warn/15 text-[11px] font-bold text-warn" aria-hidden>!</span>
            <span className="label">Sendo pulados</span>
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            {skips.map((k) => (
              <li key={`${k.routine.id}-${k.exercise.id}`} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <Link to={`/exercicios/${k.exercise.id}`} className="font-medium hover:text-accent">
                  {k.exercise.name}
                </Link>
                <span className="text-xs text-muted">
                  não feito nos últimos {k.streak} treinos {k.routine.name}
                  {k.lastDoneAt ? ` · última vez ${fmtDayMonth(k.lastDoneAt)}` : ' · nunca feito'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link to="/anotar" className="tap flex items-center justify-center gap-2 rounded-full bg-accent px-6 font-semibold text-accent-ink lg:hidden">
        <IconPlus /> Anotar {suggestion ? `treino ${suggestion.routine.name}` : 'treino de hoje'}
      </Link>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="card flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="label">Carga máxima por sessão</div>
            <div className="text-xs text-muted">até 4 exercícios · clique para trocar</div>
          </div>
          {empty ? (
            <p className="max-w-prose py-8 text-center text-sm text-muted">
              Nada registrado ainda. Anote o treino de hoje em <Link to="/anotar" className="font-semibold text-accent">Anotar</Link> ou cole o histórico do WhatsApp com uma linha de data antes de cada dia.
            </p>
          ) : (
            <>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {summaries.slice(0, 16).map((s) => {
                  const idx = chosen.indexOf(s.exercise.id)
                  const on = idx >= 0
                  return (
                    <button
                      key={s.exercise.id}
                      type="button"
                      onClick={() => toggle(s.exercise.id)}
                      className={`flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${on ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2'}`}
                    >
                      {on && <span className="inline-block h-0.5 w-3 rounded" style={{ background: COLORS[idx] }} />}
                      {s.exercise.name}
                    </button>
                  )
                })}
              </div>
              <LineChart series={chartSeries} height={280} formatY={fmtLoadValue} unit={chartUnit} />
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
            </>
          )}
        </section>

        <section className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="label">Próximo treino</div>
            {suggestion && (
              <span className="text-xs text-muted">
                {suggestion.reason === 'hoje'
                  ? 'plano de hoje'
                  : suggestion.todaySlot?.type === 'run'
                    ? 'próximo na sequência · hoje é dia de corrida'
                    : 'próximo na sequência'}
              </span>
            )}
          </div>
          {!suggestion ? (
            <p className="text-sm text-muted">
              Nenhum treino cadastrado. <Link to="/treinos" className="font-semibold text-accent">Criar em Treinos</Link>.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-display text-[32px] font-extrabold leading-none tracking-tight whitespace-nowrap">Treino {suggestion.routine.name}</span>
                {suggestion.routine.description && <span className="text-xs text-muted">{suggestion.routine.description}</span>}
              </div>
              <ul className="flex flex-col divide-y divide-line">
                {suggestion.routine.items.map((it, i) => {
                  const cands = [it.exerciseId, ...(it.alternativeIds ?? [])]
                    .map((id) => analysis.byExercise.get(id))
                    .filter((s) => s?.current)
                    .sort((a, b) => b!.current!.date - a!.current!.date)
                  const s = cands[0] ?? analysis.byExercise.get(it.exerciseId)
                  if (!s) return null
                  const cur = s.current
                  const up = cur?.decision === 'aumentar'
                  const down = cur?.decision === 'diminuir'
                  const next = cur ? (up ? suggestNext(s.exercise, cur.maxWeightKg) : down ? suggestPrev(s.exercise, cur.maxWeightKg) : cur.maxWeightKg) : null
                  return (
                    <li key={`${it.exerciseId}-${i}`} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <Link to={`/exercicios/${s.exercise.id}`} className="block truncate text-sm font-medium hover:text-accent">
                          {s.exercise.name}
                        </Link>
                        <div className="text-[11px] text-muted">
                          {it.targetSets}×{it.targetRepsMin}–{it.targetRepsMax}
                          {it.rirMin !== undefined ? ` · RIR ${it.rirMin}–${it.rirMax ?? it.rirMin}` : ''}
                          {cur ? ` · última ${fmtDayMonth(cur.date)}: ${cur.reps.join(' · ')}` : ' · nunca feito'}
                          {(() => {
                            const k = skipFor(suggestion.routine.id, it.exerciseId)
                            return k ? <span className="ml-1 font-semibold text-warn">· pulado {k.streak}×</span> : null
                          })()}
                        </div>
                      </div>
                      <div className="num shrink-0 text-right text-sm">
                        {cur ? (
                          up || down ? (
                            <>
                              <span className="text-muted">{fmtLoadValue(cur.maxWeightKg)}</span>
                              <span className="mx-1 text-muted">→</span>
                              <span className={up ? 'text-good' : 'text-warn'}>{fmtLoad(next!, unitOf(s.exercise))}</span>
                            </>
                          ) : (
                            <span>{fmtLoad(cur.maxWeightKg, unitOf(s.exercise))}</span>
                          )
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
              <Link to={`/anotar?treino=${suggestion.routine.id}`} className="tap flex items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent hover:bg-accent hover:text-accent-ink">
                Anotar treino {suggestion.routine.name}
              </Link>
            </>
          )}
        </section>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Treinos no período" value={String(gymCount)} />
        <Stat label="Corridas" value={String(runs.length)} hint={runKm ? `${fmtKm(Math.round(runKm * 10) / 10)} km` : ''} />
        <Stat label="Exercícios acompanhados" value={String(summaries.length)} />
        <Stat label="Recordes no período" value={String(analysis.prsInRange)} />
        <Stat label="Para aumentar" value={String(toIncrease)} hint={toIncrease ? 'marcados na última vez' : ''} />
      </div>

      {!empty && (
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
                    <td className="num px-3 py-2.5 text-right">{fmtLoad(c.maxWeightKg, unitOf(s.exercise))}</td>
                    <td className="num px-3 py-2.5 text-muted">{c.reps.join(' · ')}</td>
                    <td className={`num px-3 py-2.5 text-right ${s.deltaKg === null ? 'text-muted' : s.deltaKg > 0 ? 'text-good' : s.deltaKg < 0 ? 'text-warn' : 'text-muted'}`}>
                      {s.deltaKg === null ? '—' : `${s.deltaKg > 0 ? '+' : ''}${fmtLoadValue(s.deltaKg)} ${unitLabel(unitOf(s.exercise), Math.abs(s.deltaKg))}`}
                    </td>
                    <td className="px-3 py-2.5">{c.decision ? <Decision value={c.decision} /> : <span className="text-muted">—</span>}</td>
                    <td className="px-4 py-2.5 text-right text-muted">{fmtDayMonth(c.date)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      <section className="card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="label">Frequência · últimas 26 semanas</div>
          <div className="text-xs text-muted">{analysis.dayCounts.size} dias ativos no total</div>
        </div>
        <Heatmap counts={analysis.dayCounts} />
      </section>
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
