import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class DashboardService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(_organizationId: string) {
    return [];
  }

  async summary(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT
         (SELECT COUNT(*)::int FROM employees WHERE organization_id = $1::uuid AND COALESCE(employment_status, 'active') = 'active' AND termination_date IS NULL) AS active_employees,
         (SELECT COUNT(*)::int FROM employees WHERE organization_id = $1::uuid AND created_at >= now() - INTERVAL '30 days') AS new_hires_30d,
         (SELECT COUNT(*)::int FROM leave_records WHERE organization_id = $1::uuid AND status IN ('pending', 'awaiting_level1', 'awaiting_level2', 'awaiting_level3')) AS pending_leave,
         (SELECT COUNT(*)::int FROM overtime_records WHERE organization_id = $1::uuid AND status IN ('pending', 'awaiting_level1', 'awaiting_level2', 'awaiting_level3')) AS pending_overtime`,
      [organizationId],
    );

    const expenseResult = await this.databaseService.query(
      `SELECT COUNT(*)::int AS pending_expenses
       FROM expense_claims
       WHERE organization_id = $1::uuid
         AND status IN ('pending', 'awaiting_level1', 'awaiting_level2', 'awaiting_level3', 'awaiting_finance')`,
      [organizationId],
    );

    const todayResult = await this.databaseService.query(
      `WITH today_assignments AS (
         SELECT ra.employee_id
         FROM roster_assignments ra
         WHERE ra.organization_id = $1::uuid
           AND ra.date = CURRENT_DATE
       )
       SELECT
         COUNT(*)::int AS scheduled_today,
         COUNT(DISTINCT ce.employee_id)::int AS clocked_in_today
       FROM today_assignments ta
       LEFT JOIN clock_events ce
         ON ce.organization_id = $1::uuid
        AND ce.employee_id = ta.employee_id
        AND ce.event_type = 'clock_in'
        AND ce.timestamp::date = CURRENT_DATE`,
      [organizationId],
    );

    const row = result.rows[0] ?? {};
    const today = todayResult.rows[0] ?? {};
    return {
      activeEmployees: Number(row.active_employees ?? 0),
      newHires30d: Number(row.new_hires_30d ?? 0),
      pendingLeave: Number(row.pending_leave ?? 0),
      pendingOvertime: Number(row.pending_overtime ?? 0),
      pendingExpenses: Number(expenseResult.rows[0]?.pending_expenses ?? 0),
      scheduledToday: Number(today.scheduled_today ?? 0),
      clockedInToday: Number(today.clocked_in_today ?? 0),
      attendanceRateToday:
        Number(today.scheduled_today ?? 0) > 0
          ? Math.round(
              (Number(today.clocked_in_today ?? 0) /
                Number(today.scheduled_today)) *
                100,
            )
          : 0,
    };
  }

  async widgets(organizationId: string) {
    const summary = await this.summary(organizationId);
    const payrollResult = await this.databaseService.query(
      `SELECT id, month, year, status, total_employees, total_gross, total_net
       FROM payroll_runs
       WHERE organization_id = $1::uuid
       ORDER BY year DESC, month DESC
       LIMIT 1`,
      [organizationId],
    );
    const assetsResult = await this.databaseService.query(
      `SELECT
         COUNT(*)::int AS total_assets,
         COUNT(*) FILTER (WHERE status = 'assigned')::int AS assigned_assets,
         COUNT(*) FILTER (WHERE status = 'available')::int AS available_assets
       FROM assets
       WHERE organization_id = $1::uuid`,
      [organizationId],
    );
    const docsResult = await this.databaseService.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_signatures,
         COUNT(*) FILTER (WHERE status = 'signed')::int AS signed_documents
       FROM sent_documents
       WHERE organization_id = $1::uuid`,
      [organizationId],
    );

    return [
      {
        id: "headcount",
        type: "metric",
        title: "Active Employees",
        value: summary.activeEmployees,
        tone: "purple",
      },
      {
        id: "attendance-today",
        type: "metric",
        title: "Attendance Today",
        value: summary.attendanceRateToday,
        suffix: "%",
        tone: "green",
      },
      {
        id: "pending-approvals",
        type: "queue",
        title: "Pending Approvals",
        value:
          summary.pendingLeave +
          summary.pendingOvertime +
          summary.pendingExpenses,
        breakdown: {
          leave: summary.pendingLeave,
          overtime: summary.pendingOvertime,
          expenses: summary.pendingExpenses,
        },
      },
      {
        id: "assets",
        type: "asset-summary",
        title: "Assets",
        ...(assetsResult.rows[0] ?? {}),
      },
      {
        id: "documents",
        type: "document-summary",
        title: "Documents",
        ...(docsResult.rows[0] ?? {}),
      },
      {
        id: "payroll",
        type: "payroll-summary",
        title: "Latest Payroll",
        data: payrollResult.rows[0] ?? null,
      },
    ];
  }

  async activities(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT id,
              module,
              action,
              severity,
              entity_type,
              entity_id,
              COALESCE(entity_label, target_name_snapshot, actor_name_snapshot, entity_type) AS title,
              actor_name_snapshot AS actor_name,
              created_at,
              metadata
       FROM audit_events
       WHERE organization_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 30`,
      [organizationId],
    );
    return result.rows;
  }
}
