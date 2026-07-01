import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class RosterService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getWeek(organizationId: string, weekStart: string) {
    const result = await this.databaseService.query(
      `SELECT
         ra.id,
         ra.employee_id,
         concat_ws(' ', e.first_name, e.last_name) AS employee_name,
         e.department_id,
         d.name AS department_name,
         e.branch_id,
         ra.date,
         ra.shift_id,
         s.name AS shift_name,
         s.start_time,
         s.end_time,
         s.break_minutes,
         ra.notes,
         ra.acknowledgment_status,
         ra.conflict_reason,
         ra.conflict_flagged_at
       FROM roster_assignments ra
       JOIN employees e ON e.id = ra.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN shifts s ON s.id = ra.shift_id
       WHERE ra.organization_id = $1::uuid
         AND ra.date >= $2::date
         AND ra.date < $2::date + INTERVAL '7 days'
       ORDER BY e.first_name, e.last_name, ra.date`,
      [organizationId, weekStart],
    );
    return result.rows;
  }

  async getWeekStatus(organizationId: string, weekStart: string) {
    const result = await this.databaseService.query(
      `SELECT id, week_start, status, published_at, published_by, locked_at, locked_by, notes
       FROM roster_week_status
       WHERE organization_id = $1::uuid AND week_start = $2::date`,
      [organizationId, weekStart],
    );
    return (
      result.rows[0] ?? {
        id: null,
        week_start: weekStart,
        status: "draft",
        published_at: null,
        published_by: null,
        locked_at: null,
        locked_by: null,
        notes: null,
      }
    );
  }

  async upsertAssignment(
    organizationId: string,
    input: {
      employeeId: string;
      shiftId: string;
      assignmentDate: string;
      role?: string;
    },
  ) {
    const notes = input.role ? `Role: ${input.role}` : null;
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const employeeCheck = await client.query(
        `SELECT 1 FROM employees
         WHERE id = $1::uuid AND organization_id = $2::uuid AND termination_date IS NULL`,
        [input.employeeId, organizationId],
      );
      if (employeeCheck.rows.length === 0) {
        throw new BadRequestException("Employee not found or not active");
      }

      const shiftCheck = await client.query(
        `SELECT 1 FROM shifts
         WHERE id = $1::uuid AND organization_id = $2::uuid AND COALESCE(status, 'active') = 'active'`,
        [input.shiftId, organizationId],
      );
      if (shiftCheck.rows.length === 0) {
        throw new BadRequestException("Shift not found or inactive");
      }

      const result = await client.query(
        `INSERT INTO roster_assignments (
           organization_id, employee_id, date, shift_id, notes, acknowledgment_status
         )
         VALUES ($1::uuid, $2::uuid, $3::date, $4::uuid, $5, 'pending')
         ON CONFLICT (employee_id, date) DO UPDATE
         SET shift_id = EXCLUDED.shift_id,
             notes = EXCLUDED.notes,
             acknowledgment_status = 'pending',
             acknowledged_at = NULL,
             acknowledged_by = NULL,
             conflict_reason = NULL,
             conflict_flagged_at = NULL,
             conflict_resolved_at = NULL,
             conflict_resolved_by = NULL,
             updated_at = now()
         RETURNING *`,
        [
          organizationId,
          input.employeeId,
          input.assignmentDate,
          input.shiftId,
          notes,
        ],
      );

      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteAssignment(organizationId: string, assignmentId: string) {
    const result = await this.databaseService.query(
      `DELETE FROM roster_assignments
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING id`,
      [assignmentId, organizationId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Assignment not found");
    }
    return { deleted: true, id: result.rows[0].id };
  }

  async copyWeek(
    organizationId: string,
    sourceWeekStart: string,
    targetWeekStart: string,
  ) {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const source = await client.query(
        `SELECT employee_id, date, shift_id, notes
         FROM roster_assignments
         WHERE organization_id = $1::uuid
           AND date >= $2::date
           AND date < $2::date + INTERVAL '7 days'`,
        [organizationId, sourceWeekStart],
      );

      const dayOffset =
        (new Date(targetWeekStart).getTime() -
          new Date(sourceWeekStart).getTime()) /
        (1000 * 60 * 60 * 24);

      let copied = 0;
      for (const row of source.rows) {
        const targetDate = new Date(row.date);
        targetDate.setDate(targetDate.getDate() + dayOffset);
        const targetDateStr = targetDate.toISOString().split("T")[0];

        await client.query(
          `INSERT INTO roster_assignments (
             organization_id, employee_id, date, shift_id, notes, acknowledgment_status
           )
           VALUES ($1::uuid, $2::uuid, $3::date, $4::uuid, $5, 'pending')
           ON CONFLICT (employee_id, date) DO UPDATE
           SET shift_id = EXCLUDED.shift_id,
               notes = EXCLUDED.notes,
               acknowledgment_status = 'pending',
               updated_at = now()`,
          [
            organizationId,
            row.employee_id,
            targetDateStr,
            row.shift_id,
            row.notes,
          ],
        );
        copied++;
      }

      await client.query(
        `INSERT INTO roster_week_status (organization_id, week_start, status)
         VALUES ($1::uuid, $2::date, 'draft')
         ON CONFLICT (organization_id, week_start) DO UPDATE
         SET status = 'draft', updated_at = now()`,
        [organizationId, targetWeekStart],
      );

      await client.query("COMMIT");
      return { copied };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async publishWeek(
    organizationId: string,
    weekStart: string,
    userId?: string,
  ) {
    const result = await this.databaseService.query(
      `INSERT INTO roster_week_status (
         organization_id, week_start, status, published_at, published_by, updated_by
       )
       VALUES ($1::uuid, $2::date, 'published', now(), $3::uuid, $3::uuid)
       ON CONFLICT (organization_id, week_start) DO UPDATE
       SET status = 'published',
           published_at = COALESCE(roster_week_status.published_at, now()),
           published_by = COALESCE(roster_week_status.published_by, EXCLUDED.published_by),
           updated_by = EXCLUDED.updated_by,
           updated_at = now()
       RETURNING *`,
      [organizationId, weekStart, userId ?? null],
    );
    return result.rows[0];
  }

  async lockWeek(organizationId: string, weekStart: string, userId?: string) {
    const result = await this.databaseService.query(
      `INSERT INTO roster_week_status (
         organization_id, week_start, status, locked_at, locked_by, updated_by
       )
       VALUES ($1::uuid, $2::date, 'locked', now(), $3::uuid, $3::uuid)
       ON CONFLICT (organization_id, week_start) DO UPDATE
       SET status = 'locked',
           locked_at = COALESCE(roster_week_status.locked_at, now()),
           locked_by = COALESCE(roster_week_status.locked_by, EXCLUDED.locked_by),
           updated_by = EXCLUDED.updated_by,
           updated_at = now()
       RETURNING *`,
      [organizationId, weekStart, userId ?? null],
    );
    return result.rows[0];
  }

  async getNoShows(organizationId: string, date?: string) {
    const targetDate = date ?? new Date().toISOString().split("T")[0];
    const result = await this.databaseService.query(
      `WITH grace AS (
         SELECT COALESCE(late_threshold_minutes, 5) AS minutes
         FROM organizations
         WHERE id = $1::uuid
       )
       SELECT
         e.id AS employee_id,
         concat_ws(' ', e.first_name, e.last_name) AS employee_name,
         d.name AS department_name,
         s.name AS shift_name,
         s.start_time AS scheduled_start,
         FLOOR(EXTRACT(EPOCH FROM (now() - ((targetDate.date + s.start_time)::TIMESTAMPTZ))) / 60)::INT AS minutes_late
       FROM (SELECT $2::date AS date) AS targetDate
       CROSS JOIN grace
       JOIN employees e ON e.organization_id = $1::uuid
       JOIN roster_assignments ra ON ra.employee_id = e.id AND ra.date = targetDate.date
       JOIN shifts s ON s.id = ra.shift_id
       LEFT JOIN departments d ON d.id = e.department_id
       WHERE e.termination_date IS NULL
         AND now() > ((targetDate.date + s.start_time)::TIMESTAMPTZ + make_interval(mins => grace.minutes))
         AND NOT EXISTS (
           SELECT 1
           FROM clock_events ce
           WHERE ce.organization_id = $1::uuid
             AND ce.employee_id = e.id
             AND ce.event_type = 'clock_in'
             AND ce.timestamp::DATE = targetDate.date
         )
       ORDER BY minutes_late DESC, employee_name`,
      [organizationId, targetDate],
    );
    return result.rows;
  }

  async getAdherence(organizationId: string, weekStart: string) {
    const result = await this.databaseService.query(
      `WITH week_days AS (
         SELECT ($2::date + (i || ' days')::interval)::date AS day
         FROM generate_series(0, 6) AS i
       ),
       active_employees AS (
         SELECT
           e.id,
           concat_ws(' ', e.first_name, e.last_name) AS name,
           e.department_id,
           d.name AS dept_name
         FROM employees e
         LEFT JOIN departments d ON d.id = e.department_id
         WHERE e.organization_id = $1::uuid
           AND e.termination_date IS NULL
       ),
       assignments AS (
         SELECT
           ae.id AS employee_id,
           ae.name AS employee_name,
           ae.dept_name AS department_name,
           wd.day AS assignment_date,
           ra.shift_id,
           s.name AS shift_name,
           s.start_time AS scheduled_start,
           s.end_time AS scheduled_end
         FROM active_employees ae
         CROSS JOIN week_days wd
         LEFT JOIN roster_assignments ra ON ra.employee_id = ae.id AND ra.date = wd.day
         LEFT JOIN shifts s ON s.id = ra.shift_id
       ),
       daily_clocks AS (
         SELECT
           ce.employee_id,
           ce.timestamp::date AS clock_date,
           MIN(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_in') AS first_in,
           MAX(ce.timestamp) FILTER (WHERE ce.event_type = 'clock_out') AS last_out
         FROM clock_events ce
         WHERE ce.organization_id = $1::uuid
           AND ce.timestamp >= $2::timestamptz
           AND ce.timestamp < ($2::date + INTERVAL '7 days')::timestamptz
         GROUP BY ce.employee_id, ce.timestamp::date
       )
       SELECT
         a.employee_id,
         a.employee_name,
         a.department_name,
         a.assignment_date AS date,
         a.shift_name,
         a.scheduled_start,
         a.scheduled_end,
         dc.first_in AS actual_clock_in,
         dc.last_out AS actual_clock_out,
         CASE
           WHEN a.shift_id IS NULL THEN 'day_off'
           WHEN dc.first_in IS NULL THEN 'absent'
           WHEN dc.first_in::time > (a.scheduled_start + INTERVAL '5 minutes')::time
            AND dc.last_out IS NOT NULL
            AND dc.last_out::time < (a.scheduled_end - INTERVAL '5 minutes')::time THEN 'late_early'
           WHEN dc.first_in::time > (a.scheduled_start + INTERVAL '5 minutes')::time THEN 'late'
           WHEN dc.last_out IS NOT NULL
            AND dc.last_out::time < (a.scheduled_end - INTERVAL '5 minutes')::time THEN 'early_departure'
           ELSE 'on_time'
         END AS status
       FROM assignments a
       LEFT JOIN daily_clocks dc ON dc.employee_id = a.employee_id AND dc.clock_date = a.assignment_date
       ORDER BY a.employee_name, a.assignment_date`,
      [organizationId, weekStart],
    );
    return result.rows;
  }

  async previewConflicts(organizationId: string, weekStart: string) {
    const result = await this.databaseService.query(
      `WITH week_days AS (
         SELECT ($2::date + (i || ' days')::interval)::date AS day
         FROM generate_series(0, 6) AS i
       )
       SELECT
         ra.id AS assignment_id,
         ra.employee_id,
         concat_ws(' ', e.first_name, e.last_name) AS employee_name,
         ra.date AS conflict_date,
         'double_booked'::text AS conflict_type,
         'high'::text AS severity,
         'Employee has multiple roster assignments on the same date'::text AS message
       FROM roster_assignments ra
       JOIN employees e ON e.id = ra.employee_id
       JOIN week_days wd ON wd.day = ra.date
       WHERE ra.organization_id = $1::uuid
         AND EXISTS (
           SELECT 1
           FROM roster_assignments ra2
           WHERE ra2.organization_id = ra.organization_id
             AND ra2.employee_id = ra.employee_id
             AND ra2.date = ra.date
             AND ra2.id <> ra.id
         )

       UNION ALL

       SELECT
         ra.id AS assignment_id,
         ra.employee_id,
         concat_ws(' ', e.first_name, e.last_name) AS employee_name,
         ra.date AS conflict_date,
         'leave_overlap'::text AS conflict_type,
         'high'::text AS severity,
         ('Employee has approved ' || lr.leave_type || ' leave')::text AS message
       FROM roster_assignments ra
       JOIN employees e ON e.id = ra.employee_id
       JOIN week_days wd ON wd.day = ra.date
       JOIN leave_records lr ON lr.employee_id = ra.employee_id
         AND lr.organization_id = $1::uuid
         AND lr.status = 'approved'
         AND wd.day BETWEEN lr.start_date AND lr.end_date
       WHERE ra.organization_id = $1::uuid

       UNION ALL

       SELECT
         ra.id AS assignment_id,
         ra.employee_id,
         concat_ws(' ', e.first_name, e.last_name) AS employee_name,
         ra.date AS conflict_date,
         'availability_overlap'::text AS conflict_type,
         'medium'::text AS severity,
         COALESCE('Unavailable: ' || ea.reason, 'Employee is unavailable during shift')::text AS message
       FROM roster_assignments ra
       JOIN employees e ON e.id = ra.employee_id
       JOIN week_days wd ON wd.day = ra.date
       JOIN employee_availability ea ON ea.employee_id = ra.employee_id
         AND ea.organization_id = $1::uuid
         AND ea.day_of_week = EXTRACT(DOW FROM wd.day)::INT
         AND ea.is_available = false
       WHERE ra.organization_id = $1::uuid

       ORDER BY conflict_date, employee_name`,
      [organizationId, weekStart],
    );
    return result.rows;
  }

  async autoFill(organizationId: string, weekStart: string) {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const shiftResult = await client.query(
        `SELECT id FROM shifts
         WHERE organization_id = $1::uuid AND COALESCE(status, 'active') = 'active'
         ORDER BY name LIMIT 1`,
        [organizationId],
      );
      const defaultShiftId = shiftResult.rows[0]?.id;
      if (!defaultShiftId) {
        throw new ConflictException("No active shift found for auto-fill");
      }

      const result = await client.query(
        `WITH week_days AS (
           SELECT ($2::date + (i || ' days')::interval)::date AS day
           FROM generate_series(0, 6) AS i
         ),
         active_employees AS (
           SELECT id FROM employees
           WHERE organization_id = $1::uuid
             AND termination_date IS NULL
             AND COALESCE(employment_status, 'active') = 'active'
         ),
         missing_slots AS (
           SELECT ae.id AS employee_id, wd.day
           FROM active_employees ae
           CROSS JOIN week_days wd
           LEFT JOIN roster_assignments ra
             ON ra.employee_id = ae.id
             AND ra.date = wd.day
             AND ra.organization_id = $1::uuid
           WHERE ra.id IS NULL
             AND EXTRACT(DOW FROM wd.day) BETWEEN 1 AND 5
         )
         INSERT INTO roster_assignments (
           organization_id, employee_id, date, shift_id, notes, acknowledgment_status
         )
         SELECT
           $1::uuid,
           ms.employee_id,
           ms.day,
           COALESCE(es.shift_id, $3::uuid),
           'auto-filled'::text,
           'pending'
         FROM missing_slots ms
         LEFT JOIN employee_shifts es
           ON es.employee_id = ms.employee_id
           AND es.effective_from <= ms.day
           AND (es.effective_to IS NULL OR es.effective_to >= ms.day)
           AND es.days_of_week @> ARRAY[EXTRACT(DOW FROM ms.day)::INT]
         ORDER BY ms.employee_id, ms.day
         ON CONFLICT (employee_id, date) DO NOTHING
         RETURNING *`,
        [organizationId, weekStart, defaultShiftId],
      );

      await client.query("COMMIT");
      return { created: result.rows.length, assignments: result.rows };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
