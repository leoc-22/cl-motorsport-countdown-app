import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useCountdown } from "../utils/CountdownContext";
import { useCountdownTimer } from "../hooks/useCountdownTimer";
import { getTimeState, formatDuration } from "../utils/timeUtils";

export const Route = createFileRoute("/focus")({
  component: FocusPage,
});

const focusDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function FullscreenIcon({ isFullscreen }: { isFullscreen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="currentColor"
    >
      <path
        d={
          isFullscreen
            ? "M5 16h3v3h2v-5H5v2Zm3-8H5v2h5V5H8v3Zm6 11h2v-3h3v-2h-5v5Zm2-11V5h-2v5h5V8h-3Z"
            : "M7 14H5v5h5v-2H7v-3Zm-2-4h2V7h3V5H5v5Zm12 7h-3v2h5v-5h-2v3Zm-3-12v2h3v3h2V5h-5Z"
        }
      />
    </svg>
  );
}

function FocusFullscreenFrame({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === frameRef.current);
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () =>
      document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === frameRef.current) {
        await document.exitFullscreen();
        return;
      }

      await frameRef.current?.requestFullscreen();
    } catch {
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={frameRef}
      className="relative flex h-full items-center justify-center overflow-hidden bg-background p-8"
    >
      <button
        type="button"
        onClick={() => void toggleFullscreen()}
        aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
        aria-pressed={isFullscreen}
        title={isFullscreen ? "Exit full screen" : "Enter full screen"}
        className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background-surface text-muted-foreground transition hover:border-border-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-background md:right-6 md:top-6"
      >
        <FullscreenIcon isFullscreen={isFullscreen} />
      </button>

      {children}
    </div>
  );
}

function FocusPage() {
  const { sessions, loading, error } = useCountdown();
  const currentTime = useCountdownTimer();

  // Helper to calculate end time from startTimeUtc + durationMs
  const getEndTime = (session: (typeof sessions)[0]) =>
    new Date(new Date(session.startTimeUtc).getTime() + session.durationMs);

  // Filter out completed sessions and find the one with earliest end time
  const activeSessions = sessions.filter(
    (session) => getEndTime(session) > currentTime,
  );

  const sessionToFocus =
    activeSessions.length > 0
      ? activeSessions.reduce((earliest, current) => {
          return getEndTime(current) < getEndTime(earliest)
            ? current
            : earliest;
        })
      : null;

  if (loading) {
    return (
      <FocusFullscreenFrame>
        <div className="text-xl text-muted-foreground">Loading...</div>
      </FocusFullscreenFrame>
    );
  }

  if (error) {
    return (
      <FocusFullscreenFrame>
        <div className="text-xl text-destructive">Error: {error}</div>
      </FocusFullscreenFrame>
    );
  }

  if (!sessionToFocus) {
    return (
      <FocusFullscreenFrame>
        <div className="text-2xl text-muted-foreground">
          No sessions available
        </div>
      </FocusFullscreenFrame>
    );
  }

  const timeState = getTimeState(sessionToFocus, currentTime);
  const isCompleted = timeState.label === "Completed";
  const formattedTime = formatDuration(Math.max(0, timeState.diffMs));
  const startTime = new Date(sessionToFocus.startTimeUtc);
  const focusedStartTime = startTime.getTime();
  const nextSessions = sessions
    .filter(
      (session) => Date.parse(session.startTimeUtc) > focusedStartTime,
    )
    .sort(
      (a, b) =>
        Date.parse(a.startTimeUtc) - Date.parse(b.startTimeUtc),
    )
    .slice(0, 3);

  // Urgency-based time threshold coloring
  const getTimerColor = () => {
    if (timeState.label === "Completed") {
      return "text-accent-green";
    }
    if (timeState.label === "Starts in") {
      return "text-subtle";
    }
    // Time remaining logic with urgency thresholds
    const TWO_HOURS = 2 * 60 * 60 * 1000; // 7200000ms
    const ONE_HOUR = 60 * 60 * 1000; // 3600000ms
    const FIFTEEN_MINUTES = 15 * 60 * 1000; // 900000ms

    if (timeState.diffMs <= FIFTEEN_MINUTES) {
      return "text-red-500";
    }
    if (timeState.diffMs <= ONE_HOUR) {
      return "text-orange-500";
    }
    if (timeState.diffMs <= TWO_HOURS) {
      return "text-foreground";
    }
    return "text-foreground";
  };

  const timerColor = getTimerColor();

  return (
    <FocusFullscreenFrame>
      <div className="-translate-y-24 text-center space-y-8 max-w-4xl w-full">
        {/* Session Label */}
        <h1
          className={`text-2xl md:text-4xl font-bold ${isCompleted ? "line-through text-accent-green" : "text-foreground"}`}
        >
          {sessionToFocus.label}
        </h1>

        {/* Status Label */}
        <div
          className={`text-2xl md:text-3xl ${isCompleted ? "text-accent-green" : "text-muted-foreground"}`}
        >
          {timeState.label}
        </div>

        {/* Countdown Timer */}
        <div
          className={`text-5xl sm:text-7xl md:text-9xl font-mono font-bold ${timerColor} tracking-wider`}
        >
          {formattedTime}
        </div>

        {/* Start Time */}
        <div className="text-xl md:text-2xl text-muted-foreground">
          {isCompleted ? "Started" : "Starts"} at{" "}
          {focusDateTimeFormatter.format(startTime)}
        </div>
      </div>

      {nextSessions.length > 0 && (
        <div className="absolute bottom-6 left-1/2 w-full -translate-x-1/2 px-8 text-center text-sm text-foreground md:text-base">
          <p className="mb-1 font-medium">Next:</p>
          {nextSessions.map((session) => (
            <p key={session.sessionId}>
              {session.label} ·{" "}
              {focusDateTimeFormatter.format(
                new Date(session.startTimeUtc),
              )}
            </p>
          ))}
        </div>
      )}
    </FocusFullscreenFrame>
  );
}
