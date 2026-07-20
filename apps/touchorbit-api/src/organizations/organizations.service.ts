import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
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

  async createBranch(organizationId: string, body: any) {
    const result = await this.databaseService.query(
      `INSERT INTO branches (organization_id, name, code, city, address)
       VALUES ($1::uuid, $2, $3, $4, $5) RETURNING *`,
      [organizationId, body.name, body.code || null, body.city || null, body.address || null],
    );
    return result.rows[0];
  }

  async updateBranch(organizationId: string, id: string, body: any) {
    const result = await this.databaseService.query(
      `UPDATE branches SET name = $3, code = $4, city = $5, address = $6
       WHERE id = $1::uuid AND organization_id = $2::uuid AND is_active = true
       RETURNING *`,
      [id, organizationId, body.name, body.code || null, body.city || null, body.address || null],
    );
    if (!result.rows[0]) throw new NotFoundException("Branch not found");
    return result.rows[0];
  }

  async deleteBranch(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `UPDATE branches SET is_active = false
       WHERE id = $1::uuid AND organization_id = $2::uuid AND is_active = true RETURNING id`,
      [id, organizationId],
    );
    if (!result.rows[0]) throw new NotFoundException("Branch not found");
    return { deleted: true, id };
  }

  async createDepartment(organizationId: string, body: any) {
    const result = await this.databaseService.query(
      `INSERT INTO departments (organization_id, name, code, branch_id)
       SELECT $1::uuid, $2, $3, b.id
       FROM (SELECT 1) seed
       LEFT JOIN branches b ON b.id = $4::uuid AND b.organization_id = $1::uuid AND b.is_active = true
       WHERE $4::uuid IS NULL OR b.id IS NOT NULL
       RETURNING *`,
      [organizationId, body.name, body.code || null, body.branch_id || null],
    );
    if (!result.rows[0]) throw new BadRequestException("Invalid branch");
    return result.rows[0];
  }

  async updateDepartment(organizationId: string, id: string, body: any) {
    const result = await this.databaseService.query(
      `UPDATE departments d SET name = $3, code = $4, branch_id = b.id, updated_at = now()
       FROM (SELECT $5::uuid AS requested_id) requested
       LEFT JOIN branches b ON b.id = requested.requested_id AND b.organization_id = $2::uuid AND b.is_active = true
       WHERE d.id = $1::uuid AND d.organization_id = $2::uuid AND d.is_active = true
         AND (requested.requested_id IS NULL OR b.id IS NOT NULL)
       RETURNING d.*`,
      [id, organizationId, body.name, body.code || null, body.branch_id || null],
    );
    if (!result.rows[0]) throw new NotFoundException("Department or branch not found");
    return result.rows[0];
  }

  async deleteDepartment(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `UPDATE departments SET is_active = false, updated_at = now()
       WHERE id = $1::uuid AND organization_id = $2::uuid AND is_active = true RETURNING id`,
      [id, organizationId],
    );
    if (!result.rows[0]) throw new NotFoundException("Department not found");
    return { deleted: true, id };
  }

  private approvalConfig(type: string) {
    const configs: Record<string, { table: string; fields: string[] }> = {
      leave: { table: "leave_approval_config", fields: ["auto_approve_below_days", "level1_min_days", "level2_min_days", "level3_min_days", "parallel_approval", "skip_if_no_manager"] },
      overtime: { table: "overtime_approval_config", fields: ["auto_approve_below_hours", "level1_min_hours", "level2_min_hours", "level3_min_hours", "parallel_approval", "skip_if_no_manager"] },
      expense: { table: "expense_approval_config", fields: ["auto_approve_below", "level1_min_amount", "level2_min_amount", "level3_min_amount", "parallel_approval", "skip_if_no_manager"] },
    };
    const config = configs[type];
    if (!config) throw new BadRequestException("Invalid approval config type");
    return config;
  }

  async getApprovalConfig(organizationId: string, type: string) {
    const config = this.approvalConfig(type);
    const result = await this.databaseService.query(
      `SELECT ${config.fields.join(", ")} FROM ${config.table} WHERE organization_id = $1::uuid`,
      [organizationId],
    );
    return result.rows[0] || null;
  }

  async updateApprovalConfig(organizationId: string, type: string, body: any) {
    const config = this.approvalConfig(type);
    const fields = config.fields.filter((field) => body[field] !== undefined);
    if (fields.length === 0) throw new BadRequestException("Approval config values are required");
    const columns = fields.join(", ");
    const values = fields.map((field) => body[field]);
    const placeholders = fields.map((_, index) => `$${index + 2}`).join(", ");
    const updates = fields.map((field) => `${field} = EXCLUDED.${field}`).join(", ");
    const result = await this.databaseService.query(
      `INSERT INTO ${config.table} (organization_id, ${columns}, updated_at)
       VALUES ($1::uuid, ${placeholders}, now())
       ON CONFLICT (organization_id) DO UPDATE SET ${updates}, updated_at = now()
       RETURNING ${config.fields.join(", ")}`,
      [organizationId, ...values],
    );
    return result.rows[0];
  }

  async getSecurity(organizationId: string) {
    const [users, roles, permissions, groups, groupPermissions, assignments, audit] = await Promise.all([
      this.databaseService.query(`SELECT id, email, first_name, last_name, role FROM users WHERE organization_id = $1::uuid ORDER BY first_name`, [organizationId]),
      this.databaseService.query(`SELECT * FROM user_security_roles WHERE organization_id = $1::uuid`, [organizationId]),
      this.databaseService.query(`SELECT * FROM permissions ORDER BY module, action`, []),
      this.databaseService.query(`SELECT * FROM permission_groups WHERE organization_id = $1::uuid OR organization_id IS NULL ORDER BY name`, [organizationId]),
      this.databaseService.query(`SELECT pgp.* FROM permission_group_permissions pgp JOIN permission_groups pg ON pg.id = pgp.group_id WHERE pg.organization_id = $1::uuid OR pg.organization_id IS NULL`, [organizationId]),
      this.databaseService.query(`SELECT * FROM user_permission_groups WHERE organization_id = $1::uuid`, [organizationId]),
      this.databaseService.query(`SELECT * FROM security_audit_log WHERE organization_id = $1::uuid ORDER BY created_at DESC LIMIT 30`, [organizationId]),
    ]);
    return {
      users: users.rows, roles: roles.rows, permissions: permissions.rows,
      groups: groups.rows, groupPermissions: groupPermissions.rows,
      assignments: assignments.rows, audit: audit.rows,
    };
  }

  async updateSecurityRole(organizationId: string, actorUserId: string, targetUserId: string, systemRole: string) {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");
      const user = await client.query(
        `SELECT u.role, COALESCE(usr.system_role, u.role) AS system_role
         FROM users u LEFT JOIN user_security_roles usr
           ON usr.user_id = u.id AND usr.organization_id = u.organization_id
         WHERE u.id = $1::uuid AND u.organization_id = $2::uuid FOR UPDATE OF u`,
        [targetUserId, organizationId],
      );
      if (!user.rows[0]) throw new NotFoundException("User not found");
      if (actorUserId === targetUserId && user.rows[0].system_role === "owner" && systemRole !== "owner") {
        throw new BadRequestException("You cannot reduce your own owner access");
      }
      await client.query(
        `INSERT INTO user_security_roles (organization_id, user_id, system_role, created_by, updated_at)
         VALUES ($1::uuid, $2::uuid, $3, $4::uuid, now())
         ON CONFLICT (organization_id, user_id) DO UPDATE SET system_role = EXCLUDED.system_role, updated_at = now()`,
        [organizationId, targetUserId, systemRole, actorUserId],
      );
      await client.query(`UPDATE users SET role = $3 WHERE id = $1::uuid AND organization_id = $2::uuid`, [targetUserId, organizationId, systemRole]);
      await client.query(
        `INSERT INTO security_audit_log (organization_id, actor_user_id, target_user_id, action, entity_type, old_value, new_value)
         VALUES ($1::uuid, $2::uuid, $3::uuid, 'security_role_updated', 'user', $4::jsonb, $5::jsonb)`,
        [organizationId, actorUserId, targetUserId, JSON.stringify({ role: user.rows[0].role }), JSON.stringify({ role: systemRole })],
      );
      await client.query("COMMIT");
      return { user_id: targetUserId, system_role: systemRole };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async createPermissionGroup(organizationId: string, actorUserId: string, body: any) {
    const result = await this.databaseService.query(
      `INSERT INTO permission_groups (organization_id, name, description, created_by)
       VALUES ($1::uuid, $2, $3, $4::uuid) RETURNING *`,
      [organizationId, body.name, body.description || null, actorUserId],
    );
    return result.rows[0];
  }

  async toggleGroupPermission(organizationId: string, groupId: string, permissionKey: string, enabled: boolean) {
    const group = await this.databaseService.query(
      `SELECT id, is_system FROM permission_groups WHERE id = $1::uuid AND organization_id = $2::uuid`,
      [groupId, organizationId],
    );
    if (!group.rows[0]) throw new NotFoundException("Permission group not found");
    if (group.rows[0].is_system) throw new BadRequestException("System groups cannot be edited");
    if (enabled) {
      await this.databaseService.query(
        `INSERT INTO permission_group_permissions (group_id, permission_key)
         SELECT $1::uuid, p.key FROM permissions p WHERE p.key = $2
         ON CONFLICT (group_id, permission_key) DO NOTHING`,
        [groupId, permissionKey],
      );
    } else {
      await this.databaseService.query(`DELETE FROM permission_group_permissions WHERE group_id = $1::uuid AND permission_key = $2`, [groupId, permissionKey]);
    }
    return { group_id: groupId, permission_key: permissionKey, enabled };
  }

  async assignPermissionGroup(organizationId: string, actorUserId: string, body: any) {
    const result = await this.databaseService.query(
      `INSERT INTO user_permission_groups (organization_id, user_id, group_id, scope_type, scope_id, created_by)
       SELECT $1::uuid, u.id, pg.id, $4, $5::uuid, $6::uuid
       FROM users u JOIN permission_groups pg ON pg.id = $3::uuid AND (pg.organization_id = $1::uuid OR pg.organization_id IS NULL)
       WHERE u.id = $2::uuid AND u.organization_id = $1::uuid
       RETURNING *`,
      [organizationId, body.user_id, body.group_id, body.scope_type, body.scope_id || null, actorUserId],
    );
    if (!result.rows[0]) throw new BadRequestException("Invalid user or permission group");
    return result.rows[0];
  }

  async removePermissionGroup(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `DELETE FROM user_permission_groups WHERE id = $1::uuid AND organization_id = $2::uuid RETURNING id`,
      [id, organizationId],
    );
    if (!result.rows[0]) throw new NotFoundException("Permission assignment not found");
    return { deleted: true, id };
  }

  async updateExpensePolicy(organizationId: string, body: any) {
    const result = await this.databaseService.query(
      `INSERT INTO expense_policies (
         organization_id, category_id, scope_type, scope_id, limit_per_claim,
         limit_per_month, auto_approve_below, receipt_required, updated_at
       ) VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5, $6, $7, $8, now())
       ON CONFLICT (organization_id, category_id, scope_type, scope_id) DO UPDATE SET
         limit_per_claim = EXCLUDED.limit_per_claim, limit_per_month = EXCLUDED.limit_per_month,
         auto_approve_below = EXCLUDED.auto_approve_below, receipt_required = EXCLUDED.receipt_required,
         updated_at = now() RETURNING *`,
      [organizationId, body.category_id, body.scope_type, body.scope_id, body.limit_per_claim,
       body.limit_per_month, body.auto_approve_below, body.receipt_required],
    );
    return result.rows[0];
  }

  async syncLeavePolicy(organizationId: string, body: any) {
    const result = await this.databaseService.query(
      `WITH annual AS (
         UPDATE leave_balances SET entitled_days = $3, remaining_days = $3 - COALESCE(used_days, 0)
         WHERE organization_id = $1::uuid AND year = $2::int AND leave_type = 'annual' RETURNING 1
       ), casual AS (
         UPDATE leave_balances SET entitled_days = $4, remaining_days = $4 - COALESCE(used_days, 0)
         WHERE organization_id = $1::uuid AND year = $2::int AND leave_type = 'casual' RETURNING 1
       ), sick AS (
         UPDATE leave_balances SET entitled_days = $5, remaining_days = $5 - COALESCE(used_days, 0)
         WHERE organization_id = $1::uuid AND year = $2::int AND leave_type = 'sick' RETURNING 1
       )
       SELECT (SELECT COUNT(*) FROM annual) + (SELECT COUNT(*) FROM casual) + (SELECT COUNT(*) FROM sick) AS count`,
      [organizationId, body.year, body.annual_days, body.casual_days, body.sick_days],
    );
    return { count: Number(result.rows[0]?.count || 0) };
  }
}
