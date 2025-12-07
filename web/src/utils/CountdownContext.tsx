import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { CountdownSession } from './types'
import { api } from './api'

type CountdownContextType = {
  sessions: CountdownSession[]
  loading: boolean
  error: string | null
  refreshSessions: () => Promise<void>
  createSession: (session: { label: string; startTimeUtc: string; durationMs: number }) => Promise<CountdownSession>
  updateSession: (sessionId: string, updates: Partial<CountdownSession>) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
}

const CountdownContext = createContext<CountdownContextType | undefined>(undefined)

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
        await api.updateSession(sessionId, updates)
        await refreshSessions()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update session'
        setError(message)
        throw err
      }
    },
    [refreshSessions],
  )

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await api.deleteSession(sessionId)
        await refreshSessions()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete session'
        setError(message)
        throw err
      }
    },
    [refreshSessions],
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

export const useCountdown = () => {
  const context = useContext(CountdownContext)
  if (context === undefined) {
    throw new Error('useCountdown must be used within a CountdownProvider')
  }
  return context
}
