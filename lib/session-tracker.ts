// Pure function: group attempts into study sessions by time gap.
//
// A "session" = consecutive attempts where each is <= maxGapMin minutes from
// the previous one. Two rapid attempts then a 30-minute gap then another
// attempt = 2 sessions.
//
// No DB access, no server-only imports — purely functional so it's cheap
// to test and can be reused from any layer.

export interface AttemptPoint {
  attemptedAt: string;        // ISO datetime
  topic:       string | null;
  timeSpent:   number | null; // seconds; may be null
}

export interface Session {
  startAt:       string;   // ISO
  endAt:         string;   // ISO (== startAt if single attempt with no timeSpent)
  durationMin:   number;   // end - start, minimum 1 min to avoid zero-duration sessions
  attemptCount:  number;
  topics:        string[]; // distinct topics in this session, insertion order
}

export interface SessionStats {
  todayMinutes:           number;
  last7dMinutes:          number;
  sessionsLast7d:         number;
  avgSessionDurationMin:  number | null; // null if zero sessions
}

const DEFAULT_MAX_GAP_MIN = 15;
const MIN_SESSION_MIN = 1;

/**
 * Group attempts into sessions. Attempts do NOT need to be pre-sorted —
 * this function sorts internally for robustness.
 *
 * Edge cases:
 *   - empty input           → []
 *   - single attempt        → one session, duration = timeSpent (min 1 min)
 *   - gap exactly at maxGap → same session (inclusive)
 *   - gap > maxGap          → new session
 */
export function computeSessions(
  attempts: AttemptPoint[],
  maxGapMin: number = DEFAULT_MAX_GAP_MIN
): Session[] {
  if (attempts.length === 0) return [];

  // Defensive sort ASC by timestamp. Cheap; we never have millions of attempts.
  const sorted = [...attempts].sort((a, b) =>
    a.attemptedAt.localeCompare(b.attemptedAt)
  );

  const sessions: Session[] = [];
  let current: {
    start: Date;
    end:   Date;
    count: number;
    topics: string[];
    lastTimeSpent: number | null;
  } | null = null;

  const maxGapMs = maxGapMin * 60_000;

  for (const a of sorted) {
    const t = new Date(a.attemptedAt);
    if (Number.isNaN(t.getTime())) continue; // skip malformed rows

    if (current && t.getTime() - current.end.getTime() <= maxGapMs) {
      // same session — extend
      current.end = t;
      current.count += 1;
      if (a.topic && !current.topics.includes(a.topic)) current.topics.push(a.topic);
      current.lastTimeSpent = a.timeSpent ?? current.lastTimeSpent;
    } else {
      // close previous session
      if (current) sessions.push(finalise(current));
      current = {
        start: t,
        end:   t,
        count: 1,
        topics: a.topic ? [a.topic] : [],
        lastTimeSpent: a.timeSpent,
      };
    }
  }
  if (current) sessions.push(finalise(current));

  return sessions;
}

function finalise(c: {
  start: Date; end: Date; count: number; topics: string[]; lastTimeSpent: number | null;
}): Session {
  let durationMs = c.end.getTime() - c.start.getTime();
  // Single-attempt session: use last logged timeSpent (seconds) as a proxy.
  if (durationMs === 0 && c.lastTimeSpent && c.lastTimeSpent > 0) {
    durationMs = c.lastTimeSpent * 1000;
  }
  const durationMin = Math.max(MIN_SESSION_MIN, Math.round(durationMs / 60_000));
  return {
    startAt:      c.start.toISOString(),
    endAt:        c.end.toISOString(),
    durationMin,
    attemptCount: c.count,
    topics:       c.topics,
  };
}

/**
 * Roll up sessions into the stats the dashboard + planner consume.
 * `now` is injectable for testability; defaults to current time.
 */
export function computeSessionStats(sessions: Session[], now: Date = new Date()): SessionStats {
  const todayYmd = now.toISOString().slice(0, 10);
  const weekAgoMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;

  let todayMinutes = 0;
  let last7dMinutes = 0;
  let sessionsLast7d = 0;

  for (const s of sessions) {
    const startMs = new Date(s.startAt).getTime();
    if (s.startAt.slice(0, 10) === todayYmd) todayMinutes += s.durationMin;
    if (startMs >= weekAgoMs) {
      last7dMinutes += s.durationMin;
      sessionsLast7d += 1;
    }
  }

  const avgSessionDurationMin =
    sessionsLast7d > 0 ? Math.round(last7dMinutes / sessionsLast7d) : null;

  return { todayMinutes, last7dMinutes, sessionsLast7d, avgSessionDurationMin };
}
