import { createFileRoute } from "@tanstack/react-router";
import { useCountdown } from "../utils/CountdownContext";
import { useCountdownTimer } from "../hooks/useCountdownTimer";
import { getTimeState, formatDuration } from "../utils/timeUtils";

export const Route = createFileRoute("/recent")({
  component: RecentSessionPage,
});

function RecentSessionPage() {
  const { sessions, loading, error } = useCountdown();
  const currentTime = useCountdownTimer();

  // Filter out completed sessions and find the one with earliest endTimeUtc
  const activeSessions = sessions.filter(
    (session) => new Date(session.endTimeUtc) > currentTime
  );

  const sessionToFocus =
    activeSessions.length > 0
      ? activeSessions.reduce((earliest, current) => {
          return new Date(current.endTimeUtc) < new Date(earliest.endTimeUtc)
            ? current
            : earliest;
        })
      : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-destructive">Error: {error}</div>
      </div>
    );
  }

  if (!sessionToFocus) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-2xl text-muted-foreground">
          No sessions available
        </div>
      </div>
    );
  }

  const timeState = getTimeState(sessionToFocus, currentTime);
  const isCompleted = timeState.label === "Completed";
  const formattedTime = formatDuration(Math.max(0, timeState.diffMs));
  const startTime = new Date(sessionToFocus.startTimeUtc);

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
    <div className="flex items-center justify-center h-screen bg-background p-8">
      <div className="text-center space-y-8 max-w-4xl w-full">
        {/* Session Label */}
        <h1
          className={`text-6xl md:text-8xl font-bold ${isCompleted ? "line-through text-accent-green" : "text-foreground"}`}
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
          className={`text-8xl md:text-9xl font-mono font-bold ${timerColor} tracking-wider`}
        >
          {formattedTime}
        </div>

        {/* Start Time */}
        <div className="text-xl md:text-2xl text-muted-foreground">
          {isCompleted ? "Started" : "Starts"} at{" "}
          {startTime.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}
        </div>
      </div>
    </div>
  );
}
