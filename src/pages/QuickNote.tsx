import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Decision } from '../components/Decision'
import { isUsableLift, isUsableRun, matchExercises, saveParsedDays } from '../db/notes'
import { db, getSetting, type Routine, type RoutineItem, type WeekPlan } from '../db/schema'
import { analyze, suggestNext, suggestPrev } from '../lib/analysis'
import { fmtDayMonth, fmtKm, fmtClock } from '../lib/format'
import { fmtLoad, unitOf } from '../lib/units'
import { formatLine, formatRunLine, parseNotes } from '../lib/parse'
import { suggestRoutine } from '../lib/plan'
import { QuickForm } from './QuickForm'

const EXAMPLE = `Desenvolvimento máquina 75 10 7 manter
Remada baixa 120 10 8 manter
Crucifixo 2x8 55kg aumentar
Corrida 5km 28:30`

function todayMidnight(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
function toInputDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fromInputDate(s: string): number {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

type Mode = { kind: 'routine'; id: string } | { kind: 'free' } | { kind: 'run' }

/** Anotação rápida: o mesmo texto que iria para o WhatsApp, uma linha por exercício. */
export function QuickNote() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const routines = useLiveQuery(() => db.routines.orderBy('order').toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const sets = useLiveQuery(() => db.sets.toArray(), [])
  const logs = useLiveQuery(() => db.logs.toArray(), [])
  const plan = useLiveQuery(() => getSetting<WeekPlan>('weekPlan'), [])

  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem('ferro:draft') ?? ''
    } catch {
      return ''
    }
  })
  const [date, setDate] = useState(() => toInputDate(todayMidnight()))
  const [mode, setMode] = useState<Mode | null>(null)
  const [entry, setEntry] = useState<'form' | 'text'>(() => {
    try {
      return localStorage.getItem('ferro:entry') === 'text' ? 'text' : 'form'
    } catch {
      return 'form'
    }
  })
  function changeEntry(v: 'form' | 'text') {
    setEntry(v)
    try {
      localStorage.setItem('ferro:entry', v)
    } catch {
      /* sem storage */
    }
  }
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const suggestion = useMemo(
    () => (routines && sessions ? suggestRoutine(plan, routines, sessions) : null),
    [plan, routines, sessions],
  )

  // Modo padrão: ?treino=<id>, senão a sugestão do dia. Derivado na renderização; o estado só guarda a escolha manual.
  const defaultMode: Mode | null = useMemo(() => {
    if (!routines) return null
    const fromUrl = params.get('treino')
    if (fromUrl === 'corrida') return { kind: 'run' }
    if (fromUrl && routines.some((r) => r.id === fromUrl)) return { kind: 'routine', id: fromUrl }
    if (suggestion) return { kind: 'routine', id: suggestion.routine.id }
    return { kind: 'free' }
  }, [routines, params, suggestion])
  const effectiveMode = mode ?? defaultMode

  const analysis = useMemo(
    () => (exercises && sessions && sets && logs ? analyze(exercises, sessions, sets, logs, 0) : null),
    [exercises, sessions, sets, logs],
  )

  const routine: Routine | null = effectiveMode?.kind === 'routine' ? (routines?.find((r) => r.id === effectiveMode.id) ?? null) : null

  const days = useMemo(() => parseNotes(text, fromInputDate(date)), [text, date])
  const matchedDays = useMemo(() => days.map((d) => ({ ...d, lines: matchExercises(d.lines, exercises ?? []) })), [days, exercises])
  const validLifts = matchedDays.reduce((n, d) => n + d.lines.filter(isUsableLift).length, 0)
  const validRuns = matchedDays.reduce((n, d) => n + d.lines.filter(isUsableRun).length, 0)
  const totalLines = matchedDays.reduce((n, d) => n + d.lines.length, 0)

  /** Alvo do exercício dentro da rotina escolhida (principal ou alternativa). */
  function targetFor(exerciseId: string | undefined): RoutineItem | undefined {
    if (!routine || !exerciseId) return undefined
    return routine.items.find((it) => it.exerciseId === exerciseId || it.alternativeIds?.includes(exerciseId))
  }

  function onChange(v: string) {
    setText(v)
    setDone(null)
    try {
      localStorage.setItem('ferro:draft', v)
    } catch {
      /* sem storage */
    }
  }

  /** Preenche uma linha por exercício do treino com a última carga (ou a sugerida, se marcou aumentar). */
  function fillFromRoutine() {
    if (!routine || !analysis) return
    const lines = routine.items.map((it) => {
      // Se da última vez foi feita uma alternativa, mantém a alternativa.
      const candidates = [it.exerciseId, ...(it.alternativeIds ?? [])]
        .map((id) => analysis.byExercise.get(id))
        .filter((s) => s && s.current)
        .sort((a, b) => b!.current!.date - a!.current!.date)
      const chosen = candidates[0] ?? analysis.byExercise.get(it.exerciseId)
      if (!chosen) return ''
      const cur = chosen.current
      if (!cur) return formatLine(chosen.exercise.name, null, Array(it.targetSets).fill(it.targetRepsMin), null)
      const weight = cur.decision === 'aumentar' ? suggestNext(chosen.exercise, cur.maxWeightKg) : cur.decision === 'diminuir' ? suggestPrev(chosen.exercise, cur.maxWeightKg) : cur.maxWeightKg
      return formatLine(chosen.exercise.name, weight, cur.reps.length ? cur.reps : Array(it.targetSets).fill(it.targetRepsMin), null, unitOf(chosen.exercise))
    })
    onChange(lines.filter(Boolean).join('\n'))
  }

  function fillRun() {
    const lastRun = (sessions ?? []).filter((s) => s.kind === 'run' && s.distanceKm && s.durationSec).sort((a, b) => b.startedAt - a.startedAt)[0]
    onChange(lastRun ? formatRunLine(lastRun.distanceKm!, lastRun.durationSec!) : 'Corrida 5km 30:00')
  }

  function describe(r: { sets: number; sessions: number; runs: number; newExercises: number }) {
    const parts = [
      r.sets ? `${r.sets} séries em ${r.sessions} treino${r.sessions === 1 ? '' : 's'}` : '',
      r.runs ? `${r.runs} corrida${r.runs === 1 ? '' : 's'}` : '',
      r.newExercises ? `${r.newExercises} exercício${r.newExercises === 1 ? '' : 's'} novo${r.newExercises === 1 ? '' : 's'}` : '',
    ].filter(Boolean)
    return `Salvo: ${parts.join(', ')}.`
  }

  async function onSave() {
    if ((validLifts === 0 && validRuns === 0) || saving) return
    setSaving(true)
    try {
      const r = await saveParsedDays(days, exercises ?? [], routine ? { routineId: routine.id, routineName: routine.name } : {})
      onChange('')
      setDone(describe(r))
    } finally {
      setSaving(false)
    }
  }

  const isMode = (m: Mode) => effectiveMode && JSON.stringify(effectiveMode) === JSON.stringify(m)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight">Anotar</h1>
          <p className="text-sm text-muted">
            {routine && entry === 'form' ? 'Carga da última vez já preenchida. Digite só as reps de cada série.' : 'Uma linha por exercício, do jeito que você já escreve.'}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="label">Dia</span>
          <input id="note-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field h-10 px-3 text-sm" />
        </label>
      </header>

      {routines && routines.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {routines.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setMode({ kind: 'routine', id: r.id })}
              className={`min-h-9 rounded-full px-3.5 text-sm font-semibold ${isMode({ kind: 'routine', id: r.id }) ? 'bg-accent text-accent-ink' : 'bg-surface-2'}`}
            >
              Treino {r.name}
              {suggestion?.routine.id === r.id && !isMode({ kind: 'routine', id: r.id }) && <span className="ml-1 text-[10px] text-accent">●</span>}
            </button>
          ))}
          <button type="button" onClick={() => setMode({ kind: 'run' })} className={`min-h-9 rounded-full px-3.5 text-sm font-semibold ${isMode({ kind: 'run' }) ? 'bg-accent text-accent-ink' : 'bg-surface-2'}`}>
            Corrida
          </button>
          <button type="button" onClick={() => setMode({ kind: 'free' })} className={`min-h-9 rounded-full px-3.5 text-sm font-semibold ${isMode({ kind: 'free' }) ? 'bg-accent text-accent-ink' : 'bg-surface-2'}`}>
            Livre
          </button>
          {suggestion && (
            <span className="ml-1 text-xs text-muted">
              {suggestion.reason === 'hoje'
                ? `Plano de hoje: treino ${suggestion.routine.name}`
                : `Próximo na sequência: treino ${suggestion.routine.name}${suggestion.todaySlot?.type === 'run' ? ' · hoje é dia de corrida' : ''}`}
            </span>
          )}
        </div>
      )}

      {routine && (
        <div className="flex items-center gap-1 self-start rounded-full bg-surface-2 p-1 text-xs font-semibold">
          {(['form', 'text'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => changeEntry(v)}
              className={`min-h-8 rounded-full px-3 ${entry === v ? 'bg-accent text-accent-ink' : 'text-muted'}`}
              aria-pressed={entry === v}
            >
              {v === 'form' ? 'Rápido' : 'Texto'}
            </button>
          ))}
        </div>
      )}

      {routine && entry === 'form' && analysis && exercises && (
        <QuickForm
          key={`${routine.id}-${date}-${done ?? ''}`}
          routine={routine}
          exercises={exercises}
          analysis={analysis}
          date={fromInputDate(date)}
          onSaved={(r) => setDone(describe(r))}
        />
      )}

      {routine && entry === 'form' && done && (
        <button type="button" onClick={() => navigate('/historico')} className="self-start text-sm font-medium text-good">
          {done} Ver histórico ›
        </button>
      )}

      {(!routine || entry === 'text') && (
      <>
      {(routine || effectiveMode?.kind === 'run') && !text && (
        <button
          type="button"
          onClick={routine ? fillFromRoutine : fillRun}
          className="tap flex items-center justify-center rounded-card border border-dashed border-line text-sm font-semibold text-muted hover:text-text"
        >
          {routine ? `Preencher com o treino ${routine.name} e a última carga` : 'Preencher com a última corrida'}
        </button>
      )}

      <textarea
        id="note-text"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={EXAMPLE}
        rows={routine ? Math.max(8, routine.items.length + 1) : 8}
        spellCheck={false}
        className="field num min-h-[180px] w-full resize-y px-4 py-3 text-[15px] leading-relaxed placeholder:text-muted/60"
      />

      {totalLines > 0 && (
        <section className="flex flex-col gap-3">
          <div className="label">O que entendi</div>
          {matchedDays.map((day) => (
            <div key={day.date} className="card flex flex-col gap-2 p-3">
              {matchedDays.length > 1 && <div className="label">{fmtDayMonth(day.date)}</div>}
              <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[1fr_80px_1fr_120px]">
                {day.lines.map((l, i) => {
                  if (l.kind === 'run') {
                    const ok = isUsableRun(l)
                    return (
                      <div key={i} className="contents">
                        <div className={`font-medium ${ok ? '' : 'text-warn'}`}>Corrida</div>
                        <div className="num text-right sm:text-left">{l.distanceKm !== undefined ? `${fmtKm(l.distanceKm)} km` : '—'}</div>
                        <div className="num col-span-2 text-muted sm:col-span-1">{l.durationSec !== undefined ? fmtClock(l.durationSec * 1000) : '—'}</div>
                        <div className="col-span-2 sm:col-span-1">{l.warnings.length > 0 && <span className="text-xs text-warn">{l.warnings.join(' ')}</span>}</div>
                      </div>
                    )
                  }
                  const ok = isUsableLift(l)
                  const target = targetFor(l.exercise?.id)
                  const outOfRange = target && l.reps.some((r) => r < target.targetRepsMin || r > target.targetRepsMax)
                  return (
                    <div key={i} className="contents">
                      <div className={`font-medium ${ok ? '' : 'text-warn'}`}>
                        {l.name || '(sem nome)'}
                        {!l.exercise && l.name && <span className="ml-1.5 text-[11px] font-semibold text-accent">novo</span>}
                        {target && (
                          <span className="ml-1.5 text-[11px] font-medium text-muted">
                            alvo {target.targetSets}×{target.targetRepsMin}–{target.targetRepsMax}
                            {target.rirMin !== undefined ? ` · RIR ${target.rirMin}–${target.rirMax ?? target.rirMin}` : ''}
                          </span>
                        )}
                      </div>
                      <div className="num text-right sm:text-left">
                        {l.weightKg !== null ? fmtLoad(l.weightKg, l.unit ?? unitOf(l.exercise)) : '—'}
                        {l.unit && l.exercise && l.unit !== unitOf(l.exercise) && (
                          <span className="ml-1 text-[11px] text-warn">exercício está em {unitOf(l.exercise)}</span>
                        )}
                      </div>
                      <div className={`num col-span-2 sm:col-span-1 ${outOfRange ? 'text-warn' : 'text-muted'}`}>
                        {l.reps.length ? l.reps.join(' · ') + ' reps' : '—'}
                        {outOfRange && <span className="ml-1 text-[11px]">fora da faixa</span>}
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        {l.decision && <Decision value={l.decision} />}
                        {l.warnings.length > 0 && <span className="ml-1 text-xs text-warn">{l.warnings.join(' ')}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={(validLifts === 0 && validRuns === 0) || saving}
          className="tap rounded-full bg-accent px-6 font-semibold text-accent-ink disabled:opacity-45"
        >
          {saving
            ? 'Salvando…'
            : validLifts + validRuns > 0
              ? `Salvar${routine ? ` treino ${routine.name}` : ''} · ${[validLifts ? `${validLifts} exercício${validLifts === 1 ? '' : 's'}` : '', validRuns ? `${validRuns} corrida${validRuns === 1 ? '' : 's'}` : ''].filter(Boolean).join(' + ')}`
              : 'Salvar'}
        </button>
        {done && (
          <button type="button" onClick={() => navigate('/historico')} className="text-sm font-medium text-good">
            {done} Ver histórico ›
          </button>
        )}
      </div>

      </>
      )}

      <details className="text-sm text-muted">
        <summary className="cursor-pointer font-medium">Como escrever</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Nome, peso e as reps de cada série: <span className="num">Remada baixa 120 10 8</span>
          </li>
          <li>
            Séries iguais: <span className="num">Crucifixo 2x8 55kg</span>
          </li>
          <li>Última palavra pode ser a decisão: manter, aumentar ou diminuir.</li>
          <li>
            Corrida: <span className="num">Corrida 5km 28:30</span> ou <span className="num">Corrida 5,2 km 30 min</span>
          </li>
          <li>
            Uma linha só com data, como <span className="num">18/09</span>, começa outro dia. Dá para colar o histórico do WhatsApp inteiro.
          </li>
        </ul>
      </details>
    </div>
  )
}
