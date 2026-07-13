import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

interface ReportFilters {
  startDate: string;
  endDate: string;
  departmentId?: string;
  employeeIds?: string[];
  mode?: "summary" | "detail";
  leaveType?: string;
  status?: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly databaseService: DatabaseService) {}

  findAll(_organizationId: string) {
    return [];
  }
  async attendance(organizationId: string, filters: ReportFilters) {
    return filters.mode === "detail"
      ? this.attendanceDetail(organizationId, filters)
      : this.attendanceSummary(organizationId, filters);
  }

  async leave(organizationId: string, filters: ReportFilters) {
    const { params, employeeConditions } = this.employeeFilter(
      organizationId,
      filters,
      "e",
    );
    const conditions = [
      "lr.organization_id = $1::uuid",
      "lr.start_date <= $3::date",
      "lr.end_date >= $2::date",
      ...employeeConditions,
    ];

    if (filters.leaveType) {
      params.push(filters.leaveType);
      conditions.push(`lr.leave_type = $${params.length}`);
    }
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`lr.status = $${params.length}`);
    }

    const result = await this.databaseService.query(
      `SELECT lr.id,
              concat_ws(' ', e.first_name, e.last_name) AS employee_name,
              d.name AS department_name,
              lr.leave_type,
              lr.start_date,
              lr.end_date,
              lr.days_count AS days,
              lr.status,
              lb.entitled_days,
              lb.used_days,
              lb.remaining_days
       FROM leave_records lr
       JOIN employees e ON e.id = lr.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN leave_balances lb
         ON lb.employee_id = lr.employee_id
        AND lb.organization_id = lr.organization_id
        AND lb.leave_type = lr.leave_type
        AND lb.year = EXTRACT(YEAR FROM lr.start_date)::int
       WHERE ${conditions.join(" AND ")}
       ORDER BY lr.start_date DESC, employee_name`,
      params,
    );
    return result.rows;
  }

  async payroll(organizationId: string, filters: ReportFilters) {
    const { params, employeeConditions } = this.employeeFilter(
      organizationId,
      filters,
      "e",
    );
    const conditions = [
      "pr.organization_id = $1::uuid",
      "make_date(pr.year, pr.month, 1) >= date_trunc('month', $2::date)::date",
      "make_date(pr.year, pr.month, 1) <= date_trunc('month', $3::date)::date",
      ...employeeConditions,
    ];

    const result = await this.databaseService.query(
      `SELECT pi.employee_id,
              concat_ws(' ', e.first_name, e.last_name) AS employee_name,
              d.name AS department_name,
              to_char(make_date(pr.year, pr.month, 1), 'Mon YYYY') AS month_label,
              pr.status AS run_status,
              pi.basic_salary,
              pi.gross_salary,
              pi.net_salary,
              pi.epf_employee,
              pi.epf_employer,
              pi.etf,
              pi.paye_tax,
              pi.total_deductions,
              pi.days_worked,
              pi.days_absent,
              pi.overtime_hours
       FROM payroll_items pi
       JOIN payroll_runs pr
         ON pr.id = pi.payroll_run_id
        AND pr.organization_id = pi.organization_id
       JOIN employees e ON e.id = pi.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY pr.year DESC, pr.month DESC, employee_name`,
      params,
    );
    return result.rows;
  }

  async roster(organizationId: string, filters: ReportFilters) {
    const { params, employeeConditions } = this.employeeFilter(
      organizationId,
      filters,
      "e",
    );
    const conditions = [
      "e.organization_id = $1::uuid",
      "e.termination_date IS NULL",
      ...employeeConditions,
    ];

    const result = await this.databaseService.query(
      `WITH daily AS (
         SELECT e.id AS employee_id,
                concat_ws(' ', e.first_name, e.last_name) AS employee_name,
                d.name AS department_name,
                ra.date,
                ra.shift_id,
                s.start_time,
                s.end_time,
                MIN(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_in') AS first_in,
                MAX(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_out') AS last_out
         FROM employees e
         LEFT JOIN departments d ON d.id = e.department_id
         JOIN roster_assignments ra
           ON ra.employee_id = e.id
          AND ra.organization_id = e.organization_id
          AND ra.date BETWEEN $2::date AND $3::date
         LEFT JOIN shifts s ON s.id = ra.shift_id
         LEFT JOIN clock_events ce
           ON ce.employee_id = e.id
          AND ce.organization_id = e.organization_id
          AND ce.timestamp::date = ra.date
         WHERE ${conditions.join(" AND ")}
         GROUP BY e.id, e.first_name, e.last_name, d.name, ra.date, ra.shift_id, s.start_time, s.end_time
       )
       SELECT employee_id,
              employee_name,
              department_name,
              COUNT(*)::int AS total_scheduled,
              COUNT(*) FILTER (
                WHERE first_in IS NOT NULL
                  AND first_in::time <= (start_time + INTERVAL '5 minutes')::time
                  AND (last_out IS NULL OR last_out::time >= (end_time - INTERVAL '5 minutes')::time)
              )::int AS on_time_count,
              COUNT(*) FILTER (
                WHERE first_in IS NOT NULL
                  AND first_in::time > (start_time + INTERVAL '5 minutes')::time
                  AND (last_out IS NULL OR last_out::time >= (end_time - INTERVAL '5 minutes')::time)
              )::int AS late_count,
              COUNT(*) FILTER (
                WHERE first_in IS NOT NULL
                  AND first_in::time <= (start_time + INTERVAL '5 minutes')::time
                  AND last_out IS NOT NULL
                  AND last_out::time < (end_time - INTERVAL '5 minutes')::time
              )::int AS early_departure_count,
              COUNT(*) FILTER (WHERE first_in IS NULL)::int AS absent_count,
              COUNT(*) FILTER (
                WHERE first_in IS NOT NULL
                  AND first_in::time > (start_time + INTERVAL '5 minutes')::time
                  AND last_out IS NOT NULL
                  AND last_out::time < (end_time - INTERVAL '5 minutes')::time
              )::int AS late_early_count,
              ROUND(
                100.0 * COUNT(*) FILTER (WHERE first_in IS NOT NULL) / NULLIF(COUNT(*), 0),
                2
              ) AS adherence_rate
       FROM daily
       GROUP BY employee_id, employee_name, department_name
       ORDER BY adherence_rate ASC NULLS LAST, employee_name`,
      params,
    );
    return result.rows;
  }

  private async attendanceSummary(
    organizationId: string,
    filters: ReportFilters,
  ) {
    const { params, employeeConditions } = this.employeeFilter(
      organizationId,
      filters,
      "e",
    );
    const conditions = [
      "e.organization_id = $1::uuid",
      "e.termination_date IS NULL",
      ...employeeConditions,
    ];

    const result = await this.databaseService.query(
      `WITH daily AS (
         SELECT e.id AS employee_id,
                concat_ws(' ', e.first_name, e.last_name) AS employee_name,
                d.name AS department_name,
                ra.date,
                ra.shift_id,
                s.start_time,
                MIN(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_in') AS first_in,
                MAX(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_out') AS last_out,
                lr.id AS leave_id
         FROM employees e
         LEFT JOIN departments d ON d.id = e.department_id
         JOIN roster_assignments ra
           ON ra.employee_id = e.id
          AND ra.organization_id = e.organization_id
          AND ra.date BETWEEN $2::date AND $3::date
         LEFT JOIN shifts s ON s.id = ra.shift_id
         LEFT JOIN clock_events ce
           ON ce.employee_id = e.id
          AND ce.organization_id = e.organization_id
          AND ce.timestamp::date = ra.date
         LEFT JOIN leave_records lr
           ON lr.employee_id = e.id
          AND lr.organization_id = e.organization_id
          AND lr.status = 'approved'
          AND ra.date BETWEEN lr.start_date AND lr.end_date
         WHERE ${conditions.join(" AND ")}
         GROUP BY e.id, e.first_name, e.last_name, d.name, ra.date, ra.shift_id, s.start_time, lr.id
       )
       SELECT employee_id,
              employee_name,
              department_name,
              COUNT(*)::int AS total_scheduled,
              COUNT(*) FILTER (WHERE first_in IS NOT NULL)::int AS present_count,
              COUNT(*) FILTER (
                WHERE first_in IS NOT NULL
                  AND start_time IS NOT NULL
                  AND first_in::time > (start_time + INTERVAL '5 minutes')::time
              )::int AS late_count,
              COUNT(*) FILTER (WHERE first_in IS NULL AND leave_id IS NULL)::int AS absent_count,
              COUNT(*) FILTER (WHERE leave_id IS NOT NULL)::int AS on_leave_count,
              ROUND(AVG(EXTRACT(EPOCH FROM (last_out - first_in)) / 3600) FILTER (WHERE first_in IS NOT NULL AND last_out IS NOT NULL), 2) AS avg_hours_worked,
              ROUND(100.0 * COUNT(*) FILTER (WHERE first_in IS NOT NULL OR leave_id IS NOT NULL) / NULLIF(COUNT(*), 0), 2) AS attendance_rate
       FROM daily
       GROUP BY employee_id, employee_name, department_name
       ORDER BY attendance_rate ASC NULLS LAST, employee_name`,
      params,
    );
    return result.rows;
  }

  private async attendanceDetail(
    organizationId: string,
    filters: ReportFilters,
  ) {
    const { params, employeeConditions } = this.employeeFilter(
      organizationId,
      filters,
      "e",
    );
    const conditions = [
      "e.organization_id = $1::uuid",
      "e.termination_date IS NULL",
      ...employeeConditions,
    ];

    const result = await this.databaseService.query(
      `SELECT e.id AS employee_id,
              concat_ws(' ', e.first_name, e.last_name) AS employee_name,
              d.name AS department_name,
              ra.date AS work_date,
              CASE
                WHEN lr.id IS NOT NULL THEN 'on_leave'
                WHEN MIN(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_in') IS NULL THEN 'absent'
                WHEN s.start_time IS NOT NULL
                 AND (MIN(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_in'))::time > (s.start_time + INTERVAL '5 minutes')::time THEN 'late'
                ELSE 'present'
              END AS status,
              s.name AS shift_name,
              MIN(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_in') AS clock_in,
              MAX(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_out') AS clock_out,
              ROUND(EXTRACT(EPOCH FROM (
                MAX(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_out') -
                MIN(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_in')
              )) / 3600, 2) AS hours_worked,
              CASE
                WHEN s.start_time IS NULL THEN NULL
                ELSE GREATEST(
                  FLOOR(EXTRACT(EPOCH FROM (
                    (MIN(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_in')) -
                    ((ra.date + s.start_time)::timestamptz)
                  )) / 60)::int,
                  0
                )
              END AS minutes_late
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
       JOIN roster_assignments ra
         ON ra.employee_id = e.id
        AND ra.organization_id = e.organization_id
        AND ra.date BETWEEN $2::date AND $3::date
       LEFT JOIN shifts s ON s.id = ra.shift_id
       LEFT JOIN clock_events ce
         ON ce.employee_id = e.id
        AND ce.organization_id = e.organization_id
        AND ce.timestamp::date = ra.date
       LEFT JOIN leave_records lr
         ON lr.employee_id = e.id
        AND lr.organization_id = e.organization_id
        AND lr.status = 'approved'
        AND ra.date BETWEEN lr.start_date AND lr.end_date
       WHERE ${conditions.join(" AND ")}
       GROUP BY e.id, e.first_name, e.last_name, d.name, ra.date, s.name, s.start_time, lr.id
       ORDER BY ra.date DESC, employee_name`,
      params,
    );
    return result.rows;
  }

  private employeeFilter(
    organizationId: string,
    filters: ReportFilters,
    employeeAlias: string,
  ) {
    const params: unknown[] = [
      organizationId,
      filters.startDate,
      filters.endDate,
    ];
    const employeeConditions: string[] = [];

    if (filters.departmentId) {
      params.push(filters.departmentId);
      employeeConditions.push(
        `${employeeAlias}.department_id = $${params.length}::uuid`,
      );
    }

    if (filters.employeeIds?.length) {
      params.push(filters.employeeIds);
      employeeConditions.push(
        `${employeeAlias}.id = ANY($${params.length}::uuid[])`,
      );
    }

    return { params, employeeConditions };
  }
}
