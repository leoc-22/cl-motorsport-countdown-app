import type { CountdownSession } from './types'

// In dev mode with Vite proxy, use relative paths; in production, use the env var
const API_BASE = import.meta.env.VITE_API_URL || ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const errorBody = await res.text().catch(() => 'Unknown error')
    throw new Error(`API error ${res.status}: ${errorBody}`)
  }

  return res.json()
}

export const api = {
  // Get all sessions
  getSessions: () => request<CountdownSession[]>('/api/sessions'),

  // Get a specific session
  getSession: (sessionId: string) =>
    request<CountdownSession>(`/api/sessions/${encodeURIComponent(sessionId)}`),

  // Create a new session
  createSession: (session: { label: string; startTimeUtc: string; durationMs: number }) =>
    request<CountdownSession>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(session),
    }),

  // Update a session
  updateSession: (sessionId: string, updates: Partial<CountdownSession>) =>
    request<CountdownSession>(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  // Delete a session
  deleteSession: (sessionId: string) =>
    request<{ deleted: string }>(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    }),
}
