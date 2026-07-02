import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

export interface KioskClockInput {
  employeeId: string;
  latitude?: number;
  longitude?: number;
  locationVerified?: boolean;
  selfieUrl?: string | null;
  deviceInfo?: string | Record<string, unknown> | null;
  notes?: string | Record<string, unknown> | null;
  gpsAccuracy?: number | null;
  deviceFingerprint?: Record<string, unknown> | null;
  timezoneOffset?: number | null;
  workType?: "office" | "wfh" | "field";
  branchId?: string | null;
}

@Injectable()
export class KioskService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT ce.*,
              COALESCE(e.first_name || ' ' || e.last_name, '') AS employee_name,
              e.employee_number
       FROM clock_events ce
       LEFT JOIN employees e
         ON e.id = ce.employee_id AND e.organization_id = ce.organization_id
       WHERE ce.organization_id = $1::uuid
         AND ce.method = 'tablet_kiosk'
       ORDER BY ce."timestamp" DESC
       LIMIT 100`,
      [organizationId],
    );

    return result.rows;
  }

  async clockIn(organizationId: string, input: KioskClockInput) {
    return this.createClockEvent(organizationId, "clock_in", input);
  }

  async clockOut(organizationId: string, input: KioskClockInput) {
    return this.createClockEvent(organizationId, "clock_out", input);
  }

  async status(organizationId: string, employeeId?: string) {
    if (employeeId) {
      return this.employeeStatus(organizationId, employeeId);
    }

    const todayResult = await this.databaseService.query(
      `SELECT
         COUNT(DISTINCT employee_id) FILTER (WHERE event_type = 'clock_in')::int AS clocked_in_today,
         COUNT(*) FILTER (WHERE event_type = 'clock_in')::int AS clock_in_events,
         COUNT(*) FILTER (WHERE event_type = 'clock_out')::int AS clock_out_events
       FROM clock_events
       WHERE organization_id = $1::uuid
         AND method = 'tablet_kiosk'
         AND "timestamp"::date = CURRENT_DATE`,
      [organizationId],
    );

    const recentResult = await this.databaseService.query(
      `SELECT ce.id, ce.employee_id, ce.event_type, ce."timestamp",
              ce.latitude, ce.longitude, ce.location_verified,
              COALESCE(e.first_name || ' ' || e.last_name, '') AS employee_name,
              e.employee_number
       FROM clock_events ce
       LEFT JOIN employees e
         ON e.id = ce.employee_id AND e.organization_id = ce.organization_id
       WHERE ce.organization_id = $1::uuid
         AND ce.method = 'tablet_kiosk'
       ORDER BY ce."timestamp" DESC
       LIMIT 20`,
      [organizationId],
    );

    const currentlyClockedIn = await this.countCurrentlyClockedIn(
      organizationId,
    );

    return {
      date: new Date().toISOString().slice(0, 10),
      clockedInToday: todayResult.rows[0]?.clocked_in_today ?? 0,
      clockInEvents: todayResult.rows[0]?.clock_in_events ?? 0,
      clockOutEvents: todayResult.rows[0]?.clock_out_events ?? 0,
      currentlyClockedIn,
      recentEvents: recentResult.rows,
    };
  }

  private async createClockEvent(
    organizationId: string,
    eventType: "clock_in" | "clock_out",
    input: KioskClockInput,
  ) {
    const employee = await this.findEmployee(organizationId, input.employeeId);
    const result = await this.databaseService.query(
      `INSERT INTO clock_events (
         organization_id, employee_id, event_type, latitude, longitude,
         location_verified, selfie_url, device_info, method, notes,
         gps_accuracy, device_fingerprint, timezone_offset, work_type, branch_id
       )
       VALUES (
         $1::uuid, $2::uuid, $3, $4, $5,
         $6, $7, $8, 'tablet_kiosk', $9,
         $10, $11::jsonb, $12, $13, $14::uuid
       )
       RETURNING *`,
      [
        organizationId,
        input.employeeId,
        eventType,
        input.latitude ?? null,
        input.longitude ?? null,
        input.locationVerified ?? false,
        input.selfieUrl ?? null,
        this.stringifyOptional(input.deviceInfo),
        this.stringifyOptional(input.notes),
        input.gpsAccuracy ?? null,
        input.deviceFingerprint ? JSON.stringify(input.deviceFingerprint) : null,
        input.timezoneOffset ?? null,
        input.workType ?? "office",
        input.branchId ?? employee.branch_id ?? null,
      ],
    );

    return result.rows[0];
  }

  private async employeeStatus(organizationId: string, employeeId: string) {
    const employee = await this.findEmployee(organizationId, employeeId);
    const eventsResult = await this.databaseService.query(
      `SELECT *
       FROM clock_events
       WHERE organization_id = $1::uuid
         AND employee_id = $2::uuid
         AND "timestamp"::date = CURRENT_DATE
       ORDER BY "timestamp" DESC`,
      [organizationId, employeeId],
    );

    const events = eventsResult.rows;
    const clockIns = events.filter((event) => event.event_type === "clock_in");
    const clockOuts = events.filter((event) => event.event_type === "clock_out");
    const lastEvent = events[0] ?? null;

    return {
      employee,
      isClockedIn: lastEvent?.event_type === "clock_in",
      lastEvent,
      clockIn: clockIns[clockIns.length - 1] ?? null,
      clockOut: clockOuts[0] ?? null,
      events,
    };
  }

  private async countCurrentlyClockedIn(organizationId: string) {
    const result = await this.databaseService.query(
      `WITH latest AS (
         SELECT DISTINCT ON (employee_id) employee_id, event_type
         FROM clock_events
         WHERE organization_id = $1::uuid
           AND "timestamp"::date = CURRENT_DATE
         ORDER BY employee_id, "timestamp" DESC
       )
       SELECT COUNT(*)::int AS total
       FROM latest
       WHERE event_type = 'clock_in'`,
      [organizationId],
    );

    return result.rows[0]?.total ?? 0;
  }

  private async findEmployee(organizationId: string, employeeId: string) {
    const result = await this.databaseService.query(
      `SELECT id, first_name, last_name, employee_number, status, branch_id
       FROM employees
       WHERE id = $1::uuid AND organization_id = $2::uuid`,
      [employeeId, organizationId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException("Employee not found");
    }

    return result.rows[0];
  }

  private stringifyOptional(value?: string | Record<string, unknown> | null) {
    if (value == null) {
      return null;
    }

    if (typeof value === "string") {
      return value;
    }

    return JSON.stringify(value);
  }
}
