import type { Decision as DecisionValue } from '../lib/parse'

export function Decision({ value, size = 'sm' }: { value: DecisionValue; size?: 'sm' | 'md' }) {
  const cls =
    value === 'aumentar'
      ? 'bg-good/15 text-good'
      : value === 'diminuir'
        ? 'bg-warn/15 text-warn'
        : 'bg-surface-2 text-muted'
  const arrow = value === 'aumentar' ? '↑' : value === 'diminuir' ? '↓' : '→'
  const pad = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${pad} ${cls}`}>
      <span aria-hidden>{arrow}</span>
      {value}
    </span>
  )
}
