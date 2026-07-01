import { useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { CountdownSession } from './types'
import { api } from './api'
import { CountdownContext } from './countdown-context'

export const CountdownProvider = ({ children }: { children: ReactNode }) => {
  const [sessions, setSessions] = useState<CountdownSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshSessions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getSessions()
      setSessions(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch sessions'
      setError(message)
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [])

  const createSession = useCallback(
    async (session: { label: string; startTimeUtc: string; durationMs: number }) => {
      try {
        const newSession = await api.createSession(session)
        await refreshSessions()
        return newSession
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create session'
        setError(message)
        throw err
      }
    },
    [refreshSessions],
  )

  const updateSession = useCallback(
    async (sessionId: string, updates: Partial<CountdownSession>) => {
      try {
        const current = sessions.find((session) => session.sessionId === sessionId)
        if (!current) throw new Error('Session is no longer available')
        await api.updateSession(sessionId, {
          ...updates,
          expectedVersion: current.version,
        })
        await refreshSessions()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update session'
        setError(message)
        throw err
      }
    },
    [refreshSessions, sessions],
  )

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        const current = sessions.find((session) => session.sessionId === sessionId)
        if (!current) throw new Error('Session is no longer available')
        await api.deleteSession(sessionId, current.version)
        await refreshSessions()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete session'
        setError(message)
        throw err
      }
    },
    [refreshSessions, sessions],
  )

  useEffect(() => {
    refreshSessions()
  }, [refreshSessions])

  return (
    <CountdownContext.Provider
      value={{
        sessions,
        loading,
        error,
        refreshSessions,
        createSession,
        updateSession,
        deleteSession,
      }}
    >
      {children}
    </CountdownContext.Provider>
  )
}
