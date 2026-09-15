import {
  getOperationsBackups,
  OperationsApiError,
  type BackupDayState,
  type OperationsBackups,
} from "../lib/operations-api";
import { formatAge, formatDuration, formatMaltaTime } from "../lib/operations-time";
import { BooleanPill, HealthPill } from "./status-pill";
import { OperationsErrorState } from "./operations-error-state";
import { Sparkline } from "./ops-sparkline";

const emptyBackups: OperationsBackups = {
  generatedAt: "",
  rollup: { level: "NO_DATA", reasons: [] },
  calendar: { year: 0, month: 0, days: [] },
  latestBackup: null,
  sizeTrend: [],
  latestRestoreTest: null,
  schedule: { lastSuccessAt: null, expectedNextRunAt: null, overdue: false },
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const dayStateLabel: Record<BackupDayState, string> = {
  ok: "OK",
  failed: "FAILED",
  missing: "MISSING",
  future: "FUTURE",
};

function formatBytes(value: number | null): string {
  if (value === null) return "NO DATA";
  if (value >= 1073741824) return `${(value / 1073741824).toFixed(1)} GB`;
  return `${(value / 1048576).toFixed(1)} MB`;
}

function safeExternalUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function RunLink({ url }: { url: string | null }) {
  const safe = safeExternalUrl(url);
  if (!safe) return <>NO DATA</>;
  return <a className="ops-link" href={safe} target="_blank" rel="noreferrer">View run</a>;
}

function RestoreCheckPill({ value }: { value: boolean | null }) {
  if (value === null) {
    return <span className="status-pill no-data"><span />Not reported</span>;
  }
  return <BooleanPill value={value} trueLabel="PASS" falseLabel="FAIL" />;
}

function RestoreResultPill({ result }: { result: "passed" | "failed" | null }) {
  if (result === null) {
    return <span className="status-pill no-data"><span />Not reported</span>;
  }
  return <span className={`status-pill ${result === "passed" ? "green" : "red"}`}>
    <span />
    {result === "passed" ? "PASSED" : "FAILED"}
  </span>;
}

export async function BackupsPage() {
  const now = new Date();
  try {
    const data = await getOperationsBackups();
    return <BackupsContent data={data} now={now} />;
  } catch (error) {
    if (error instanceof OperationsApiError && error.statusCode === 404) {
      return <BackupsContent data={emptyBackups} now={now} />;
    }
    return <div className="page-wrap">
      <header className="page-header"><div><p className="eyebrow">OPERATIONS · BACKUP EVIDENCE</p><h1>Backup centre</h1><p>Encrypted archive and isolated restore evidence</p></div></header>
      <OperationsErrorState error={error} />
    </div>;
  }
}

function BackupCalendar({ calendar }: { calendar: OperationsBackups["calendar"] }) {
  const monthDate = new Date(calendar.year, calendar.month - 1, 1);
  const monthLabel = calendar.year > 0 && calendar.month >= 1 && calendar.month <= 12
    ? monthDate.toLocaleString("en-US", { month: "long", year: "numeric" })
    : "—";
  const leadingBlanks = calendar.year > 0 ? (monthDate.getDay() + 6) % 7 : 0;
  return (
    <article className="ops-card">
      <div className="ops-card-head">
        <h3>Daily Backups — {monthLabel}</h3>
        <span className="ops-sub">{calendar.days.length} day window</span>
      </div>
      {calendar.days.length === 0
        ? <p className="ops-empty-note">No calendar evidence collected yet (NO DATA).</p>
        : <>
            <div className="ops-calendar" role="grid" aria-label={`Daily backup calendar for ${monthLabel}`}>
              {WEEKDAYS.map((weekday) => <div key={weekday} className="ops-calendar-weekday" role="columnheader">{weekday}</div>)}
              {Array.from({ length: leadingBlanks }, (_, i) => <div key={`blank-${i}`} className="ops-calendar-day is-blank" aria-hidden="true" />)}
              {calendar.days.map((day) => {
                const dayOfMonth = Number(day.date.slice(8, 10));
                return (
                  <div key={day.date} className={`ops-calendar-day is-${day.state}`} role="gridcell" aria-label={`${day.date}: ${dayStateLabel[day.state]}`}>
                    <span className="ops-calendar-daynum">{dayOfMonth}</span>
                    <span className="ops-calendar-state">{dayStateLabel[day.state]}</span>
                  </div>
                );
              })}
            </div>
            <p className="ops-sub">
              <span style={{ color: "var(--green)" }}>● OK</span> · <span style={{ color: "var(--pink)" }}>● Failed</span> · <span style={{ color: "var(--amber)" }}>● Missing</span> · <span style={{ color: "var(--muted)" }}>● Future</span>
            </p>
          </>}
    </article>
  );
}

function LatestBackupCard({ backup, now }: { backup: OperationsBackups["latestBackup"]; now: Date }) {
  if (!backup) {
    return <p className="ops-empty-note">No backup evidence collected yet (NO DATA).</p>;
  }
  return (
    <article className="ops-card">
      <div className="ops-card-head">
        <h3>Latest backup</h3>
        <span className="ops-client-state">{backup.retentionClass.toUpperCase()}</span>
      </div>
      <dl className="ops-def-list">
        <div>
          <dt>Created</dt>
          <dd>{formatMaltaTime(backup.backupTimestamp)} <span className="ops-age">{formatAge(backup.backupTimestamp, now)}</span></dd>
        </div>
        <div>
          <dt>Age</dt>
          <dd>{formatAge(backup.backupTimestamp, now)}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{formatDuration(backup.durationMs)}</dd>
        </div>
        <div>
          <dt>GitHub run</dt>
          <dd><RunLink url={backup.githubRunUrl} /></dd>
        </div>
        <div>
          <dt>Encrypted archive present</dt>
          <dd><BooleanPill value={backup.encryptedArchivePresent} trueLabel="YES" falseLabel="NO" /></dd>
        </div>
        <div>
          <dt>Checksum file present</dt>
          <dd><BooleanPill value={backup.checksumFilePresent} trueLabel="YES" falseLabel="NO" /></dd>
        </div>
        <div>
          <dt>Checksum verified</dt>
          <dd><BooleanPill value={backup.checksumVerified} trueLabel="YES" falseLabel="NO" /></dd>
        </div>
        <div>
          <dt>R2 round trip</dt>
          <dd><BooleanPill value={backup.driveRoundTripPassed} trueLabel="YES" falseLabel="NO" /></dd>
        </div>
        <div>
          <dt>Archive structure validated</dt>
          <dd><BooleanPill value={backup.archiveStructureValidated} trueLabel="YES" falseLabel="NO" /></dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{formatBytes(backup.sizeBytes)}</dd>
        </div>
        <div>
          <dt>Retention class</dt>
          <dd>{backup.retentionClass}</dd>
        </div>
      </dl>
    </article>
  );
}

function SizeTrendCard({ sizeTrend }: { sizeTrend: OperationsBackups["sizeTrend"] }) {
  const points = sizeTrend.map((point) => ({ value: point.sizeBytes, ok: null }));
  const numericCount = points.filter((point) => point.value !== null).length;
  return (
    <article className="ops-card">
      <div className="ops-card-head">
        <h3>Backup size trend</h3>
        <span className="ops-sub">{sizeTrend.length} day window</span>
      </div>
      {sizeTrend.length < 2
        ? <p className="ops-empty-note">Trend chart appears after 2 or more days of evidence ({sizeTrend.length} day collected).</p>
        : numericCount < 2
          ? <p className="ops-empty-note">No trend data (NO DATA).</p>
          : <>
              <Sparkline labelledBy="backups-size-trend" points={points} />
              <span className="visually-hidden" id="backups-size-trend">Daily backup archive size trend</span>
              <p className="ops-sub">Daily encrypted archive size</p>
            </>}
    </article>
  );
}

function LatestRestoreTestCard({ restoreTest, now }: { restoreTest: OperationsBackups["latestRestoreTest"]; now: Date }) {
  if (!restoreTest) {
    return <p className="ops-empty-note">No restore test evidence collected yet (NO DATA).</p>;
  }
  const checks: Array<{ label: string; value: boolean | null }> = [
    { label: "Checksum", value: restoreTest.checksumPassed },
    { label: "Decrypt", value: restoreTest.decryptPassed },
    { label: "Isolated restore", value: restoreTest.isolatedRestorePassed },
    { label: "Required objects", value: restoreTest.requiredObjectsPassed },
    { label: "RLS", value: restoreTest.rlsPassed },
    { label: "Anonymous denial", value: restoreTest.anonymousDenialPassed },
    { label: "Public whitelist", value: restoreTest.publicWhitelistPassed },
    { label: "Cleanup", value: restoreTest.cleanupPassed },
  ];
  return (
    <article className="ops-card">
      <div className="ops-card-head">
        <h3>Latest restore test</h3>
        <RestoreResultPill result={restoreTest.result} />
      </div>
      <dl className="ops-def-list">
        <div>
          <dt>Started</dt>
          <dd>{formatMaltaTime(restoreTest.startedAt)} <span className="ops-age">{formatAge(restoreTest.startedAt, now)}</span></dd>
        </div>
        <div>
          <dt>Age</dt>
          <dd>{formatAge(restoreTest.startedAt, now)}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{formatDuration(restoreTest.durationMs)}</dd>
        </div>
        <div>
          <dt>GitHub run</dt>
          <dd><RunLink url={restoreTest.githubRunUrl} /></dd>
        </div>
        {checks.map((check) => (
          <div key={check.label}>
            <dt>{check.label}</dt>
            <dd><RestoreCheckPill value={check.value} /></dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function ScheduleCard({ schedule, now }: { schedule: OperationsBackups["schedule"]; now: Date }) {
  return (
    <article className="ops-card">
      <div className="ops-card-head">
        <h3>Schedule</h3>
        <BooleanPill value={schedule.overdue} trueLabel="OVERDUE" falseLabel="ON TIME" />
      </div>
      <dl className="ops-def-list">
        <div>
          <dt>Last success</dt>
          <dd>{formatMaltaTime(schedule.lastSuccessAt)} <span className="ops-age">{formatAge(schedule.lastSuccessAt, now)}</span></dd>
        </div>
        <div>
          <dt>Expected next run</dt>
          <dd>{formatMaltaTime(schedule.expectedNextRunAt)} <span className="ops-age">{formatAge(schedule.expectedNextRunAt, now)}</span></dd>
        </div>
      </dl>
      {schedule.expectedNextRunAt === null
        ? <p className="ops-empty-note">No schedule evidence collected yet (NO DATA).</p>
        : null}
    </article>
  );
}

function BackupsContent({ data, now }: { data: OperationsBackups; now: Date }) {
  return <div className="page-wrap">
    <header className="page-header">
      <div><p className="eyebrow">OPERATIONS · BACKUP EVIDENCE</p><h1>Backup centre</h1><p>Encrypted archive and isolated restore evidence</p></div>
      <HealthPill status={data.rollup.level} />
    </header>
    <p className="ops-updated">Generated {formatMaltaTime(data.generatedAt)} <span className="ops-age">{formatAge(data.generatedAt, now)}</span></p>
    {data.rollup.reasons.length > 0 && <ul className="ops-reasons">
      {data.rollup.reasons.map((reason, i) => <li key={i}>{reason}</li>)}
    </ul>}
    {data.rollup.level === "NO_DATA"
      ? <section className="ops-client" aria-labelledby="backups-empty">
          <h2 id="backups-empty" className="ops-client-title">Backup evidence</h2>
          <article className="ops-card">
            <p className="ops-empty-note">No backup evidence collected yet (NO DATA).</p>
          </article>
        </section>
      : <>
          <section className="ops-client" aria-labelledby="backups-calendar">
            <h2 id="backups-calendar" className="ops-client-title">Daily backup calendar</h2>
            <BackupCalendar calendar={data.calendar} />
          </section>
          <section className="ops-client" aria-labelledby="backups-latest">
            <h2 id="backups-latest" className="ops-client-title">Latest backup</h2>
            <LatestBackupCard backup={data.latestBackup} now={now} />
          </section>
          <section className="ops-client" aria-labelledby="backups-trend">
            <h2 id="backups-trend" className="ops-client-title">Backup size trend</h2>
            <SizeTrendCard sizeTrend={data.sizeTrend} />
          </section>
          <section className="ops-client" aria-labelledby="backups-restore">
            <h2 id="backups-restore" className="ops-client-title">Restore testing</h2>
            <LatestRestoreTestCard restoreTest={data.latestRestoreTest} now={now} />
          </section>
          <section className="ops-client" aria-labelledby="backups-schedule">
            <h2 id="backups-schedule" className="ops-client-title">Schedule</h2>
            <ScheduleCard schedule={data.schedule} now={now} />
          </section>
        </>}
  </div>;
}
