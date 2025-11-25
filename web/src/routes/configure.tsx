import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useCountdown } from '../utils/CountdownContext'
import type { CountdownSession, SessionStatus } from '../utils/types'
import { StatusBadge } from '../components/StatusBadge'

export const Route = createFileRoute('/configure')({
  component: ConfigureComponent,
})

function ConfigureComponent() {
  const { group, updateGroup, resetToDefault } = useCountdown()
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)

  const [groupLabel, setGroupLabel] = useState(group.label)
  const [groupTimezone, setGroupTimezone] = useState(group.timezone)

  const handleSaveGroup = () => {
    updateGroup({
      ...group,
      label: groupLabel,
      timezone: groupTimezone,
    })
  }

  const handleAddSession = () => {
    const newSession: CountdownSession = {
      sessionId: `session-${Date.now()}`,
      label: 'New Session',
      startTimeUtc: new Date().toISOString(),
      durationMs: 30 * 60 * 1000,
      status: 'scheduled',
    }
    updateGroup({
      ...group,
      sessions: [...group.sessions, newSession],
    })
  }

  const handleDeleteSession = (sessionId: string) => {
    updateGroup({
      ...group,
      sessions: group.sessions.filter((s) => s.sessionId !== sessionId),
    })
  }

  const handleUpdateSession = (updatedSession: CountdownSession) => {
    updateGroup({
      ...group,
      sessions: group.sessions.map((s) => (s.sessionId === updatedSession.sessionId ? updatedSession : s)),
    })
    setEditingSessionId(null)
  }

  return (
    <section className="space-y-8">
      <div className="rounded-xl border border-border bg-background-surface p-8">
        <h2 className="mb-6 text-2xl font-semibold text-white">Group Configuration</h2>
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Group Label</label>
            <input
              type="text"
              value={groupLabel}
              onChange={(e) => setGroupLabel(e.target.value)}
              className="w-full rounded-lg border border-border bg-background-elevated px-4 py-2.5 text-white placeholder-zinc-500 transition focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Timezone</label>
            <input
              type="text"
              value={groupTimezone}
              onChange={(e) => setGroupTimezone(e.target.value)}
              className="w-full rounded-lg border border-border bg-background-elevated px-4 py-2.5 text-white placeholder-zinc-500 transition focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleSaveGroup}
              className="rounded-lg bg-accent-blue px-6 py-2.5 font-medium text-white transition hover:bg-accent-blue/90"
            >
              Save Group Settings
            </button>
            <button
              type="button"
              onClick={resetToDefault}
              className="rounded-lg border border-border px-6 py-2.5 font-medium text-zinc-300 transition hover:bg-background-elevated"
            >
              Reset to Default
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background-surface p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">Sessions</h2>
          <button
            type="button"
            onClick={handleAddSession}
            className="rounded-lg bg-accent-green px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-green/90"
          >
            + Add Session
          </button>
        </div>

        <div className="space-y-4">
          {group.sessions.map((session) =>
            editingSessionId === session.sessionId ? (
              <SessionEditForm
                key={session.sessionId}
                session={session}
                onSave={handleUpdateSession}
                onCancel={() => setEditingSessionId(null)}
              />
            ) : (
              <SessionCard
                key={session.sessionId}
                session={session}
                onEdit={() => setEditingSessionId(session.sessionId)}
                onDelete={() => handleDeleteSession(session.sessionId)}
              />
            ),
          )}
        </div>
      </div>
    </section>
  )
}

function SessionCard({
  session,
  onEdit,
  onDelete,
}: {
  session: CountdownSession
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-lg border border-border bg-background-elevated p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <p className="font-semibold text-white">{session.label}</p>
          <StatusBadge status={session.status} />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md border border-accent-blue bg-accent-blue/10 px-3 py-1.5 text-sm font-medium text-accent-blue transition hover:bg-accent-blue/20"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md border border-accent-red bg-accent-red/10 px-3 py-1.5 text-sm font-medium text-accent-red transition hover:bg-accent-red/20"
          >
            Delete
          </button>
        </div>
      </div>
      <div className="space-y-1.5 text-sm text-zinc-400">
        <p>Start: {new Date(session.startTimeUtc).toLocaleString()}</p>
        <p>Duration: {Math.floor(session.durationMs / 60000)} minutes</p>
      </div>
    </div>
  )
}

function SessionEditForm({
  session,
  onSave,
  onCancel,
}: {
  session: CountdownSession
  onSave: (session: CountdownSession) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState(session.label)
  const [startTimeUtc, setStartTimeUtc] = useState(() => {
    const date = new Date(session.startTimeUtc)
    return date.toISOString().slice(0, 16)
  })
  const [durationMinutes, setDurationMinutes] = useState(Math.floor(session.durationMs / 60000))
  const [status, setStatus] = useState<SessionStatus>(session.status)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...session,
      label,
      startTimeUtc: new Date(startTimeUtc).toISOString(),
      durationMs: durationMinutes * 60 * 1000,
      status,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border-2 border-accent-blue bg-background-elevated p-5">
      <div className="mb-5 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-lg border border-border bg-background-surface px-4 py-2.5 text-white placeholder-zinc-500 transition focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue"
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Start Time (UTC)</label>
          <input
            type="datetime-local"
            value={startTimeUtc}
            onChange={(e) => setStartTimeUtc(e.target.value)}
            className="w-full rounded-lg border border-border bg-background-surface px-4 py-2.5 text-white placeholder-zinc-500 transition focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue"
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Duration (minutes)</label>
          <input
            type="number"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-background-surface px-4 py-2.5 text-white placeholder-zinc-500 transition focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue"
            min="1"
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-300">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SessionStatus)}
            className="w-full rounded-lg border border-border bg-background-surface px-4 py-2.5 text-white transition focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue"
          >
            <option value="scheduled">Scheduled</option>
            <option value="running">Running</option>
            <option value="complete">Complete</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          className="rounded-lg bg-accent-blue px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-blue/90"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-background-surface"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
