import type { CountdownSession } from "../utils/types";
import { formatDuration, getTimeState, intlCache } from "../utils/timeUtils";

type ActiveTimerProps = {
  session: CountdownSession;
  currentTime: Date;
};

export const ActiveTimer = ({ session, currentTime }: ActiveTimerProps) => {
  const timeState = getTimeState(session, currentTime);

  // Urgency-based time threshold coloring
  const getCountdownColor = () => {
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

  const countdownColor = getCountdownColor();

  return (
    <div className="space-y-4 rounded-xl border border-border bg-background-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <h2
          className={`font-display text-xl font-semibold text-foreground ${timeState.label === "Completed" ? "line-through" : ""}`}
        >
          {session.label}
        </h2>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-background-elevated p-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-subtle">{timeState.label}</p>
          <p
            className={`font-display text-4xl font-semibold tabular-nums tracking-tight ${countdownColor}`}
          >
            {timeState.diffMs > 0
              ? formatDuration(timeState.diffMs)
              : "00:00:00"}
          </p>
        </div>
        <div className="flex items-center gap-3 border-t border-border pt-3">
          <p className="text-sm text-subtle italic">
            Starting at {intlCache.format(new Date(session.startTimeUtc))}
          </p>
        </div>
      </div>
    </div>
  );
};
