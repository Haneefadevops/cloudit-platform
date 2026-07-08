import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import pg from "pg";

export interface UnifiedCalendarEvent {
  id: string;
  title: string;
  type: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  description?: string;
  location?: string;
  meetingUrl?: string;
  status?: string;
  source: string;
  raw: any;
}

export interface CalendarEventInput {
  title: string;
  description?: string | null;
  event_date: string;
  start_time?: string | null;
  end_time?: string | null;
  all_day?: boolean;
  event_type?: string;
  event_scope?: string;
  branch_id?: string | null;
  department_id?: string | null;
  secondary_branch_id?: string | null;
  secondary_department_id?: string | null;
  team_member_ids?: string[];
  meeting_provider?: string | null;
  meeting_url?: string | null;
  requires_rsvp?: boolean;
  reminder_minutes?: number;
  location?: string | null;
  status?: string;
}

export interface HolidayInput {
  name: string;
  date: string;
  type: "public" | "company" | "restricted";
  recurring?: boolean;
  description?: string | null;
  branch_id?: string | null;
}

@Injectable()
export class CalendarEventsService {
  private readonly logger = new Logger(CalendarEventsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT id, title, event_date, start_time, end_time, event_type, event_scope, status
       FROM calendar_events
       WHERE organization_id = $1::uuid
       ORDER BY event_date DESC, start_time ASC
       LIMIT 500`,
      [organizationId],
    );
    return result.rows;
  }

  async findUnified(
    organizationId: string,
    actorUserId: string,
    start: string,
    end: string,
  ): Promise<UnifiedCalendarEvent[]> {
    let calendarRows: any[] = [];
    let leaveRows: any[] = [];
    let holidayRows: any[] = [];
    let trainingRows: any[] = [];
    let birthdayRows: any[] = [];

    try {
      [calendarRows, leaveRows, holidayRows, trainingRows, birthdayRows] =
        await Promise.all([
          this.queryCalendarEvents(actorUserId, start, end),
          this.queryLeaveEvents(organizationId, start, end),
          this.queryHolidays(organizationId, start, end),
          this.queryTrainingEvents(organizationId, start, end),
          this.queryBirthdays(actorUserId, organizationId, start, end),
        ]);
    } catch (error) {
      this.logger.error(
        `findUnified failed for org=${organizationId} user=${actorUserId} range=${start}:${end}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }

    const calendar = calendarRows.map((e: any): UnifiedCalendarEvent => {
      const typeMap: Record<string, string> = {
        meeting: "meeting",
        training: "training",
        announcement: "company_event",
        other: "company_event",
      };
      const startAt = e.start_time
        ? new Date(e.start_time).toISOString()
        : e.event_date;
      const endAt = e.end_time
        ? new Date(e.end_time).toISOString()
        : e.event_date;
      return {
        id: e.id,
        title: e.title,
        type: typeMap[e.event_type] || "company_event",
        startAt,
        endAt,
        allDay: e.all_day,
        description: e.description,
        meetingUrl: e.meeting_url,
        status: e.status || "confirmed",
        source: "calendar_events",
        raw: e,
      };
    });

    const leaves = leaveRows.map((r: any): UnifiedCalendarEvent => ({
      id: `leave-${r.id}`,
      title: `${r.employee?.first_name || ""} ${r.employee?.last_name || ""} — ${r.leave_type}`,
      type: "leave",
      startAt: r.start_date,
      endAt: r.end_date,
      allDay: true,
      source: "leave_records",
      raw: r,
    }));

    const holidays = holidayRows.map((h: any): UnifiedCalendarEvent => ({
      id: `holiday-${h.id}`,
      title: h.name,
      type: "holiday",
      startAt: h.date,
      endAt: h.date,
      allDay: true,
      description: h.description,
      source: "holidays",
      raw: h,
    }));

    const trainings = trainingRows.map((t: any): UnifiedCalendarEvent => ({
      id: t.id,
      title: t.title,
      type: "training",
      startAt: t.start_date,
      endAt: t.end_date,
      allDay: true,
      description: t.description,
      source: "training",
      raw: t,
    }));

