import type { SessionStatus } from '../utils/types'

export const StatusBadge = ({ status }: { status: SessionStatus }) => {
  const palette: Record<SessionStatus, string> = {
    scheduled: 'text-sky-300 bg-sky-500/10 border border-sky-500/30',
    running: 'text-emerald-300 bg-emerald-500/10 border border-emerald-400/40',
    complete: 'text-slate-400 bg-slate-100/5 border border-slate-600/50',
    canceled: 'text-rose-300 bg-rose-500/10 border border-rose-400/40',
  }

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium tracking-wide ${palette[status]}`}>
      {status.toUpperCase()}
    </span>
  )
}
