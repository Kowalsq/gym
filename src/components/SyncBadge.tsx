import { Link } from 'react-router'
import { useSyncStatus } from '../sync/sync'

function ago(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return 'agora'
  const m = Math.round(s / 60)
  if (m < 60) return `há ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `há ${h} h`
  return `há ${Math.round(h / 24)} d`
}

/** Linha curta de estado da sincronização, com link para Ajustes. */
export function SyncBadge({ className = '' }: { className?: string }) {
  const s = useSyncStatus()
  const dot =
    s.state === 'syncing' ? 'bg-chart-2 animate-pulse' : s.state === 'idle' ? 'bg-good' : s.state === 'off' ? 'bg-muted' : 'bg-warn'
  const text =
    s.state === 'off'
      ? 'Sem sincronização'
      : s.state === 'syncing'
        ? 'Sincronizando…'
        : s.state === 'idle'
          ? `Sincronizado ${s.lastSyncAt ? ago(s.lastSyncAt) : ''}`
          : s.state === 'offline'
            ? 'Offline · sincroniza ao voltar'
            : 'Erro na sincronização'
  return (
    <Link to="/ajustes" className={`flex items-center gap-2 text-xs text-muted hover:text-text ${className}`} title={s.error ?? ''}>
      <span className={`inline-block size-2 rounded-full ${dot}`} aria-hidden />
      {text}
    </Link>
  )
}
