import { useMemo, useState } from 'react'
import { Decision as DecisionChip } from '../components/Decision'
import { saveParsedDays, type SaveResult } from '../db/notes'
import type { Exercise, Routine, RoutineItem } from '../db/schema'
import { suggestNext, suggestPrev, type Analysis } from '../lib/analysis'
import { fmtDayMonth } from '../lib/format'
import { fmtLoad, unitLabel, unitOf } from '../lib/units'
import { formatLine, type Decision, type ParsedLine } from '../lib/parse'

interface Row {
  exerciseId: string
  weight: string
  reps: string[]
  /** null = usar a sugestão automática. */
  decision: Decision | null
  skipped: boolean
}

interface Props {
  routine: Routine
  exercises: Exercise[]
  analysis: Analysis
  /** Meia-noite local do dia anotado. */
  date: number
  onSaved: (r: SaveResult) => void
}

const toNum = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))

/**
 * Modo rápido: uma linha por exercício do treino, carga já preenchida com a
 * última (ou a sugerida, se marcou aumentar), e um campo por série para as
 * reps. Decisão sugerida pela faixa alvo; um toque troca.
 */
export function QuickForm({ routine, exercises, analysis, date, onSaved }: Props) {
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  /** Exercício a usar para o item: a alternativa se foi a última feita. */
  function pickExercise(it: RoutineItem): string {
    const cands = [it.exerciseId, ...(it.alternativeIds ?? [])]
      .map((id) => analysis.byExercise.get(id))
      .filter((s) => s?.current)
      .sort((a, b) => b!.current!.date - a!.current!.date)
    return cands[0]?.exercise.id ?? it.exerciseId
  }

  function initialRow(it: RoutineItem, exerciseId: string): Row {
    const s = analysis.byExercise.get(exerciseId)
    const cur = s?.current
    const ex = exById.get(exerciseId)
    let weight = ''
    if (cur && ex) {
      const w = cur.decision === 'aumentar' ? suggestNext(ex, cur.maxWeightKg) : cur.decision === 'diminuir' ? suggestPrev(ex, cur.maxWeightKg) : cur.maxWeightKg
      weight = String(w).replace('.', ',')
    }
    return { exerciseId, weight, reps: Array(it.targetSets).fill(''), decision: null, skipped: false }
  }

  const [rows, setRows] = useState<Row[]>(() => routine.items.map((it) => initialRow(it, pickExercise(it))))
  const [saving, setSaving] = useState(false)

  function patch(i: number, p: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))
  }

  function autoDecision(it: RoutineItem, reps: (number | null)[]): Decision | null {
    const filled = reps.filter((r): r is number => r !== null && r > 0)
    if (filled.length === 0) return null
    if (filled.every((r) => r >= it.targetRepsMax)) return 'aumentar'
    if (filled.some((r) => r < it.targetRepsMin)) return 'diminuir'
    return 'manter'
  }

  const prepared = rows.map((row, i) => {
    const it = routine.items[i]
    const reps = row.reps.map(toNum)
    const filledReps = reps.filter((r): r is number => r !== null && r > 0)
    const weight = toNum(row.weight)
    const auto = autoDecision(it, reps)
    const decision = row.decision ?? auto
    const ready = !row.skipped && filledReps.length > 0 && weight !== null && Number.isFinite(weight)
    return { it, row, reps, filledReps, weight, auto, decision, ready }
  })
  const readyCount = prepared.filter((p) => p.ready).length

  async function onSave() {
    if (readyCount === 0 || saving) return
    setSaving(true)
    try {
      const lines: ParsedLine[] = prepared
        .filter((p) => p.ready)
        .map((p) => {
          const name = exById.get(p.row.exerciseId)?.name ?? ''
          return {
            kind: 'lift',
            raw: formatLine(name, p.weight, p.filledReps, p.decision, unitOf(exById.get(p.row.exerciseId))),
            name,
            weightKg: p.weight!,
            reps: p.filledReps,
            decision: p.decision,
            warnings: [],
          }
        })
      const r = await saveParsedDays([{ date, lines }], exercises, { routineId: routine.id, routineName: routine.name })
      onSaved(r)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="card flex flex-col divide-y divide-line p-0">
        {prepared.map(({ it, row, auto, decision, ready }, i) => {
          const ex = exById.get(row.exerciseId)
          const s = analysis.byExercise.get(row.exerciseId)
          const cur = s?.current
          const alts = [it.exerciseId, ...(it.alternativeIds ?? [])].filter((id) => exById.has(id))
          return (
            <li key={`${it.exerciseId}-${i}`} className={`flex flex-col gap-2 px-3 py-3 ${row.skipped ? 'opacity-45' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {alts.length > 1 ? (
                    <select
                      id={`qf-ex-${i}`}
                      value={row.exerciseId}
                      onChange={(e) => {
                        const next = initialRow(it, e.target.value)
                        patch(i, { exerciseId: next.exerciseId, weight: next.weight })
                      }}
                      className="-ml-1 max-w-full appearance-none bg-transparent pl-1 text-[15px] font-semibold text-text"
                    >
                      {alts.map((id) => (
                        <option key={id} value={id}>
                          {exById.get(id)!.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="truncate text-[15px] font-semibold">{ex?.name}</div>
                  )}
                  <div className="text-[11px] text-muted">
                    alvo {it.targetSets}×{it.targetRepsMin}–{it.targetRepsMax}
                    {it.rirMin !== undefined ? ` · RIR ${it.rirMin}–${it.rirMax ?? it.rirMin}` : ''}
                    {cur ? ` · ${fmtDayMonth(cur.date)}: ${fmtLoad(cur.maxWeightKg, unitOf(ex))} × ${cur.reps.join(' · ')}` : ' · primeira vez'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => patch(i, { skipped: !row.skipped })}
                  className="min-h-8 shrink-0 rounded-full bg-surface-2 px-2.5 text-[11px] font-semibold text-muted"
                  aria-pressed={row.skipped}
                >
                  {row.skipped ? 'Voltar' : 'Pular'}
                </button>
              </div>

              {!row.skipped && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5">
                    <input
                      id={`qf-w-${i}`}
                      inputMode="decimal"
                      value={row.weight}
                      placeholder={unitLabel(unitOf(ex))}
                      onChange={(e) => patch(i, { weight: e.target.value })}
                      className="field num h-12 w-[72px] text-center text-[17px]"
                      aria-label={`Carga em ${unitLabel(unitOf(ex))}`}
                    />
                    <span className="text-xs text-muted">{unitLabel(unitOf(ex))}</span>
                  </label>
                  <span className="text-muted">×</span>
                  {row.reps.map((r, k) => (
                    <input
                      key={k}
                      id={`qf-r-${i}-${k}`}
                      inputMode="numeric"
                      value={r}
                      placeholder={String(it.targetRepsMin)}
                      onChange={(e) => {
                        const reps = [...row.reps]
                        reps[k] = e.target.value.replace(/\D/g, '')
                        patch(i, { reps })
                      }}
                      className={`field num h-12 w-14 text-center text-[17px] ${ready ? 'outline-1 outline-accent/40' : ''}`}
                      aria-label={`Reps da série ${k + 1}`}
                    />
                  ))}
                  <div className="ml-auto flex items-center gap-1">
                    {(['manter', 'aumentar', 'diminuir'] as Decision[]).map((d) => {
                      const on = decision === d
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => patch(i, { decision: row.decision === d ? null : d })}
                          className={`rounded-full ${on ? '' : 'opacity-40'}`}
                          aria-pressed={on}
                          title={row.decision === null && auto === d ? 'sugerido pela faixa alvo' : ''}
                        >
                          <DecisionChip value={d} size="md" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={readyCount === 0 || saving}
          className="tap rounded-full bg-accent px-6 font-semibold text-accent-ink disabled:opacity-45"
        >
          {saving ? 'Salvando…' : readyCount > 0 ? `Salvar treino ${routine.name} · ${readyCount} de ${routine.items.length}` : `Salvar treino ${routine.name}`}
        </button>
        <span className="text-xs text-muted">Exercício sem reps fica de fora.</span>
      </div>
    </div>
  )
}
