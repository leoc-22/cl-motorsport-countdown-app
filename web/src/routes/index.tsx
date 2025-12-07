import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useCountdown } from '../utils/CountdownContext'
import { useCountdownTimer } from '../hooks/useCountdownTimer'
import { ActiveTimer } from '../components/ActiveTimer'
import { SessionList } from '../components/SessionList'

export const Route = createFileRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  const { sessions, loading, error } = useCountdown()
  const currentTime = useCountdownTimer()

  const activeSession = useMemo(
    () => sessions.find((session) => session.status === 'running') ?? sessions[0] ?? null,
    [sessions],
  )

  const upcomingSessions = useMemo(
    () => (activeSession ? sessions.filter((session) => session.sessionId !== activeSession.sessionId) : []),
    [sessions, activeSession],
  )

  if (loading) {
    return (
      <section className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-accent-blue border-t-transparent mx-auto" />
          <p className="text-muted">Loading countdown...</p>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="flex min-h-[400px] items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mb-4 text-6xl">⚠️</div>
          <h2 className="mb-2 text-xl font-semibold text-foreground">Error Loading Sessions</h2>
          <p className="mb-6 text-muted">{error}</p>
          <Link
            to="/configure"
            className="inline-block rounded-lg bg-accent-blue px-6 py-2.5 font-medium text-white transition hover:bg-accent-blue/90"
          >
            Configure Sessions
          </Link>
        </div>
      </section>
    )
  }

  if (sessions.length === 0) {
    return (
      <section className="flex min-h-[400px] items-center justify-center">
        <div className="text-center max-w-md">
          <div className="mb-4 text-6xl">⏱️</div>
          <h2 className="mb-2 text-xl font-semibold text-foreground">No Sessions</h2>
          <p className="mb-6 text-muted">No sessions scheduled yet. Add sessions to start the countdown.</p>
          <Link
            to="/configure"
            className="inline-block rounded-lg bg-accent-blue px-6 py-2.5 font-medium text-white transition hover:bg-accent-blue/90"
          >
            Add Sessions
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="grid gap-6 lg:grid-cols-3">
      {activeSession && (
        <ActiveTimer
          session={activeSession}
          currentTime={currentTime}
        />
      )}
      <SessionList sessions={upcomingSessions} currentTime={currentTime} totalCount={sessions.length} />
    </section>
  )
}
