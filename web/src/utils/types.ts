export type CountdownSession = {
  sessionId: string
  label: string
  startTimeUtc: string
  durationMs: number
  metadata?: Record<string, unknown>
  version: number
  createdAt: string
  updatedAt: string
}

export type TimeState = {
  label: string
  diffMs: number
}
