import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { CountdownGroup } from './types'

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

const STORAGE_KEY = 'countdown-group'

type CountdownContextType = {
  group: CountdownGroup
  updateGroup: (group: CountdownGroup) => void
  resetToDefault: () => void
}

const CountdownContext = createContext<CountdownContextType | undefined>(undefined)

export const CountdownProvider = ({ children }: { children: ReactNode }) => {
  const [group, setGroup] = useState<CountdownGroup>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return MOCK_GROUP
      }
    }
    return MOCK_GROUP
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(group))
  }, [group])

  const updateGroup = (newGroup: CountdownGroup) => {
    setGroup(newGroup)
  }

  const resetToDefault = () => {
    setGroup(MOCK_GROUP)
  }

  return (
    <CountdownContext.Provider value={{ group, updateGroup, resetToDefault }}>
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
