import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useCountdown } from "../utils/CountdownContext";
import type { CountdownSession } from "../utils/types";
import {
  utcToLocalDatetimeInput,
  localDatetimeInputToUtc,
  getLocalDatetimeDefault,
  shouldHideCompletedSession,
} from "../utils/timeUtils";

export const Route = createFileRoute("/configure")({
  component: ConfigureComponent,
});

function ConfigureComponent() {
  const {
    sessions,
    loading,
    error,
    createSession,
    updateSession,
    deleteSession,
  } = useCountdown();
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Filter out sessions that finished more than 2 minutes ago (archived)
  const { displayedSessions, archivedCount } = useMemo(() => {
    const now = new Date();
    const archived = sessions.filter((session) =>
      shouldHideCompletedSession(session, now),
    );
    const active = sessions.filter(
      (session) => !shouldHideCompletedSession(session, now),
    );
    return {
      displayedSessions: showArchived ? sessions : active,
      archivedCount: archived.length,
    };
  }, [sessions, showArchived]);

  const handleAddSession = async (session: {
    label: string;
    startTimeUtc: string;
    durationMs: number;
  }) => {
    setSaving(true);
    try {
      await createSession(session);
      setShowAddForm(false);
    } catch {
      // Error handled in context
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setSaving(true);
    try {
      await deleteSession(sessionId);
    } catch {
      // Error handled in context
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSession = async (updatedSession: CountdownSession) => {
    setSaving(true);
    try {
      await updateSession(updatedSession.sessionId, {
        label: updatedSession.label,
        startTimeUtc: updatedSession.startTimeUtc,
        durationMs: updatedSession.durationMs,
      });
      setEditingSessionId(null);
    } catch {
      // Error handled in context
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-accent-blue border-t-transparent mx-auto" />
          <p className="text-muted">Loading sessions...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      {error && (
        <div className="rounded-lg border border-accent-red/30 bg-accent-red/10 p-4 text-accent-red">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border bg-background-surface p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-foreground">Sessions</h2>
          <div className="flex items-center gap-4">
            {archivedCount > 0 && (
              <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="h-4 w-4 rounded border-border bg-background-surface text-accent-blue focus:ring-accent-blue"
                />
                Show archived ({archivedCount})
              </label>
            )}
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              disabled={saving || showAddForm}
              className="rounded-lg bg-accent-green px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-green/90 disabled:opacity-50"
            >
              + Add Session
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {showAddForm && (
            <SessionAddForm
              onSave={handleAddSession}
              onCancel={() => setShowAddForm(false)}
              saving={saving}
            />
          )}

          {displayedSessions.length === 0 && !showAddForm ? (
            <p className="text-center text-muted py-8">
              No active sessions. Add one to get started.
            </p>
          ) : (
            displayedSessions.map((session) => {
              const isArchived = shouldHideCompletedSession(
                session,
                new Date(),
              );
              return editingSessionId === session.sessionId ? (
                <SessionEditForm
                  key={session.sessionId}
                  session={session}
                  onSave={handleUpdateSession}
                  onCancel={() => setEditingSessionId(null)}
                  saving={saving}
                />
              ) : (
                <SessionCard
                  key={session.sessionId}
                  session={session}
                  onEdit={() => setEditingSessionId(session.sessionId)}
                  onDelete={() => handleDeleteSession(session.sessionId)}
                  disabled={saving}
                  isArchived={isArchived}
                />
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

function SessionCard({
  session,
  onEdit,
  onDelete,
  disabled,
  isArchived,
}: {
  session: CountdownSession;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
  isArchived: boolean;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const endTime = new Date(
    new Date(session.startTimeUtc).getTime() + session.durationMs,
  );

  const handleDeleteClick = () => {
    if (confirmingDelete) {
      onDelete();
      setConfirmingDelete(false);
    } else {
      setConfirmingDelete(true);
    }
  };

  return (
    <div
      className={`rounded-lg border p-5 ${isArchived ? "border-border/50 bg-background-elevated/50 opacity-60" : "border-border bg-background-elevated"}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground">{session.label}</p>
          {isArchived && (
            <span className="rounded-full bg-muted/20 px-2 py-0.5 text-xs text-muted">
              Archived
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={disabled}
            className="rounded-md border border-accent-blue bg-accent-blue/10 px-3 py-1.5 text-sm font-medium text-accent-blue transition hover:bg-accent-blue/20 disabled:opacity-50"
          >
            Edit
          </button>
          {confirmingDelete ? (
            <>
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={disabled}
                className="rounded-md border border-accent-red bg-accent-red px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-red/90 disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={disabled}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-background-surface disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={disabled}
              className="rounded-md border border-accent-red bg-accent-red/10 px-3 py-1.5 text-sm font-medium text-accent-red transition hover:bg-accent-red/20 disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>
      <div className="space-y-1.5 text-sm text-subtle tabular-nums">
        <p>
          <span className="inline-block w-16">Start:</span>
          {new Date(session.startTimeUtc).toLocaleString()}
        </p>
        <p>
          <span className="inline-block w-16">End:</span>
          {endTime.toLocaleString()}
        </p>
        <p className="text-muted">
          {Math.floor(session.durationMs / 60000)} min
        </p>
      </div>
    </div>
  );
}

type DurationMode = "duration" | "endTime";

function SessionAddForm({
  onSave,
  onCancel,
  saving,
}: {
  onSave: (session: {
    label: string;
    startTimeUtc: string;
    durationMs: number;
  }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [label, setLabel] = useState("");
  const [startTimeLocal, setStartTimeLocal] = useState(() =>
    getLocalDatetimeDefault(0),
  );
  const [durationMode, setDurationMode] = useState<DurationMode>("duration");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [endTimeLocal, setEndTimeLocal] = useState(() =>
    getLocalDatetimeDefault(30),
  );

  const computedDurationMs =
    durationMode === "duration"
      ? durationMinutes * 60 * 1000
      : new Date(endTimeLocal).getTime() - new Date(startTimeLocal).getTime();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      label,
      startTimeUtc: localDatetimeInputToUtc(startTimeLocal),
      durationMs: computedDurationMs,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border-2 border-accent-green bg-background-elevated p-5"
    >
      <h3 className="mb-4 font-semibold text-foreground">New Session</h3>
      <div className="mb-5 grid gap-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium text-muted">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Session name"
            className="h-11 rounded-lg border border-border bg-background-surface px-4 text-foreground placeholder:text-subtle transition focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue"
            required
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium text-muted">Start Time</label>
          <input
            type="datetime-local"
            value={startTimeLocal}
            onChange={(e) => setStartTimeLocal(e.target.value)}
            className="h-11 rounded-lg border border-border bg-background-surface px-4 text-foreground placeholder:text-subtle transition focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue"
            required
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-muted">End</label>
            <div className="flex rounded-lg border border-border bg-background-surface p-0.5">
              <button
                type="button"
                onClick={() => setDurationMode("duration")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  durationMode === "duration"
                    ? "bg-accent-blue text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Duration
              </button>
              <button
                type="button"
                onClick={() => setDurationMode("endTime")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  durationMode === "endTime"
                    ? "bg-accent-blue text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                End Time
              </button>
            </div>
          </div>
          <div className="grid h-11">
            {durationMode === "duration" ? (
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="rounded-lg border border-border bg-background-surface px-4 text-foreground placeholder:text-subtle transition focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue"
                min="1"
                placeholder="Duration in minutes"
                required
              />
            ) : (
              <input
                type="datetime-local"
                value={endTimeLocal}
                onChange={(e) => setEndTimeLocal(e.target.value)}
                className="rounded-lg border border-border bg-background-surface px-4 text-foreground placeholder:text-subtle transition focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue"
                required
              />
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || !label.trim() || computedDurationMs <= 0}
          className="rounded-lg bg-accent-green px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-green/90 disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create Session"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-muted transition hover:bg-background-surface disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function SessionEditForm({
  session,
  onSave,
  onCancel,
  saving,
}: {
  session: CountdownSession;
  onSave: (session: CountdownSession) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [label, setLabel] = useState(session.label);
  const [startTimeLocal, setStartTimeLocal] = useState(() =>
    utcToLocalDatetimeInput(session.startTimeUtc),
  );
  const [durationMode, setDurationMode] = useState<DurationMode>("duration");
  const [durationMinutes, setDurationMinutes] = useState(
    Math.floor(session.durationMs / 60000),
  );
  const [endTimeLocal, setEndTimeLocal] = useState(() => {
    const endTime = new Date(
      new Date(session.startTimeUtc).getTime() + session.durationMs,
    );
    return utcToLocalDatetimeInput(endTime.toISOString());
  });

  const computedDurationMs =
    durationMode === "duration"
      ? durationMinutes * 60 * 1000
      : new Date(endTimeLocal).getTime() - new Date(startTimeLocal).getTime();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...session,
      label,
      startTimeUtc: localDatetimeInputToUtc(startTimeLocal),
      durationMs: computedDurationMs,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border-2 border-accent-blue bg-background-elevated p-5"
    >
      <div className="mb-5 grid gap-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium text-muted">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="h-11 rounded-lg border border-border bg-background-surface px-4 text-foreground placeholder:text-subtle transition focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue"
            required
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium text-muted">Start Time</label>
          <input
            type="datetime-local"
            value={startTimeLocal}
            onChange={(e) => setStartTimeLocal(e.target.value)}
            className="h-11 rounded-lg border border-border bg-background-surface px-4 text-foreground placeholder:text-subtle transition focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue"
            required
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-muted">End</label>
            <div className="flex rounded-lg border border-border bg-background-surface p-0.5">
              <button
                type="button"
                onClick={() => setDurationMode("duration")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  durationMode === "duration"
                    ? "bg-accent-blue text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Duration
              </button>
              <button
                type="button"
                onClick={() => setDurationMode("endTime")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  durationMode === "endTime"
                    ? "bg-accent-blue text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                End Time
              </button>
            </div>
          </div>
          <div className="grid h-11">
            {durationMode === "duration" ? (
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="rounded-lg border border-border bg-background-surface px-4 text-foreground placeholder:text-subtle transition focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue"
                min="1"
                placeholder="Duration in minutes"
                required
              />
            ) : (
              <input
                type="datetime-local"
                value={endTimeLocal}
                onChange={(e) => setEndTimeLocal(e.target.value)}
                className="rounded-lg border border-border bg-background-surface px-4 text-foreground placeholder:text-subtle transition focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue"
                required
              />
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || computedDurationMs <= 0}
          className="rounded-lg bg-accent-blue px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-blue/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-muted transition hover:bg-background-surface disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
