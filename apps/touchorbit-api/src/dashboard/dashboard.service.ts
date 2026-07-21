import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class DashboardService {
  constructor(private readonly databaseService: DatabaseService) {}

  findAll(_organizationId: string) {
    return [];
  }

  async summary(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT
         (SELECT COUNT(*)::int FROM employees WHERE organization_id = $1::uuid AND COALESCE(employment_status, 'active') = 'active' AND termination_date IS NULL) AS active_employees,
         (SELECT COUNT(*)::int FROM employees WHERE organization_id = $1::uuid AND created_at >= now() - INTERVAL '30 days') AS new_hires_30d,
         (SELECT COUNT(*)::int FROM leave_records WHERE organization_id = $1::uuid AND status IN ('pending', 'awaiting_level1', 'awaiting_level2', 'awaiting_level3')) AS pending_leave,
         (SELECT COUNT(*)::int FROM overtime_records WHERE organization_id = $1::uuid AND status IN ('pending', 'awaiting_level1', 'awaiting_level2', 'awaiting_level3')) AS pending_overtime,
         (SELECT COUNT(*)::int FROM comp_off_records WHERE organization_id = $1::uuid AND status = 'pending') AS pending_comp_off,
         (SELECT COUNT(*)::int FROM leave_encashment_requests WHERE organization_id = $1::uuid AND status = 'pending') AS pending_encashment_count,
         (SELECT COALESCE(SUM(amount), 0)::numeric FROM leave_encashment_requests WHERE organization_id = $1::uuid AND status = 'pending') AS pending_encashment_amount,
         (SELECT COUNT(*)::int FROM performance_review_cycles WHERE organization_id = $1::uuid AND status = 'active') AS active_performance_cycles,
         (SELECT COUNT(*)::int FROM performance_reviews WHERE organization_id = $1::uuid AND status = 'pending_self') AS pending_performance_self,
         (SELECT COUNT(*)::int FROM performance_reviews WHERE organization_id = $1::uuid AND status = 'pending_manager') AS pending_performance_manager,
         (SELECT COUNT(*)::int FROM training_assignments WHERE organization_id = $1::uuid AND status = 'assigned') AS training_assigned,
         (SELECT COUNT(*)::int FROM training_assignments WHERE organization_id = $1::uuid AND status = 'in_progress') AS training_in_progress,
         (SELECT COUNT(*)::int FROM training_assignments WHERE organization_id = $1::uuid AND status = 'completed') AS training_completed,
         (SELECT COUNT(*)::int FROM training_assignments WHERE organization_id = $1::uuid AND reschedule_requested = true AND status NOT IN ('cancelled')) AS training_reschedule_requests`,
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

    const announcementsResult = await this.databaseService.query(
      `SELECT id, title, priority, created_at
       FROM announcements
       WHERE organization_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 3`,
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
      pendingCompOff: Number(row.pending_comp_off ?? 0),
      pendingEncashmentCount: Number(row.pending_encashment_count ?? 0),
      pendingEncashmentAmount: Number(row.pending_encashment_amount ?? 0),
      activePerformanceCycles: Number(row.active_performance_cycles ?? 0),
      pendingPerformanceSelf: Number(row.pending_performance_self ?? 0),
      pendingPerformanceManager: Number(row.pending_performance_manager ?? 0),
      trainingAssigned: Number(row.training_assigned ?? 0),
      trainingInProgress: Number(row.training_in_progress ?? 0),
      trainingCompleted: Number(row.training_completed ?? 0),
      trainingRescheduleRequests: Number(row.training_reschedule_requests ?? 0),
      latestAnnouncements: announcementsResult.rows.map((r) => ({
        id: r.id,
        title: r.title,
        priority: r.priority,
        created_at: r.created_at,
      })),
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

  async getLayout(organizationId: string, userId: string) {
    const result = await this.databaseService.query(
      `SELECT widgets, layout_lg, layout_md, layout_sm
       FROM user_dashboard_layouts
       WHERE organization_id = $1::uuid AND user_id = $2::uuid`,
      [organizationId, userId],
    );
    const row = result.rows[0];
    return row
      ? { widgets: row.widgets, layouts: { lg: row.layout_lg, md: row.layout_md, sm: row.layout_sm } }
      : null;
  }

  async saveLayout(organizationId: string, userId: string, config: any) {
    const widgets = Array.isArray(config?.widgets) ? config.widgets : [];
    const layouts = config?.layouts ?? {};
    await this.databaseService.query(
      `INSERT INTO user_dashboard_layouts
         (organization_id, user_id, widgets, layout_lg, layout_md, layout_sm, updated_at)
       VALUES ($1::uuid, $2::uuid, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, now())
       ON CONFLICT (user_id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id, widgets = EXCLUDED.widgets,
         layout_lg = EXCLUDED.layout_lg, layout_md = EXCLUDED.layout_md,
         layout_sm = EXCLUDED.layout_sm, updated_at = now()`,
      [
        organizationId,
        userId,
        JSON.stringify(widgets),
        JSON.stringify(layouts.lg ?? []),
        JSON.stringify(layouts.md ?? []),
        JSON.stringify(layouts.sm ?? []),
      ],
    );
    return { saved: true };
  }

  async resetLayout(organizationId: string, userId: string) {
    await this.databaseService.query(
      `DELETE FROM user_dashboard_layouts WHERE organization_id = $1::uuid AND user_id = $2::uuid`,
      [organizationId, userId],
    );
    return { reset: true };
  }
}
