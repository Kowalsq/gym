import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Decision } from '../components/Decision'
import { matchExercises, saveParsedDays } from '../db/notes'
import { db } from '../db/schema'
import { fmtDayMonth, fmtKg } from '../lib/format'
import { parseNotes } from '../lib/parse'

const EXAMPLE = `Desenvolvimento máquina 75 10 7 manter
Remada baixa 120 10 8 manter
Crucifixo 2x8 55kg aumentar`

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

/** Anotação rápida: o mesmo texto que iria para o WhatsApp, uma linha por exercício. */
export function QuickNote() {
  const navigate = useNavigate()
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem('ferro:draft') ?? ''
    } catch {
      return ''
    }
  })
  const [date, setDate] = useState(() => toInputDate(todayMidnight()))
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const days = useMemo(() => parseNotes(text, fromInputDate(date)), [text, date])
  const matchedDays = useMemo(
    () => days.map((d) => ({ ...d, lines: matchExercises(d.lines, exercises ?? []) })),
    [days, exercises],
  )
  const totalLines = matchedDays.reduce((n, d) => n + d.lines.length, 0)
  const validLines = matchedDays.reduce(
    (n, d) => n + d.lines.filter((l) => l.name && l.weightKg !== null && l.reps.length > 0).length,
    0,
  )

  function onChange(v: string) {
    setText(v)
    setDone(null)
    try {
      localStorage.setItem('ferro:draft', v)
    } catch {
      /* sem storage */
    }
  }

  async function onSave() {
    if (validLines === 0 || saving) return
    setSaving(true)
    try {
      const r = await saveParsedDays(days, exercises ?? [])
      onChange('')
      setDone(
        `Salvo: ${r.sets} séries em ${r.sessions} treino${r.sessions === 1 ? '' : 's'}` +
          (r.newExercises ? `, ${r.newExercises} exercício${r.newExercises === 1 ? '' : 's'} novo${r.newExercises === 1 ? '' : 's'}` : '') +
          '.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight">Anotar</h1>
          <p className="text-sm text-muted">Uma linha por exercício, do jeito que você já escreve.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="label">Dia</span>
          <input
            id="note-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="field h-10 px-3 text-sm"
          />
        </label>
      </header>

      <textarea
        id="note-text"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={EXAMPLE}
        rows={8}
        spellCheck={false}
        className="field num min-h-[180px] w-full resize-y px-4 py-3 text-[15px] leading-relaxed placeholder:text-muted/60"
      />

      {totalLines > 0 && (
        <section className="flex flex-col gap-3">
          <div className="label">O que entendi</div>
          {matchedDays.map((day) => (
            <div key={day.date} className="card flex flex-col gap-2 p-3">
              {matchedDays.length > 1 && <div className="label">{fmtDayMonth(day.date)}</div>}
              <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[1fr_80px_1fr_100px]">
                {day.lines.map((l, i) => {
                  const ok = l.name && l.weightKg !== null && l.reps.length > 0
                  return (
                    <div key={i} className="contents">
                      <div className={`font-medium ${ok ? '' : 'text-warn'}`}>
                        {l.name || '(sem nome)'}
                        {l.exercise ? '' : l.name ? <span className="ml-1.5 text-[11px] font-semibold text-accent">novo</span> : null}
                      </div>
                      <div className="num text-right sm:text-left">{l.weightKg !== null ? `${fmtKg(l.weightKg)} kg` : '—'}</div>
                      <div className="num col-span-2 text-muted sm:col-span-1">
                        {l.reps.length ? l.reps.join(' · ') + ' reps' : '—'}
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        {l.decision && <Decision value={l.decision} />}
                        {l.warnings.length > 0 && (
                          <span className="ml-1 text-xs text-warn">{l.warnings.join(' ')}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={validLines === 0 || saving}
          className="tap rounded-full bg-accent px-6 font-semibold text-accent-ink disabled:opacity-45"
        >
          {saving ? 'Salvando…' : validLines > 0 ? `Salvar ${validLines} exercício${validLines === 1 ? '' : 's'}` : 'Salvar'}
        </button>
        {done && (
          <button type="button" onClick={() => navigate('/historico')} className="text-sm font-medium text-good">
            {done} Ver histórico ›
          </button>
        )}
      </div>

      <details className="text-sm text-muted">
        <summary className="cursor-pointer font-medium">Como escrever</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Nome, peso e as reps de cada série: <span className="num">Remada baixa 120 10 8</span></li>
          <li>Séries iguais: <span className="num">Crucifixo 2x8 55kg</span></li>
          <li>Última palavra pode ser a decisão: manter, aumentar ou diminuir.</li>
          <li>Uma linha só com data, como <span className="num">18/09</span>, começa outro dia. Dá para colar o histórico do WhatsApp inteiro.</li>
        </ul>
      </details>
    </div>
  )
}

