export type SessionStatus = 'scheduled' | 'running' | 'complete' | 'canceled'

export type CountdownSession = {
  sessionId: string
  label: string
  startTimeUtc: string
  durationMs: number
  status: SessionStatus
}

export type CountdownGroup = {
  groupId: string
  label: string
  timezone: string
  sessions: CountdownSession[]
}

export type TimeState = {
  label: string
  diffMs: number
}
