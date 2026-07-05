import { describe, expect, test } from "bun:test";
import {
  getCountdownColorClass,
  getFocusedSession,
} from "../src/utils/timeUtils";
import type { CountdownSession, TimeState } from "../src/utils/types";

const session = (
  sessionId: string,
  startTimeUtc: string,
  durationMinutes: number,
): CountdownSession => ({
  sessionId,
  label: sessionId,
  startTimeUtc,
  durationMs: durationMinutes * 60 * 1000,
});

describe("getCountdownColorClass", () => {
  test.each([
    [{ label: "Starts in", diffMs: 10 * 60 * 1000 }, "text-accent-red"],
    [{ label: "Starts in", diffMs: 45 * 60 * 1000 }, "text-accent-amber"],
    [{ label: "Starts in", diffMs: 2 * 60 * 60 * 1000 }, "text-subtle"],
    [{ label: "Time remaining", diffMs: 10 * 60 * 1000 }, "text-accent-red"],
    [{ label: "Completed", diffMs: 0 }, "text-accent-green"],
  ] satisfies Array<[TimeState, string]>)(
    "maps %o to %s",
    (timeState, expectedClass) => {
      expect(getCountdownColorClass(timeState)).toBe(expectedClass);
    },
  );
});

describe("getFocusedSession", () => {
  const now = new Date("2026-07-03T10:00:00.000Z");

  test("selects the next event by start time, not end time", () => {
    const sessions = [
      session("next-long", "2026-07-03T11:00:00.000Z", 180),
      session("later-short", "2026-07-03T12:00:00.000Z", 30),
    ];

    expect(getFocusedSession(sessions, now)?.sessionId).toBe("next-long");
  });

  test("prioritises a running event over an upcoming event", () => {
    const sessions = [
      session("running", "2026-07-03T09:00:00.000Z", 240),
      session("upcoming", "2026-07-03T10:30:00.000Z", 30),
    ];

    expect(getFocusedSession(sessions, now)?.sessionId).toBe("running");
  });

  test("returns null when all events are completed", () => {
    const sessions = [
      session("completed", "2026-07-03T08:00:00.000Z", 30),
    ];

    expect(getFocusedSession(sessions, now)).toBeNull();
  });
});
