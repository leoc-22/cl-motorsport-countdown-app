import type { CountdownSession } from './types'

export type AdminIdentity = {
  email: string
  subject: string
}

// Production and the normal Vite setup are same-origin.
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

  getAdminIdentity: () =>
    request<AdminIdentity>('/configure/api/me'),

  // Create a new session
  createSession: (session: { label: string; startTimeUtc: string; durationMs: number }) =>
    request<CountdownSession>('/configure/api/sessions', {
      method: 'POST',
      body: JSON.stringify(session),
    }),

  // Update a session
  updateSession: (
    sessionId: string,
    updates: Partial<CountdownSession> & { expectedVersion: number },
  ) =>
    request<CountdownSession>(`/configure/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  // Delete a session
  deleteSession: (sessionId: string, expectedVersion: number) =>
    request<{ deleted: string }>(`/configure/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ expectedVersion }),
    }),
}
