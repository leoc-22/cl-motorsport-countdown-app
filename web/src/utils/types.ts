export type CountdownSession = {
  sessionId: string
  label: string
  startTimeUtc: string
  durationMs: number
}

export type TimeState = {
  label: string
  diffMs: number
}
