import type { CountdownSession } from '../utils/types'
import { formatDuration, getTimeState, intlCache } from '../utils/timeUtils'

type ActiveTimerProps = {
  session: CountdownSession
  currentTime: Date
}

export const ActiveTimer = ({ session, currentTime }: ActiveTimerProps) => {
  const timeState = getTimeState(session, currentTime)

  return (
    <div className="space-y-4 rounded-xl border border-border bg-background-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <h2 className="font-display text-xl font-semibold text-foreground">{session.label}</h2>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-background-elevated p-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-subtle">{timeState.label}</p>
          <p className="font-display text-4xl font-semibold tabular-nums tracking-tight text-foreground">
            {timeState.diffMs > 0 ? formatDuration(timeState.diffMs) : '00:00:00'}
          </p>
        </div>
        <div className="flex items-center gap-3 border-t border-border pt-3">
          <div className="h-2 w-2 rounded-full bg-accent-blue" />
          <p className="text-sm text-subtle">
            Starts {intlCache.format(new Date(session.startTimeUtc))}
          </p>
        </div>
      </div>
    </div>
  )
}
