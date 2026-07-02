import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type { CRMSummary, CRMContext } from "../common/contracts/orbitone.v2";
import type { AuthContext } from "../auth/types";

@Injectable()
export class CrmService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getCRMSummary(user: AuthContext): Promise<CRMSummary> {
    const context: CRMContext = {
      userId: user.id,
      organizationId: user.organizationId,
    };

    const where = context.organizationId
      ? "organization_id = $1"
      : "assigned_to_user_id = $1";
    const params = [context.organizationId ?? context.userId];

    const [
      customersResult,
      highPriorityResult,
      openFollowUpsResult,
      overdueFollowUpsResult,
      forecastResult,
      staleResult,
      outcomeResult,
    ] = await Promise.all([
      this.databaseService.query(
        `SELECT lifecycle_stage, COUNT(*) FROM customers WHERE ${where} GROUP BY lifecycle_stage`,
        params,
      ),
      this.databaseService.query(
        `SELECT COUNT(*) FROM customers WHERE ${where} AND priority = 'high'`,
        params,
      ),
      this.databaseService.query(
        `SELECT COUNT(*) FROM customer_follow_ups f
         JOIN customers c ON c.id = f.customer_id
         WHERE ${where.replace(/customers/g, "c")} AND f.completed_at IS NULL`,
        params,
      ),
      this.databaseService.query(
        `SELECT COUNT(*) FROM customer_follow_ups f
         JOIN customers c ON c.id = f.customer_id
         WHERE ${where.replace(/customers/g, "c")} AND f.completed_at IS NULL AND f.due_at < now()`,
        params,
      ),
      this.databaseService.query(
        `SELECT COALESCE(SUM(value_amount), 0) AS total, value_currency
         FROM customers
         WHERE ${where} AND outcome = 'in_progress'
         GROUP BY value_currency`,
        params,
      ),
      this.databaseService.query(
        `SELECT COUNT(*) FROM customers
         WHERE ${where} AND outcome = 'in_progress'
         AND (last_contacted_at IS NULL OR last_contacted_at < now() - interval '7 days')`,
        params,
      ),
      this.databaseService.query(
        `SELECT outcome, COUNT(*) FROM customers WHERE ${where} AND outcome IN ('won', 'lost') GROUP BY outcome`,
        params,
      ),
    ]);

    const lifecycle: CRMSummary["lifecycle"] = {
      new: 0,
      contacted: 0,
      qualified: 0,
      meeting: 0,
      proposal: 0,
      customer: 0,
      lost: 0,
      archived: 0,
    };
    for (const row of customersResult.rows) {
      lifecycle[row.lifecycle_stage as keyof CRMSummary["lifecycle"]] = Number(
        row.count,
      );
    }

    const totalCustomers = Object.values(lifecycle).reduce((a, b) => a + b, 0);

    const forecastRow = forecastResult.rows[0];
    const forecastValue = forecastRow ? Number(forecastRow.total) : 0;
    const forecastCurrency = (forecastRow?.value_currency as string) ?? "LKR";

    const wonRow = outcomeResult.rows.find((r) => r.outcome === "won");
    const lostRow = outcomeResult.rows.find((r) => r.outcome === "lost");
    const wonCount = wonRow ? Number(wonRow.count) : 0;
    const lostCount = lostRow ? Number(lostRow.count) : 0;
    const closedCount = wonCount + lostCount;
    const conversionRate =
      closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;

    return {
      lifecycle,
      highPriority: Number(highPriorityResult.rows[0].count),
      openFollowUps: Number(openFollowUpsResult.rows[0].count),
      overdueFollowUps: Number(overdueFollowUpsResult.rows[0].count),
      totalCustomers,
      forecastValue,
      forecastCurrency,
      staleLeads: Number(staleResult.rows[0].count),
      wonCount,
      lostCount,
      conversionRate,
    };
  }
}
