import { useMemo } from 'react'

type SessionStatus = 'scheduled' | 'running' | 'complete' | 'canceled'

type CountdownSession = {
  sessionId: string
  label: string
  startTimeUtc: string
  durationMs: number
  status: SessionStatus
}

type CountdownGroup = {
  groupId: string
  label: string
  timezone: string
  sessions: CountdownSession[]
}

const MOCK_GROUP: CountdownGroup = {
  groupId: 'new-year-2026',
  label: 'New Year Showcase',
  timezone: 'UTC',
  sessions: [
    {
      sessionId: 'p1',
      label: 'Warm-up Run',
      startTimeUtc: '2026-01-01T13:00:00.000Z',
      durationMs: 30 * 60 * 1000,
      status: 'running',
    },
    {
      sessionId: 'p2',
      label: 'Qualifier',
      startTimeUtc: '2026-01-01T17:00:00.000Z',
      durationMs: 60 * 60 * 1000,
      status: 'scheduled',
    },
    {
      sessionId: 'p3',
      label: 'Grand Sprint',
      startTimeUtc: '2026-01-02T09:00:00.000Z',
      durationMs: 45 * 60 * 1000,
      status: 'scheduled',
    },
  ],
}

const intlCache = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
})

const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds]
    .map((unit) => unit.toString().padStart(2, '0'))
    .join(':')
}

const getTimeState = (session: CountdownSession, pivot: Date) => {
  const now = pivot.getTime()
  const start = Date.parse(session.startTimeUtc)
  const end = start + session.durationMs

  if (now < start) {
    return {
      label: 'Starts in',
      diffMs: start - now,
    }
  }

  if (now >= start && now <= end) {
    return {
      label: 'Time remaining',
      diffMs: end - now,
    }
  }

  return {
    label: 'Completed',
    diffMs: 0,
  }
}

const StatusBadge = ({ status }: { status: SessionStatus }) => {
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

function App() {
  const pivot = useMemo(() => new Date(), [])
  const activeSession = useMemo(
    () => MOCK_GROUP.sessions.find((session) => session.status === 'running') ?? MOCK_GROUP.sessions[0],
    [],
  )
  const upcomingSessions = useMemo(
    () => MOCK_GROUP.sessions.filter((session) => session.sessionId !== activeSession.sessionId),
    [activeSession.sessionId],
  )

  const timeState = getTimeState(activeSession, pivot)

  return (
    <div className="min-h-screen px-4 py-10 text-slate-100 md:px-10 lg:px-20">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="space-y-4 text-center md:text-left">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Cloudflare-native Countdown</p>
          <h1 className="font-display text-4xl font-semibold text-white md:text-5xl">
            Plan once. Stay synced everywhere.
          </h1>
          <p className="text-base text-slate-300 md:max-w-3xl">
            Each countdown group is backed by a Durable Object that orchestrates session order, replays state from D1,
            and streams ticks to every tab. This playground view renders mock data so the UI can be iterated independently
            from the Worker.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 rounded-3xl bg-surface/80 p-6 ring-1 ring-white/5 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-widest text-slate-400">{MOCK_GROUP.timezone} GROUP</p>
                <h2 className="font-display text-3xl text-white">{MOCK_GROUP.label}</h2>
              </div>
              <StatusBadge status={activeSession.status} />
            </div>

            <div className="rounded-2xl bg-surface-raised/60 p-6 shadow-glow">
              <p className="text-sm text-slate-400">{timeState.label}</p>
              <p className="font-display text-6xl text-white">
                {timeState.diffMs > 0 ? formatDuration(timeState.diffMs) : '00:00:00'}
              </p>
              <p className="mt-4 text-sm text-slate-400">
                {activeSession.label} • {intlCache.format(new Date(activeSession.startTimeUtc))}
              </p>
            </div>

            <button
              type="button"
              className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 px-6 py-4 font-medium text-white transition hover:opacity-95"
            >
              Connect to Durable Object
            </button>
          </div>

          <div className="rounded-3xl bg-white/5 p-6 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Scheduled Sessions</p>
              <span className="text-xs text-slate-500">{MOCK_GROUP.sessions.length} total</span>
            </div>
            <ol className="space-y-4">
              {upcomingSessions.map((session) => {
                const { label } = getTimeState(session, pivot)
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
        </section>
      </div>
    </div>
  )
}

export default App
