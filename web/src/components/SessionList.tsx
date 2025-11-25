import type { CountdownSession } from '../utils/types'
import { formatDuration, getTimeState, intlCache } from '../utils/timeUtils'
import { StatusBadge } from './StatusBadge'

type SessionListProps = {
  sessions: CountdownSession[]
  currentTime: Date
  totalCount: number
}

export const SessionList = ({ sessions, currentTime, totalCount }: SessionListProps) => {
  return (
    <div className="rounded-3xl bg-white/5 p-6 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Scheduled Sessions</p>
        <span className="text-xs text-slate-500">{totalCount} total</span>
      </div>
      <ol className="space-y-4">
        {sessions.map((session) => {
          const { label } = getTimeState(session, currentTime)
          return (
            <li
              key={session.sessionId}
              className="rounded-2xl border border-white/10 bg-surface/50 p-4 transition hover:border-sky-500/50"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-white">{session.label}</p>
                <StatusBadge status={session.status} />
              </div>
              <p className="text-sm text-slate-400">
                {intlCache.format(new Date(session.startTimeUtc))} • {label}
              </p>
              <p className="text-sm text-slate-500">
                Duration {formatDuration(session.durationMs)}
              </p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
