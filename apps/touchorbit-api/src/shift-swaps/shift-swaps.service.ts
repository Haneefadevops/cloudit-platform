import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class ShiftSwapsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT
         ssr.*,
         concat_ws(' ', re.first_name, re.last_name) AS requester_name,
         concat_ws(' ', te.first_name, te.last_name) AS target_name,
         concat_ws(' ', ce.first_name, ce.last_name) AS claimed_name
       FROM shift_swap_requests ssr
       JOIN employees re ON re.id = ssr.requester_employee_id
       LEFT JOIN employees te ON te.id = ssr.target_employee_id
       LEFT JOIN employees ce ON ce.id = ssr.claimed_by
       WHERE ssr.organization_id = $1::uuid
       ORDER BY ssr.created_at DESC`,
      [organizationId],
    );
    return result.rows;
  }

  async create(
    organizationId: string,
    input: {
      requestingEmployeeId: string;
      requestedEmployeeId?: string;
      rosterAssignmentId: string;
      reason?: string;
    },
  ) {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const assignment = await client.query(
        `SELECT employee_id, date, shift_id
         FROM roster_assignments
         WHERE id = $1::uuid AND organization_id = $2::uuid`,
        [input.rosterAssignmentId, organizationId],
      );
      if (assignment.rows.length === 0) {
        throw new NotFoundException("Roster assignment not found");
      }
      const { employee_id, date, shift_id } = assignment.rows[0];

      if (employee_id !== input.requestingEmployeeId) {
        throw new BadRequestException(
          "Requesting employee does not match the roster assignment",
        );
      }

      if (input.requestedEmployeeId) {
        const targetCheck = await client.query(
          `SELECT 1 FROM employees
           WHERE id = $1::uuid
             AND organization_id = $2::uuid
             AND termination_date IS NULL`,
          [input.requestedEmployeeId, organizationId],
        );
        if (targetCheck.rows.length === 0) {
          throw new BadRequestException(
            "Target employee not found or not active",
          );
        }
      }

      const result = await client.query(
        `INSERT INTO shift_swap_requests (
           organization_id, requester_employee_id, target_employee_id,
           requester_date, target_date, status, reason
         )
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::date, $5::date, 'pending', $6)
         RETURNING *`,
        [
          organizationId,
          input.requestingEmployeeId,
          input.requestedEmployeeId ?? null,
          date,
          input.requestedEmployeeId ? date : null,
          input.reason ?? null,
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

  async approve(organizationId: string, swapId: string, reviewerId?: string) {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const swapResult = await client.query(
        `SELECT *
         FROM shift_swap_requests
         WHERE id = $1::uuid AND organization_id = $2::uuid
         FOR UPDATE`,
        [swapId, organizationId],
      );
      if (swapResult.rows.length === 0) {
        throw new NotFoundException("Shift swap request not found");
      }
      const swap = swapResult.rows[0];

      if (!["pending", "claimed"].includes(swap.status)) {
        throw new ConflictException("Request is already processed");
      }
      if (!swap.target_employee_id) {
        throw new ConflictException(
          "Open shift must be claimed before approval",
        );
      }

      const requesterShift = await client.query(
        `SELECT shift_id, notes
         FROM roster_assignments
         WHERE organization_id = $1::uuid
           AND employee_id = $2::uuid
           AND date = $3::date`,
        [organizationId, swap.requester_employee_id, swap.requester_date],
      );
      if (requesterShift.rows.length === 0) {
        throw new NotFoundException("Requester shift not found");
      }
      const reqShiftId = requesterShift.rows[0].shift_id;
      const reqNotes = requesterShift.rows[0].notes;

      if (swap.target_date) {
        const targetShift = await client.query(
          `SELECT shift_id, notes
           FROM roster_assignments
           WHERE organization_id = $1::uuid
             AND employee_id = $2::uuid
             AND date = $3::date`,
          [organizationId, swap.target_employee_id, swap.target_date],
        );
        const targetShiftId = targetShift.rows[0]?.shift_id ?? reqShiftId;
        const targetNotes = targetShift.rows[0]?.notes ?? reqNotes;

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
            swap.requester_employee_id,
            swap.target_date,
            targetShiftId,
            targetNotes,
          ],
        );
      } else {
        await client.query(
          `DELETE FROM roster_assignments
           WHERE organization_id = $1::uuid
             AND employee_id = $2::uuid
             AND date = $3::date`,
          [organizationId, swap.requester_employee_id, swap.requester_date],
        );
      }

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
          swap.target_employee_id,
          swap.requester_date,
          reqShiftId,
          reqNotes,
        ],
      );

      const result = await client.query(
        `UPDATE shift_swap_requests
         SET status = 'approved',
             reviewed_by = $3::uuid,
             reviewed_at = now(),
             updated_at = now()
         WHERE id = $1::uuid AND organization_id = $2::uuid
         RETURNING *`,
        [swapId, organizationId, reviewerId ?? null],
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

  async reject(
    organizationId: string,
    swapId: string,
    reviewerId?: string,
    reason?: string,
  ) {
    const result = await this.databaseService.query(
      `UPDATE shift_swap_requests
       SET status = 'rejected',
           rejection_reason = COALESCE($3, rejection_reason),
           reviewed_by = $4::uuid,
           reviewed_at = now(),
           updated_at = now()
       WHERE id = $1::uuid AND organization_id = $2::uuid
         AND status IN ('pending', 'claimed')
       RETURNING *`,
      [swapId, organizationId, reason ?? null, reviewerId ?? null],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException(
        "Shift swap request not found or already processed",
      );
    }
    return result.rows[0];
  }

  async claim(
    organizationId: string,
    swapId: string,
    claimerId: string,
    targetDate?: string,
  ) {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const swapResult = await client.query(
        `SELECT *
         FROM shift_swap_requests
         WHERE id = $1::uuid AND organization_id = $2::uuid
         FOR UPDATE`,
        [swapId, organizationId],
      );
      if (swapResult.rows.length === 0) {
        throw new NotFoundException("Shift swap request not found");
      }
      const swap = swapResult.rows[0];

      if (swap.status !== "pending" || swap.target_employee_id) {
        throw new ConflictException("Shift swap is not open for claims");
      }
      if (claimerId === swap.requester_employee_id) {
        throw new BadRequestException("Requester cannot claim their own swap");
      }

      const claimerCheck = await client.query(
        `SELECT 1 FROM employees
         WHERE id = $1::uuid
           AND organization_id = $2::uuid
           AND termination_date IS NULL`,
        [claimerId, organizationId],
      );
      if (claimerCheck.rows.length === 0) {
        throw new BadRequestException("Claimer not found or not active");
      }

      const resolvedTargetDate = targetDate ?? swap.requester_date;
      const result = await client.query(
        `UPDATE shift_swap_requests
         SET target_employee_id = $3::uuid,
             target_date = $4::date,
             status = 'claimed',
             claimed_by = $3::uuid,
             claimed_at = now(),
             updated_at = now()
         WHERE id = $1::uuid AND organization_id = $2::uuid
         RETURNING *`,
        [swapId, organizationId, claimerId, resolvedTargetDate],
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
}
