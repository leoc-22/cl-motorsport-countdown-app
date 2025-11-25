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
    <div className="space-y-6 rounded-xl border border-border bg-background-surface p-8">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Scheduled Sessions</h3>
        <span className="rounded-full bg-background-elevated px-3 py-1 text-xs font-medium text-zinc-500">
          {totalCount} total
        </span>
      </div>
      <ol className="space-y-3">
        {sessions.map((session) => {
          const { label } = getTimeState(session, currentTime)
          return (
            <li
              key={session.sessionId}
              className="group rounded-lg border border-border bg-background-elevated p-4 transition hover:border-border-hover"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="font-semibold text-white">{session.label}</p>
                <StatusBadge status={session.status} />
              </div>
              <div className="space-y-1 text-sm text-zinc-400">
                <p>{intlCache.format(new Date(session.startTimeUtc))}</p>
                <div className="flex items-center gap-2">
                  <span>{label}</span>
                  <span>•</span>
                  <span>{formatDuration(session.durationMs)}</span>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
