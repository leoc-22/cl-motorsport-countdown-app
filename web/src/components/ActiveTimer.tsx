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
    <div className="space-y-6 rounded-3xl bg-surface/80 p-6 ring-1 ring-white/5 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-slate-400">{groupTimezone} GROUP</p>
          <h2 className="font-display text-3xl text-white">{groupLabel}</h2>
        </div>
        <StatusBadge status={session.status} />
      </div>

      <div className="rounded-2xl bg-surface-raised/60 p-6 shadow-glow">
        <p className="text-sm text-slate-400">{timeState.label}</p>
        <p className="font-display text-6xl text-white">
          {timeState.diffMs > 0 ? formatDuration(timeState.diffMs) : '00:00:00'}
        </p>
        <p className="mt-4 text-sm text-slate-400">
          {session.label} • {intlCache.format(new Date(session.startTimeUtc))}
        </p>
      </div>

      <button
        type="button"
        className="w-full rounded-2xl bg-sky-500 px-6 py-4 font-medium text-white transition hover:opacity-95"
      >
        Connect to Durable Object
      </button>
    </div>
  )
}
