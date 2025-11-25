import type { SessionStatus } from '../utils/types'

export const StatusBadge = ({ status }: { status: SessionStatus }) => {
  const palette: Record<SessionStatus, string> = {
    scheduled: 'text-accent-blue bg-accent-blue/10 border-accent-blue/30',
    running: 'text-accent-green bg-accent-green/10 border-accent-green/30',
    complete: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/30',
    canceled: 'text-accent-red bg-accent-red/10 border-accent-red/30',
  }

  return (
    <span className={`rounded-md border px-2.5 py-1 text-xs font-medium uppercase tracking-wider ${palette[status]}`}>
      {status}
    </span>
  )
}
