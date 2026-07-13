import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class OrganizationsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findSettings(organizationId: string) {
    const [orgResult, otResult] = await Promise.all([
      this.databaseService.query(
        `SELECT * FROM organizations WHERE id = $1::uuid`,
        [organizationId],
      ),
      this.databaseService.query(
        `SELECT * FROM overtime_policies WHERE organization_id = $1::uuid`,
        [organizationId],
      ),
    ]);
    return {
      organization: orgResult.rows[0] || null,
      overtimePolicy: otResult.rows[0] || null,
    };
  }

  async updateSettings(organizationId: string, body: any) {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const orgFields = [
        "name",
        "timezone",
        "work_hours_start",
        "work_hours_end",
        "grace_period_minutes",
        "require_selfie",
        "require_geofence",
        "late_threshold_minutes",
        "annual_leave_days",
        "casual_leave_days",
        "sick_leave_days",
        "expected_timezone_offset",
        "timezone_tolerance_minutes",
        "strict_location_mode",
        "carry_forward_enabled",
        "carry_forward_limit",
        "encashment_allowed",
        "encashment_max_days",
        "comp_off_expiry_months",
      ];
      const orgUpdates: string[] = [];
      const orgValues: any[] = [];
      for (const field of orgFields) {
        if (body[field] !== undefined) {
          orgUpdates.push(`${field} = $${orgValues.length + 1}`);
          orgValues.push(body[field]);
        }
      }
      if (orgUpdates.length > 0) {
        orgValues.push(organizationId);
        await client.query(
          `UPDATE organizations SET ${orgUpdates.join(", ")}, updated_at = now() WHERE id = $${orgValues.length}::uuid`,
          orgValues,
        );
      }

      const ot = body.overtimePolicy;
      if (ot) {
        const otFields = [
          "max_daily_hours",
          "max_weekly_hours",
          "weekday_rate",
          "weekend_rate",
          "holiday_rate",
          "requires_approval",
          "auto_detect",
        ];
        const presentFields = otFields.filter((f) => ot[f] !== undefined);
        if (presentFields.length > 0) {
          const columns = presentFields.join(", ");
          const placeholders = presentFields
            .map((_, i) => `$${i + 1}`)
            .join(", ");
          const updates = presentFields
            .map((f, i) => `${f} = $${i + 1}`)
            .join(", ");
          const values = presentFields.map((f) => ot[f]);
          await client.query(
            `INSERT INTO overtime_policies (organization_id, ${columns}, updated_at)
             VALUES ($${presentFields.length + 1}::uuid, ${placeholders}, now())
             ON CONFLICT (organization_id)
             DO UPDATE SET ${updates}, updated_at = now()`,
            [...values, organizationId],
          );
        }
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  findAll(_organizationId: string) {
    return [];
  }

  async findBranches(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT id, name, code, city, address, is_active
       FROM branches
       WHERE organization_id = $1::uuid AND is_active = true
       ORDER BY name`,
      [organizationId],
    );
    return result.rows;
  }

  async findDepartments(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT d.id, d.name, d.code, d.is_active, d.branch_id, b.name as branch_name
       FROM departments d
       LEFT JOIN branches b ON b.id = d.branch_id
       WHERE d.organization_id = $1::uuid AND d.is_active = true
       ORDER BY d.name`,
      [organizationId],
    );
    return result.rows.map((row) => ({
      ...row,
      branch: row.branch_name ? { name: row.branch_name } : null,
    }));
  }
}
