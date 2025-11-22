import type { CountdownSession, TimeState } from './types'

export const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds]
    .map((unit) => unit.toString().padStart(2, '0'))
    .join(':')
}

export const getTimeState = (session: CountdownSession, pivot: Date): TimeState => {
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

export const intlCache = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
})
