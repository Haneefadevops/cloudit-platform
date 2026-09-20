import { getAiMaintenanceProjection } from "../lib/ai-maintenance-api";
import type { AiMaintenanceProjection } from "../lib/ai-maintenance-types";
import { OperationsApiError } from "../lib/operations-api";
import { formatMaltaTime } from "../lib/operations-time";
import { requireOperationsSession } from "../lib/server-session";
import {
  AiBudgetCard,
  AiDriftCard,
  AiFindingsCard,
  AiKillSwitchesCard,
} from "./ai-maintenance/ai-cards";
import { OperationsErrorState } from "./operations-error-state";

const pageHeader = (
  <header className="page-header">
    <div>
      <p className="eyebrow">OPERATIONS · AI MAINTENANCE</p>
      <h1>AI Maintenance</h1>
      <p>Read-only AI findings, workflow/portal drift, budget usage and kill-switch state</p>
    </div>
  </header>
);

function AiMaintenanceContent({ projection }: { projection: AiMaintenanceProjection }) {
  return (
    <div className="page-wrap">
      {pageHeader}
      <p className="ops-updated">
        Environment {projection.environmentKey} · Generated {formatMaltaTime(projection.generatedAt)}
      </p>
      <section className="ops-client" aria-labelledby="ai-maintenance-findings">
        <h2 id="ai-maintenance-findings" className="ops-client-title">Findings</h2>
        <AiFindingsCard findings={projection.findings} />
      </section>
      <section className="ops-client" aria-labelledby="ai-maintenance-drift">
        <h2 id="ai-maintenance-drift" className="ops-client-title">Drift</h2>
        <AiDriftCard drift={projection.drift} />
      </section>
      <section className="ops-client" aria-labelledby="ai-maintenance-budget">
        <h2 id="ai-maintenance-budget" className="ops-client-title">Budget</h2>
        <AiBudgetCard budget={projection.budget} />
      </section>
      <section className="ops-client" aria-labelledby="ai-maintenance-kill-switches">
        <h2 id="ai-maintenance-kill-switches" className="ops-client-title">Kill switches</h2>
        <AiKillSwitchesCard killSwitches={projection.killSwitches} />
      </section>
    </div>
  );
}

export async function AiMaintenancePage() {
  const session = await requireOperationsSession();
  void session;
  const view = await getAiMaintenanceProjection();
  if (!view.available) {
    return (
      <div className="page-wrap">
        {pageHeader}
        <OperationsErrorState
          error={new OperationsApiError(503, "AI maintenance view is currently unavailable.")}
        />
      </div>
    );
  }
  return <AiMaintenanceContent projection={view.projection} />;
}
