import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { DatabaseService } from "../database/database.service";

const provisionSchema = z.object({
  platformOrgId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(80),
  superAdminEmail: z.string().trim().email(),
  superAdminFirstName: z.string().trim().min(1).max(120),
  superAdminLastName: z.string().trim().min(1).max(120),
});

@Injectable()
export class InternalProvisioningService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async provision(body: unknown) {
    const parsed = provisionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid provisioning payload");
    }
    const input = parsed.data;
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const client = await this.databaseService.connect();

    try {
      await client.query("BEGIN");

      const orgResult = await client.query(
        `INSERT INTO organizations (name, slug, platform_org_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO UPDATE
           SET name = EXCLUDED.name,
               platform_org_id = EXCLUDED.platform_org_id,
               updated_at = now()
         RETURNING id, name, slug`,
        [input.name, input.slug, input.platformOrgId],
      );
      const org = orgResult.rows[0];

      const userResult = await client.query(
        `INSERT INTO users (
           organization_id, email, password_hash, first_name, last_name, role, is_active
         )
         VALUES ($1, $2, '', $3, $4, 'owner', false)
         ON CONFLICT (email) DO UPDATE
           SET organization_id = EXCLUDED.organization_id,
               first_name = EXCLUDED.first_name,
               last_name = EXCLUDED.last_name,
               role = 'owner',
               is_active = false
         RETURNING id, email, first_name, last_name, role, organization_id`,
        [
          org.id,
          input.superAdminEmail.toLowerCase(),
          input.superAdminFirstName,
          input.superAdminLastName,
        ],
      );
      const user = userResult.rows[0];

      await client.query(
        `INSERT INTO user_security_roles (organization_id, user_id, system_role)
         VALUES ($1, $2, 'owner')
         ON CONFLICT (organization_id, user_id)
         DO UPDATE SET system_role = 'owner'`,
        [org.id, user.id],
      );

      await client.query(
        `INSERT INTO user_invite_tokens (organization_id, user_id, email, token, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [org.id, user.id, user.email, token, expiresAt],
      );

      await client.query("COMMIT");

      return {
        tenantId: org.id,
        userId: user.id,
        inviteToken: token,
        setPasswordUrl: this.setPasswordUrl(token),
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private setPasswordUrl(token: string): string {
    const base =
      this.configService.get<string>("TOUCHORBIT_WEB_URL") ||
      this.configService.get<string>("FRONTEND_ORIGIN") ||
      "http://localhost:3000";
    return `${base.replace(/\/$/, "")}/set-password?token=${token}`;
  }
}
