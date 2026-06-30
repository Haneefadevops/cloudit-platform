import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { DatabaseService } from "../database/database.service";
import { SlugService } from "../common/lib/slug.service";
import { mapOrganization, mapUser, mapProfile } from "../common/lib/mappers";
import type {
  Organization,
  OrganizationInput,
  OrganizationMember,
  OrganizationInvite,
  InviteStaffInput,
  CreateStaffProfileInput,
  User,
} from "../common/contracts/orbitone.v2";

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly slugService: SlugService,
  ) {}

  async createOrganization(
    userId: string,
    input: OrganizationInput,
  ): Promise<Organization> {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const existingOrg = await client.query(
        "SELECT id FROM organizations WHERE slug = $1",
        [input.slug],
      );
      if (existingOrg.rowCount !== 0) {
        throw new OrganizationError(
          "An organization with this slug already exists.",
          409,
        );
      }

      const orgResult = await client.query(
        `INSERT INTO organizations (slug, name, industry, logo_url, plan, plan_status)
         VALUES ($1, $2, $3, $4, 'pro_business_starter', 'active')
         RETURNING *`,
        [input.slug, input.name, input.industry ?? null, input.logoUrl ?? null],
      );
      const organization = mapOrganization(orgResult.rows[0]);

      await client.query(
        "UPDATE users SET organization_id = $1, role = 'admin', is_billing_contact = true, plan = 'pro_business_starter', updated_at = now() WHERE id = $2",
        [organization.id, userId],
      );

      await client.query("COMMIT");
      return organization;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getOrganizationByUserId(userId: string): Promise<Organization | null> {
    const result = await this.databaseService.query(
      `SELECT o.* FROM organizations o
       JOIN users u ON u.organization_id = o.id
       WHERE u.id = $1`,
      [userId],
    );
    if (result.rowCount === 0) return null;
    return mapOrganization(result.rows[0]);
  }

  async updateOrganization(
    userId: string,
    input: Partial<OrganizationInput>,
  ): Promise<Organization | null> {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const userResult = await client.query(
        "SELECT organization_id, role FROM users WHERE id = $1",
        [userId],
      );
      const user = userResult.rows[0];
      if (!user?.organization_id || user.role !== "admin") {
        throw new OrganizationError("Admin access required.", 403);
      }

      const fields: string[] = [];
      const values: unknown[] = [];
      const add = (col: string, val: unknown) => {
        values.push(val);
        fields.push(`${col} = $${values.length}`);
      };

      if (input.slug !== undefined) add("slug", input.slug);
      if (input.name !== undefined) add("name", input.name);
      if (input.industry !== undefined) add("industry", input.industry);
      if (input.logoUrl !== undefined) add("logo_url", input.logoUrl);

      if (fields.length === 0) {
        const orgResult = await client.query(
          "SELECT * FROM organizations WHERE id = $1",
          [user.organization_id],
        );
        await client.query("COMMIT");
        return orgResult.rows[0] ? mapOrganization(orgResult.rows[0]) : null;
      }

      values.push(user.organization_id);
      const orgResult = await client.query(
        `UPDATE organizations SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
        values,
      );

      await client.query("COMMIT");
      return orgResult.rows[0] ? mapOrganization(orgResult.rows[0]) : null;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getOrganizationMembers(userId: string): Promise<OrganizationMember[]> {
    const userResult = await this.databaseService.query(
      "SELECT organization_id FROM users WHERE id = $1",
      [userId],
    );
    const organizationId = userResult.rows[0]?.organization_id;
    if (!organizationId) return [];

    const usersResult = await this.databaseService.query(
      "SELECT * FROM users WHERE organization_id = $1 ORDER BY created_at DESC",
      [organizationId],
    );

    const members: OrganizationMember[] = [];
    for (const userRow of usersResult.rows) {
      const profileResult = await this.databaseService.query(
        "SELECT * FROM profiles WHERE user_id = $1",
        [userRow.id],
      );
      members.push({
        user: mapUser(userRow),
        profile: profileResult.rows[0]
          ? mapProfile(profileResult.rows[0])
          : null,
      });
    }
    return members;
  }

  async inviteStaff(
    userId: string,
    input: InviteStaffInput,
  ): Promise<OrganizationInvite> {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const userResult = await client.query(
        "SELECT organization_id, role FROM users WHERE id = $1",
        [userId],
      );
      const user = userResult.rows[0];
      if (!user?.organization_id || user.role !== "admin") {
        throw new OrganizationError("Admin access required.", 403);
      }

      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const inviteResult = await client.query(
        `INSERT INTO organization_invites (organization_id, email, role, token, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (organization_id, email) DO UPDATE SET role = EXCLUDED.role, token = EXCLUDED.token, expires_at = EXCLUDED.expires_at
         RETURNING *`,
        [
          user.organization_id,
          input.email,
          input.role ?? "staff",
          token,
          expiresAt,
        ],
      );

      await client.query("COMMIT");
      return this.mapOrganizationInvite(inviteResult.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async createStaffProfile(
    adminUserId: string,
    input: CreateStaffProfileInput,
  ): Promise<{ user: User; profile: ReturnType<typeof mapProfile> }> {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const adminResult = await client.query(
        "SELECT organization_id, role FROM users WHERE id = $1",
        [adminUserId],
      );
      const admin = adminResult.rows[0];
      if (!admin?.organization_id || admin.role !== "admin") {
        throw new OrganizationError("Admin access required.", 403);
      }

      const existingUser = await client.query(
        "SELECT id FROM users WHERE email = $1",
        [input.email],
      );
      if (existingUser.rowCount !== 0) {
        throw new OrganizationError(
          "A user with this email already exists.",
          409,
        );
      }

      const tempPassword = randomBytes(16).toString("hex");
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      const slug =
        input.slug ??
        (await this.slugService.makeUniqueProfileSlug(
          input.fullName || input.email,
        ));

      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role, organization_id, plan)
         VALUES ($1, $2, $3, 'staff', $4, 'pro_business_starter')
         RETURNING *`,
        [input.email, passwordHash, input.fullName, admin.organization_id],
      );
      const user = mapUser(userResult.rows[0]);

      const profileResult = await client.query(
        `INSERT INTO profiles (
          user_id, slug, full_name, email, type, department, job_title, is_published
        ) VALUES ($1, $2, $3, $4, 'staff', $5, $6, false)
        RETURNING *`,
        [
          user.id,
          slug,
          input.fullName,
          input.email,
          input.department ?? null,
          input.jobTitle ?? null,
        ],
      );

      await client.query("COMMIT");
      return { user, profile: mapProfile(profileResult.rows[0]) };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async validateInvite(token: string): Promise<{
    organizationId: string;
    email: string;
    role: string;
  } | null> {
    const result = await this.databaseService.query(
      "SELECT * FROM organization_invites WHERE token = $1 AND expires_at > now()",
      [token],
    );
    if (result.rowCount === 0) return null;
    const invite = result.rows[0];
    return {
      organizationId: invite.organization_id as string,
      email: invite.email as string,
      role: invite.role as string,
    };
  }

  async acceptInvite(
    token: string,
    password: string,
    fullName?: string,
  ): Promise<User> {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const inviteResult = await client.query(
        "SELECT * FROM organization_invites WHERE token = $1 AND expires_at > now()",
        [token],
      );
      if (inviteResult.rowCount === 0) {
        throw new OrganizationError("Invalid or expired invite token.", 400);
      }
      const invite = inviteResult.rows[0];

      const existingUser = await client.query(
        "SELECT id FROM users WHERE email = $1",
        [invite.email],
      );
      if (existingUser.rowCount !== 0) {
        throw new OrganizationError(
          "An account with this email already exists.",
          409,
        );
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const name = fullName || (invite.email as string);
      const slug = await this.slugService.makeUniqueProfileSlug(name);

      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role, organization_id, plan)
         VALUES ($1, $2, $3, $4, $5, 'pro_business_starter')
         RETURNING *`,
        [invite.email, passwordHash, name, invite.role, invite.organization_id],
      );
      const user = mapUser(userResult.rows[0]);

      await client.query(
        `INSERT INTO profiles (user_id, slug, full_name, email, type, is_published)
         VALUES ($1, $2, $3, $4, 'staff', false)`,
        [user.id, slug, name, invite.email],
      );

      await client.query("DELETE FROM organization_invites WHERE id = $1", [
        invite.id,
      ]);

      await client.query("COMMIT");
      return user;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private mapOrganizationInvite(
    row: Record<string, unknown>,
  ): OrganizationInvite {
    return {
      id: row.id as string,
      organizationId: row.organization_id as string,
      email: row.email as string,
      role: (row.role as OrganizationInvite["role"]) ?? "staff",
      expiresAt: (row.expires_at as Date).toISOString(),
      createdAt: (row.created_at as Date).toISOString(),
    };
  }
}

export class OrganizationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "OrganizationError";
  }
}
