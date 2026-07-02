import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { IpVerificationService } from "./ip-verification.service";

export interface ListClockEventsFilters {
  employeeId?: string;
  eventType?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
}

export interface CreateClockEventInput {
  organizationId: string;
  employeeId: string;
  eventType: string;
  latitude?: number;
  longitude?: number;
  selfieUrl?: string;
  deviceInfo?: string;
  notes?: string;
  clientIp?: string | null;
}

export interface CreateBreakEventInput {
  employeeId: string;
  clockEventId?: string;
  breakStart?: string;
  breakEnd?: string;
  breakType?: string;
  durationMinutes?: number;
}

export interface CreateCorrectionInput {
  employeeId: string;
  originalEventId?: string;
  correctionType: string;
  requestedTime: string;
  reason: string;
}

export interface CreateGeofenceInput {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  status?: string;
}

export interface UpdateGeofenceInput {
  name?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  status?: string;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly ipVerificationService: IpVerificationService,
  ) {}

  async findAll(organizationId: string, filters: ListClockEventsFilters) {
    const params: unknown[] = [organizationId];
    const conditions = ["ce.organization_id = $1::uuid"];

    if (filters.employeeId) {
      params.push(filters.employeeId);
      conditions.push(`ce.employee_id = $${params.length}::uuid`);
    }

    if (filters.eventType) {
      params.push(filters.eventType);
      conditions.push(`ce.event_type = $${params.length}`);
    }

    if (filters.from) {
      params.push(filters.from);
      conditions.push(`ce."timestamp" >= $${params.length}::timestamptz`);
    }

    if (filters.to) {
      params.push(filters.to);
      conditions.push(`ce."timestamp" <= $${params.length}::timestamptz`);
    }

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    params.push(filters.limit, filters.offset);

    const result = await this.databaseService.query(
      `SELECT ce.*,
              COALESCE(e.first_name || ' ' || e.last_name, '') AS employee_name
       FROM clock_events ce
       LEFT JOIN employees e
         ON e.id = ce.employee_id AND e.organization_id = ce.organization_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY ce."timestamp" DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );

    return result.rows;
  }

  async createClockEvent(input: CreateClockEventInput) {
    const result = await this.databaseService.query(
      `INSERT INTO clock_events (
         organization_id, employee_id, event_type, latitude, longitude,
         selfie_url, device_info, notes
       )
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.organizationId,
        input.employeeId,
        input.eventType,
        input.latitude ?? null,
        input.longitude ?? null,
        input.selfieUrl ?? null,
        input.deviceInfo ?? null,
        input.notes ?? null,
      ],
    );

    const event = result.rows[0];

    if (
      input.latitude != null &&
      input.longitude != null &&
      input.clientIp !== undefined
    ) {
      await this.ipVerificationService.verifyClockEvent(
        event.id as string,
        input.latitude,
        input.longitude,
        input.clientIp,
      );
    }

    return event;
  }

  async getClockEvent(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `SELECT ce.*,
              COALESCE(e.first_name || ' ' || e.last_name, '') AS employee_name
       FROM clock_events ce
       LEFT JOIN employees e
         ON e.id = ce.employee_id AND e.organization_id = ce.organization_id
       WHERE ce.id = $1::uuid AND ce.organization_id = $2::uuid`,
      [id, organizationId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException("Clock event not found");
    }

    return result.rows[0];
  }

  async reviewClockEvent(
    organizationId: string,
    id: string,
    reviewedBy: string,
    status: string,
    notes?: string,
  ) {
    const result = await this.databaseService.query(
      `UPDATE clock_events
       SET admin_review_status = $3,
           reviewed_by = $4::uuid,
           reviewed_at = now(),
           review_notes = COALESCE($5, review_notes)
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      [id, organizationId, status, reviewedBy, notes ?? null],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException("Clock event not found");
    }

    return result.rows[0];
  }

  getClientIp(
    headers: Record<string, string | string[] | undefined>,
  ): string | null {
    return this.ipVerificationService.getClientIp(headers);
  }

  async verifyIp(
    eventId: string,
    claimedLat: number,
    claimedLng: number,
    clientIp: string | null,
  ) {
    return this.ipVerificationService.verifyClockEvent(
      eventId,
      claimedLat,
      claimedLng,
      clientIp,
    );
  }

  async findBreakEvents(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT be.*,
              COALESCE(e.first_name || ' ' || e.last_name, '') AS employee_name
       FROM break_events be
       LEFT JOIN employees e
         ON e.id = be.employee_id AND e.organization_id = be.organization_id
       WHERE be.organization_id = $1::uuid
       ORDER BY be.break_start DESC
       LIMIT 500`,
      [organizationId],
    );

    return result.rows;
  }

  async createBreakEvent(organizationId: string, input: CreateBreakEventInput) {
    const result = await this.databaseService.query(
      `INSERT INTO break_events (
         organization_id, employee_id, clock_event_id, break_start,
         break_end, break_type, duration_minutes
       )
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7)
       RETURNING *`,
      [
        organizationId,
        input.employeeId,
        input.clockEventId ?? null,
        input.breakStart ?? new Date().toISOString(),
        input.breakEnd ?? null,
        input.breakType ?? "break",
        input.durationMinutes ?? null,
      ],
    );

    return result.rows[0];
  }

  async findCorrections(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT ac.*,
              COALESCE(e.first_name || ' ' || e.last_name, '') AS employee_name
       FROM attendance_corrections ac
       LEFT JOIN employees e
         ON e.id = ac.employee_id AND e.organization_id = ac.organization_id
       WHERE ac.organization_id = $1::uuid
       ORDER BY ac.created_at DESC
       LIMIT 500`,
      [organizationId],
    );

    return result.rows;
  }

  async createCorrection(organizationId: string, input: CreateCorrectionInput) {
    const result = await this.databaseService.query(
      `INSERT INTO attendance_corrections (
         organization_id, employee_id, original_event_id,
         correction_type, requested_time, reason
       )
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)
       RETURNING *`,
      [
        organizationId,
        input.employeeId,
        input.originalEventId ?? null,
        input.correctionType,
        input.requestedTime,
        input.reason,
      ],
    );

    return result.rows[0];
  }

  async approveCorrection(
    organizationId: string,
    id: string,
    userId: string,
  ) {
    return this.updateCorrectionStatus(organizationId, id, userId, "approved");
  }

  async rejectCorrection(
    organizationId: string,
    id: string,
    userId: string,
    rejectionReason?: string,
  ) {
    return this.updateCorrectionStatus(
      organizationId,
      id,
      userId,
      "rejected",
      rejectionReason,
    );
  }

  private async updateCorrectionStatus(
    organizationId: string,
    id: string,
    userId: string,
    status: "approved" | "rejected",
    rejectionReason?: string,
  ) {
    const approverId = await this.findEmployeeIdForUser(organizationId, userId);
    const result = await this.databaseService.query(
      `UPDATE attendance_corrections
       SET status = $3,
           approver_id = $4::uuid,
           approved_at = CASE WHEN $3 = 'approved' THEN now() ELSE approved_at END,
           rejection_reason = CASE WHEN $3 = 'rejected' THEN COALESCE($5, rejection_reason) ELSE NULL END,
           updated_at = now()
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      [id, organizationId, status, approverId, rejectionReason ?? null],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException("Attendance correction not found");
    }

    return result.rows[0];
  }

  private async findEmployeeIdForUser(organizationId: string, userId: string) {
    const result = await this.databaseService.query(
      `SELECT id
       FROM employees
       WHERE organization_id = $1::uuid AND user_id = $2::uuid
       LIMIT 1`,
      [organizationId, userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException("Approver employee not found");
    }

    return result.rows[0].id as string;
  }

  async findGeofences(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT * FROM geofences
       WHERE organization_id = $1::uuid
       ORDER BY created_at DESC`,
      [organizationId],
    );

    return result.rows;
  }

  async createGeofence(organizationId: string, input: CreateGeofenceInput) {
    const result = await this.databaseService.query(
      `INSERT INTO geofences (
         organization_id, name, latitude, longitude, radius_meters, status
       )
       VALUES ($1::uuid, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        organizationId,
        input.name,
        input.latitude,
        input.longitude,
        input.radiusMeters ?? 200,
        input.status ?? "active",
      ],
    );

    return result.rows[0];
  }

  async updateGeofence(
    organizationId: string,
    id: string,
    input: UpdateGeofenceInput,
  ) {
    const setClauses: string[] = [];
    const params: unknown[] = [id, organizationId];

    const add = (column: string, value: unknown) => {
      if (value !== undefined) {
        params.push(value);
        setClauses.push(`${column} = $${params.length}`);
      }
    };

    add("name", input.name);
    add("latitude", input.latitude);
    add("longitude", input.longitude);
    add("radius_meters", input.radiusMeters);
    add("status", input.status);

    if (setClauses.length === 0) {
      const current = await this.databaseService.query(
        `SELECT * FROM geofences WHERE id = $1::uuid AND organization_id = $2::uuid`,
        [id, organizationId],
      );
      if (current.rows.length === 0) {
        throw new NotFoundException("Geofence not found");
      }
      return current.rows[0];
    }

    setClauses.push("updated_at = now()");

    const result = await this.databaseService.query(
      `UPDATE geofences
       SET ${setClauses.join(", ")}
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      params,
    );

    if (result.rows.length === 0) {
      throw new NotFoundException("Geofence not found");
    }

    return result.rows[0];
  }

  async deleteGeofence(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `DELETE FROM geofences
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      [id, organizationId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException("Geofence not found");
    }

    return { deleted: true };
  }
}
