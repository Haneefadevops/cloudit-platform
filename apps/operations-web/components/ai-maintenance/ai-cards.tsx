import type {
  AiBudgetProjection,
  AiDriftProjection,
  AiFindingProjection,
  AiKillSwitchProjection,
} from "../../lib/ai-maintenance-types";
import { formatMaltaTime } from "../../lib/operations-time";
import { BooleanPill } from "../status-pill";
import { AiFindingRow } from "./ai-finding-row";

export function AiFindingsCard({ findings }: { findings: AiFindingProjection[] }) {
  return (
    <article className="ops-card">
      <div className="ops-card-head">
        <h3>Findings</h3>
        <span className="ops-sub">{findings.length} published</span>
      </div>
      {findings.length === 0 ? (
        <p className="ops-empty-note">No AI findings have been published yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="ops-table">
            <thead>
              <tr>
                <th scope="col">Severity</th>
                <th scope="col">Title</th>
                <th scope="col">Assessment</th>
                <th scope="col">Confidence</th>
                <th scope="col">Issue code</th>
                <th scope="col">Runbook</th>
                <th scope="col">Model</th>
                <th scope="col">Explained (Europe/Malta)</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((finding) => (
                <AiFindingRow key={finding.findingKey} finding={finding} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export function AiDriftCard({ drift }: { drift: AiDriftProjection }) {
  return (
    <article className="ops-card">
      <div className="ops-card-head">
        <h3>Workflow / portal drift</h3>
        <span className="status-pill no-data">
          <span />
          {drift.state}
        </span>
      </div>
      <div className="ops-stat-grid">
        <div className="ops-stat">
          <h3>Drift count</h3>
          <p>{drift.driftCount}</p>
        </div>
        <div className="ops-stat">
          <h3>Stale count</h3>
          <p>{drift.staleCount}</p>
        </div>
        <div className="ops-stat">
          <h3>Last scan</h3>
          <p>{formatMaltaTime(drift.scannedAt)}</p>
        </div>
      </div>
    </article>
  );
}

export function AiBudgetCard({ budget }: { budget: AiBudgetProjection }) {
  const dayPercent =
    budget.dayCallsMax > 0
      ? Math.min(100, Math.round((budget.dayCallsUsed / budget.dayCallsMax) * 100))
      : null;
  return (
    <article className="ops-card">
      <div className="ops-card-head">
        <h3>AI budget</h3>
        <BooleanPill value={budget.aiEnabled} trueLabel="AI ENABLED" falseLabel="AI DISABLED" />
      </div>
      <div className="ops-stat-grid">
        <div className="ops-stat">
          <h3>Calls today</h3>
          <p>
            {budget.dayCallsUsed} / {budget.dayCallsMax}
          </p>
          {dayPercent === null ? (
            <p className="ops-sub">Daily cap not configured</p>
          ) : (
            <p className="ops-sub">{dayPercent}% of daily cap used</p>
          )}
        </div>
        <div className="ops-stat">
          <h3>Spend this month</h3>
          <p>€{budget.monthEurUsed}</p>
          <p className="ops-sub">of €{budget.monthEurCeiling.toFixed(2)} ceiling</p>
        </div>
      </div>
    </article>
  );
}

export function AiKillSwitchesCard({ killSwitches }: { killSwitches: AiKillSwitchProjection }) {
  const switches: { label: string; value: boolean }[] = [
    { label: "AI", value: killSwitches.aiEnabled },
    { label: "Telegram commands", value: killSwitches.telegramCommandsEnabled },
    { label: "Auto-remediation", value: killSwitches.autoRemediationEnabled },
    { label: "Repair master", value: killSwitches.repairMasterEnabled },
  ];
  return (
    <article className="ops-card">
      <div className="ops-card-head">
        <h3>Kill switches</h3>
        <span className="ops-sub">Informational only — changes require the agent controls</span>
      </div>
      <div className="ops-stat-grid">
        {switches.map((killSwitch) => (
          <div className="ops-stat" key={killSwitch.label}>
            <h3>{killSwitch.label}</h3>
            <BooleanPill value={killSwitch.value} trueLabel="ON" falseLabel="OFF" />
          </div>
        ))}
      </div>
    </article>
  );
}