    const birthdays = birthdayRows.map((b: any): UnifiedCalendarEvent => ({
      id: `birthday-${b.employee_id}`,
      title: `${b.employee_name}'s Birthday`,
      type: "birthday",
      startAt: b.next_occurrence,
      endAt: b.next_occurrence,
      allDay: true,
      source: "birthdays",
      raw: b,
    }));

    const all = [...calendar, ...leaves, ...holidays, ...trainings, ...birthdays];
    all.sort((a, b) => {
      const ad = a.startAt ? new Date(a.startAt).getTime() : 0;
      const bd = b.startAt ? new Date(b.startAt).getTime() : 0;
      return ad - bd;
    });
    return all;
  }

  async findEmployeeEvents(
    employeeId: string,
    actorUserId: string,
    start: string,
    end: string,
  ) {
    return this.withUser(actorUserId, async (client) => {
      const result = await client.query(
        `SELECT * FROM get_events_for_employee($1::uuid, $2::date, $3::date)`,
        [employeeId, start, end],
      );
      return result.rows;
    });
  }

  async findUpcoming(organizationId: string, days = 30) {
    const today = new Date().toISOString().split("T")[0];
    const future = new Date();
    future.setDate(future.getDate() + days);
    const futureStr = future.toISOString().split("T")[0];

    const [holidaysRes, eventsRes] = await Promise.all([
      this.databaseService.query(
        `SELECT id, name, date, type FROM holidays
         WHERE organization_id = $1::uuid AND date >= $2::date AND date <= $3::date
         ORDER BY date`,
        [organizationId, today, futureStr],
      ),
      this.databaseService.query(
        `SELECT id, title, event_date, event_type FROM calendar_events
         WHERE organization_id = $1::uuid AND event_date >= $2::date AND event_date <= $3::date
         ORDER BY event_date`,
        [organizationId, today, futureStr],
      ),
    ]);

    const merged: any[] = [];
    for (const h of holidaysRes.rows) {
      merged.push({
        id: `h-${h.id}`,
        title: h.name,
        date: h.date,
        type: h.type ?? "public",
        source: "holiday",
      });
    }
    for (const e of eventsRes.rows) {
      merged.push({
        id: `e-${e.id}`,
        title: e.title,
        date: e.event_date,
        type: e.event_type ?? "company",
        source: "event",
      });
    }
    merged.sort((a, b) => a.date.localeCompare(b.date));
    return merged.slice(0, 5);
  }

  async findUpcomingBirthdays(
    organizationId: string,
    actorUserId: string,
    limit: number,
  ) {
    try {
      return await this.withUser(actorUserId, async (client) => {
        const debug = await client.query(
          `SELECT current_setting('touchorbit.current_user_id', true) AS session_user_id,
                  (SELECT organization_id FROM users WHERE id = current_setting('touchorbit.current_user_id', true)::uuid) AS db_org_id`,
        );
        this.logger.log(
          `findUpcomingBirthdays debug org=${organizationId} user=${actorUserId} session_user=${debug.rows[0]?.session_user_id} db_org=${debug.rows[0]?.db_org_id}`,
        );

        const result = await client.query(
          `SELECT * FROM get_upcoming_birthdays($1::uuid, $2::int)`,
          [organizationId, limit],
        );
        return result.rows;
      });
    } catch (error) {
      this.logger.error(
        `findUpcomingBirthdays failed for org=${organizationId} user=${actorUserId} limit=${limit}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async findHub(organizationId: string, start: string, end: string) {
    // Stub: returns empty arrays so the UI does not error.
    // A full implementation will aggregate conflicts/requests/coverage later.
    return {
      conflicts: [],
      requests: { leave: [], swaps: [], reschedules: [] },
      coverage: {
        rate: 0,
        active_employees: 0,
        assigned_shift_days: 0,
        potential_shift_days: 0,
      },
    };
  }

  async findAnalytics(
    organizationId: string,
    actorUserId: string,
    start: string,
    end: string,
  ): Promise<Record<string, unknown>> {
    return this.withUser(actorUserId, async (client) => {
      const result = await client.query(
        `SELECT get_calendar_analytics($1::uuid, $2::date, $3::date) AS data`,
        [organizationId, start, end],
      );
      return (result.rows[0]?.data as Record<string, unknown>) ?? {};
    });
  }

  async createEvent(actorUserId: string, input: CalendarEventInput) {
    return this.withUser(actorUserId, async (client) => {
      const startAt = this.buildTimestamp(
        input.event_date,
        input.all_day ? null : input.start_time,
        true,
      );
      const endAt = this.buildTimestamp(
        input.event_date,
        input.all_day ? null : input.end_time,
        false,
      );
      const result = await client.query(
        `SELECT create_calendar_event(
          $1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7,
          $8::uuid, $9::uuid, $10::uuid, $11::uuid,
          $12::uuid[], $13, $14, $15, $16, $17, $18
        ) AS id`,
        [
          input.title,
          input.description ?? null,
          input.event_type ?? "meeting",
          input.event_scope ?? "organization",
          startAt,
          endAt,
          input.all_day ?? false,
          input.branch_id ?? null,
          input.department_id ?? null,
          input.secondary_branch_id ?? null,
          input.secondary_department_id ?? null,
          input.team_member_ids ?? [],
          input.meeting_provider ?? null,
          input.meeting_url ?? null,
          input.requires_rsvp ?? false,
          input.reminder_minutes ?? 30,
          input.location ?? null,
        ],
      );
      return { id: result.rows[0].id };
    });
  }

  async updateEvent(
    eventId: string,
    actorUserId: string,
    input: Partial<CalendarEventInput>,
  ) {
    return this.withUser(actorUserId, async (client) => {
      const existing = await client.query(
        `SELECT event_date, start_time, end_time, all_day, event_scope FROM calendar_events WHERE id = $1::uuid`,
        [eventId],
      );
      if (existing.rows.length === 0) {
        throw new NotFoundException("Calendar event not found");
      }
      const cur = existing.rows[0];
      const startAt = this.buildTimestamp(
        input.event_date ?? cur.event_date,
        input.all_day
          ? null
          : input.start_time ??
              (cur.all_day ? null : this.timeFromDate(cur.start_time)),
        true,
      );
      const endAt = this.buildTimestamp(
        input.event_date ?? cur.event_date,
        input.all_day
          ? null
          : input.end_time ??
              (cur.all_day ? null : this.timeFromDate(cur.end_time)),
        false,
      );

      const result = await client.query(
        `SELECT update_calendar_event(
          $1::uuid, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8,
          $9::uuid, $10::uuid, $11::uuid, $12::uuid,
          $13::uuid[], $14, $15, $16, $17, $18, $19, $20
        ) AS id`,
        [
          eventId,
          input.title ?? null,
          input.description ?? null,
          input.event_type ?? null,
          input.event_scope ?? null,
          startAt,
          endAt,
          input.all_day ?? null,
          input.branch_id ?? null,
          input.department_id ?? null,
          input.secondary_branch_id ?? null,
          input.secondary_department_id ?? null,
          input.team_member_ids ?? null,
          input.meeting_provider ?? null,
          input.meeting_url ?? null,
          null,
          input.requires_rsvp ?? null,
          input.reminder_minutes ?? null,
          null,
          input.status ?? null,
          input.location ?? null,
        ],
      );
      return { id: result.rows[0].id };
    });
  }

  async deleteEvent(eventId: string, actorUserId: string) {
    return this.withUser(actorUserId, async (client) => {
      const result = await client.query(
        `DELETE FROM calendar_events WHERE id = $1::uuid RETURNING id`,
        [eventId],
      );
      if (result.rows.length === 0) {
        throw new NotFoundException("Calendar event not found");
      }
      return { id: result.rows[0].id };
    });
  }

  async duplicateEvent(eventId: string, actorUserId: string) {
    return this.withUser(actorUserId, async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM calendar_events WHERE id = $1::uuid`,
        [eventId],
      );
      if (rows.length === 0) {
        throw new NotFoundException("Calendar event not found");
      }
      const e = rows[0];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const newDate = tomorrow.toISOString().split("T")[0];
      const startTime = e.start_time ? String(e.start_time).slice(0, 5) : null;
      const endTime = e.end_time ? String(e.end_time).slice(0, 5) : null;
      const startAt = this.buildTimestamp(newDate, startTime, true);
      const endAt = this.buildTimestamp(newDate, endTime, false);

      const result = await client.query(
        `SELECT create_calendar_event(
          $1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7,
          $8::uuid, $9::uuid, $10::uuid, $11::uuid,
          $12::uuid[], $13, $14, $15, $16, $17, $18
        ) AS id`,
        [
          `${e.title} (Copy)`,
          e.description,
          e.event_type,
          e.event_scope,
          startAt,
          endAt,
          e.all_day,
          e.branch_id,
          e.department_id,
          e.secondary_branch_id,
          e.secondary_department_id,
          e.team_member_ids ?? [],
          e.meeting_provider,
          e.meeting_url,
          false,
          30,
          e.location,
        ],
      );
      return { id: result.rows[0].id };
    });
  }

  async rescheduleEvent(
    eventId: string,
    actorUserId: string,
    reason?: string,
  ) {
    return this.withUser(actorUserId, async (client) => {
      const result = await client.query(
        `UPDATE calendar_events
         SET status = 'rescheduled', reschedule_reason = $2, updated_at = now()
         WHERE id = $1::uuid
         RETURNING id`,
        [eventId, reason ?? null],
      );
      if (result.rows.length === 0) {
        throw new NotFoundException("Calendar event not found");
      }
      return { id: result.rows[0].id };
    });
  }

  // Holidays
  async findHolidays(organizationId: string, start?: string, end?: string) {
    const conditions = ["organization_id = $1::uuid"];
    const values: unknown[] = [organizationId];
    let idx = 1;
    if (start) {
      idx += 1;
      conditions.push(`date >= $${idx}::date`);
      values.push(start);
    }
    if (end) {
      idx += 1;
      conditions.push(`date <= $${idx}::date`);
      values.push(end);
    }
    const result = await this.databaseService.query(
      `SELECT * FROM holidays WHERE ${conditions.join(" AND ")} ORDER BY date`,
      values,
    );
    return result.rows;
  }

  async createHoliday(organizationId: string, input: HolidayInput) {
    const result = await this.databaseService.query(
      `INSERT INTO holidays (organization_id, name, date, type, recurring, description, branch_id)
       VALUES ($1::uuid, $2, $3::date, $4, $5, $6, $7::uuid)
       RETURNING *`,
      [
        organizationId,
        input.name,
        input.date,
        input.type,
        input.recurring ?? false,
        input.description ?? null,
        input.branch_id ?? null,
      ],
    );
    return result.rows[0];
  }

  async updateHoliday(
    organizationId: string,
    id: string,
    input: Partial<HolidayInput>,
  ) {
    const result = await this.databaseService.query(
      `UPDATE holidays
       SET name = COALESCE($3, name),
           date = COALESCE($4::date, date),
           type = COALESCE($5, type),
           recurring = COALESCE($6, recurring),
           description = COALESCE($7, description),
           branch_id = COALESCE($8::uuid, branch_id),
           updated_at = now()
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      [
        id,
        organizationId,
        input.name ?? null,
        input.date ?? null,
        input.type ?? null,
        input.recurring ?? null,
        input.description ?? null,
        input.branch_id ?? null,
      ],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Holiday not found");
    }
    return result.rows[0];
  }

  async deleteHoliday(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `DELETE FROM holidays WHERE id = $1::uuid AND organization_id = $2::uuid RETURNING id`,
      [id, organizationId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Holiday not found");
    }
    return { id: result.rows[0].id };
  }

  async importSriLankanHolidays2026(
    organizationId: string,
    actorUserId: string,
  ) {
    return this.withUser(actorUserId, async (client) => {
      const result = await client.query(
        `SELECT insert_sri_lankan_holidays_2026($1::uuid) AS count`,
        [organizationId],
      );
      return { count: result.rows[0].count };
    });
  }

  private async queryCalendarEvents(
    actorUserId: string,
    start: string,
    end: string,
  ) {
    return this.withUser(actorUserId, async (client) => {
      const result = await client.query(
        `SELECT * FROM get_calendar_events($1::date, $2::date)`,
        [start, end],
      );
      return result.rows;
    });
  }

  private async queryLeaveEvents(
    organizationId: string,
    start: string,
    end: string,
  ) {
    const result = await this.databaseService.query(
      `SELECT lr.id, lr.start_date, lr.end_date, lr.leave_type, lr.status,
              jsonb_build_object('first_name', e.first_name, 'last_name', e.last_name, 'department', e.department) AS employee
       FROM leave_records lr
       JOIN employees e ON e.id = lr.employee_id
       WHERE lr.organization_id = $1::uuid
         AND lr.status = 'approved'
         AND lr.start_date <= $3::date
         AND lr.end_date >= $2::date
       ORDER BY lr.start_date`,
      [organizationId, start, end],
    );
    return result.rows;
  }

  private async queryHolidays(
    organizationId: string,
    start: string,
    end: string,
  ) {
    const result = await this.databaseService.query(
      `SELECT * FROM holidays
       WHERE organization_id = $1::uuid AND date >= $2::date AND date <= $3::date
       ORDER BY date`,
      [organizationId, start, end],
    );
    return result.rows;
  }

  private async queryTrainingEvents(
    organizationId: string,
    start: string,
    end: string,
  ) {
    const [selfRes, assignedRes] = await Promise.all([
      this.databaseService.query(
        `SELECT et.id, et.employee_id, et.training_name AS title, et.description,
                et.start_date, et.end_date,
                jsonb_build_object('first_name', e.first_name, 'last_name', e.last_name) AS employee
         FROM employee_training et
         JOIN employees e ON e.id = et.employee_id
         WHERE et.organization_id = $1::uuid
           AND et.start_date <= $3::date
           AND et.end_date >= $2::date`,
        [organizationId, start, end],
      ),
      this.databaseService.query(
        `SELECT ta.id, ta.employee_id, ta.start_date, ta.end_date,
                tp.title, tp.description,
                jsonb_build_object('first_name', e.first_name, 'last_name', e.last_name) AS employee
         FROM training_assignments ta
         JOIN training_programs tp ON tp.id = ta.program_id
         JOIN employees e ON e.id = ta.employee_id
         WHERE ta.organization_id = $1::uuid
           AND ta.status <> 'cancelled'
           AND ta.start_date <= $3::date
           AND ta.end_date >= $2::date`,
        [organizationId, start, end],
      ),
    ]);
    const self = selfRes.rows.map((t: any) => ({
      ...t,
      title: `${t.title} — ${t.employee?.first_name || ""} ${t.employee?.last_name || ""}`,
    }));
    const assigned = assignedRes.rows.map((t: any) => ({
      ...t,
      title: `${t.title} — ${t.employee?.first_name || ""} ${t.employee?.last_name || ""}`,
    }));
    return [...self, ...assigned];
  }

  private async queryBirthdays(
    actorUserId: string,
    organizationId: string,
    start: string,
    end: string,
  ) {
    const rows = await this.findUpcomingBirthdays(organizationId, actorUserId, 100);
    return rows.filter((b: any) => {
      const d = new Date(b.next_occurrence).toISOString().split("T")[0];
      return d >= start && d <= end;
    });
  }

  private buildTimestamp(
    dateStr: string,
    timeStr: string | null | undefined,
    start: boolean,
  ): string {
    if (!timeStr) {
      return start
        ? `${dateStr}T00:00:00Z`
        : `${dateStr}T23:59:59Z`;
    }
    const t = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
    return `${dateStr}T${t}Z`;
  }

  private timeFromDate(value: any): string | null {
    if (!value) return null;
    const s = value instanceof Date ? value.toISOString() : String(value);
    return s.slice(11, 16);
  }

  private async withUser<T>(
    userId: string,
    fn: (client: pg.PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `SELECT set_config('touchorbit.current_user_id', $1, true)`,
        [userId],
      );
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      if (error && typeof error === "object" && "code" in error) {
        const pgError = error as any;
        if (pgError.code === "P0001") {
          throw new BadRequestException(pgError.message || "Database error");
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }
}
