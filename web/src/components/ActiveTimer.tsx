import type { CountdownSession } from '../utils/types'
import { formatDuration, getTimeState, intlCache } from '../utils/timeUtils'
import { StatusBadge } from './StatusBadge'

type ActiveTimerProps = {
  session: CountdownSession
  currentTime: Date
  groupLabel: string
  groupTimezone: string
}

export const ActiveTimer = ({ session, currentTime, groupLabel, groupTimezone }: ActiveTimerProps) => {
  const timeState = getTimeState(session, currentTime)

  return (
    <div className="space-y-6 rounded-xl border border-border bg-background-surface p-8 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-subtle">{groupTimezone}</p>
          <h2 className="font-display text-3xl font-semibold text-foreground">{groupLabel}</h2>
        </div>
        <StatusBadge status={session.status} />
      </div>

      <div className="space-y-6 rounded-lg border border-border bg-background-elevated p-8">
        <div className="space-y-2">
          <p className="text-sm font-medium text-subtle">{timeState.label}</p>
          <p className="font-display text-7xl font-semibold tabular-nums tracking-tight text-foreground">
            {timeState.diffMs > 0 ? formatDuration(timeState.diffMs) : '00:00:00'}
          </p>
        </div>
        <div className="flex items-center gap-3 border-t border-border pt-4">
          <div className="h-2 w-2 rounded-full bg-accent-blue" />
          <p className="text-sm text-subtle">
            {session.label} • {intlCache.format(new Date(session.startTimeUtc))}
          </p>
        </div>
      </div>

      <button
        type="button"
        className="w-full rounded-lg border border-accent-blue bg-accent-blue/10 px-6 py-4 font-medium text-accent-blue transition hover:bg-accent-blue/20"
      >
        Connect to Durable Object
      </button>
    </div>
  )
}
