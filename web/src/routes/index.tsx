import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useCountdown } from '../utils/CountdownContext'
import { useCountdownTimer } from '../hooks/useCountdownTimer'
import { ActiveTimer } from '../components/ActiveTimer'
import { SessionList } from '../components/SessionList'

export const Route = createFileRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  const { group } = useCountdown()
  const currentTime = useCountdownTimer()

  const activeSession = useMemo(
    () => group.sessions.find((session) => session.status === 'running') ?? group.sessions[0],
    [group.sessions],
  )

  const upcomingSessions = useMemo(
    () => group.sessions.filter((session) => session.sessionId !== activeSession.sessionId),
    [group.sessions, activeSession.sessionId],
  )

  return (
    <section className="grid gap-6 lg:grid-cols-3">
      <ActiveTimer
        session={activeSession}
        currentTime={currentTime}
        groupLabel={group.label}
        groupTimezone={group.timezone}
      />
      <SessionList
        sessions={upcomingSessions}
        currentTime={currentTime}
        totalCount={group.sessions.length}
      />
    </section>
  )
}
