import { createContext } from 'react'
import type { CountdownSession } from './types'

export type CountdownContextType = {
  sessions: CountdownSession[]
  loading: boolean
  error: string | null
  refreshSessions: () => Promise<void>
  createSession: (session: {
    label: string
    startTimeUtc: string
    durationMs: number
  }) => Promise<CountdownSession>
  updateSession: (
    sessionId: string,
    updates: Partial<CountdownSession>,
  ) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
}

export const CountdownContext = createContext<
  CountdownContextType | undefined
>(undefined)
