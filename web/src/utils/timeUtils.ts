import type { CountdownSession, TimeState } from "./types";

export const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((unit) => unit.toString().padStart(2, "0"))
    .join(":");
};

export const getTimeState = (
  session: CountdownSession,
  pivot: Date,
): TimeState => {
  const now = pivot.getTime();
  const start = Date.parse(session.startTimeUtc);
  const end = start + session.durationMs;

  if (now < start) {
    return {
      label: "Starts in",
      diffMs: start - now,
    };
  }

  if (now >= start && now <= end) {
    return {
      label: "Time remaining",
      diffMs: end - now,
    };
  }

  return {
    label: "Completed",
    diffMs: 0,
  };
};

const HIDE_AFTER_COMPLETED_MS = 2 * 60 * 1000;

/**
 * Check if a completed session should be hidden from display.
 * Returns true if the session finished more than x minutes ago.
 */
export const shouldHideCompletedSession = (
  session: CountdownSession,
  pivot: Date,
): boolean => {
  const now = pivot.getTime();
  const start = Date.parse(session.startTimeUtc);
  const end = start + session.durationMs;

  if (now > end) {
    const timeSinceCompleted = now - end;
    return timeSinceCompleted > HIDE_AFTER_COMPLETED_MS;
  }

  return false;
};

export const intlCache = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Convert a UTC ISO string to a local datetime-local input value (YYYY-MM-DDTHH:mm)
 */
export const utcToLocalDatetimeInput = (utcIsoString: string): string => {
  const date = new Date(utcIsoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Convert a local datetime-local input value to a UTC ISO string
 */
export const localDatetimeInputToUtc = (localDatetime: string): string => {
  return new Date(localDatetime).toISOString();
};

/**
 * Get current local time + offset as a datetime-local input value
 */
export const getLocalDatetimeDefault = (offsetMinutes: number = 30): string => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + offsetMinutes);
  return utcToLocalDatetimeInput(now.toISOString());
};
