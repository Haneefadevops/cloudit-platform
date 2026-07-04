import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
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
    const fullName =
      `${input.superAdminFirstName} ${input.superAdminLastName}`.trim();
    const unusablePasswordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
    const client = await this.databaseService.connect();

    try {
      await client.query("BEGIN");
      const orgResult = await client.query(
        `INSERT INTO organizations (slug, name, plan, plan_status, platform_org_id)
         VALUES ($1, $2, 'pro_business_starter', 'active', $3)
         ON CONFLICT (slug) DO UPDATE
           SET name = EXCLUDED.name,
               platform_org_id = EXCLUDED.platform_org_id,
               updated_at = now()
         RETURNING id, slug, name`,
        [input.slug, input.name, input.platformOrgId],
      );
      const org = orgResult.rows[0];

      const userResult = await client.query(
        `INSERT INTO users (
           email, password_hash, full_name, role, organization_id, plan, is_billing_contact
         )
         VALUES ($1, $2, $3, 'admin', $4, 'pro_business_starter', true)
         ON CONFLICT (email)
         DO UPDATE SET full_name = EXCLUDED.full_name,
                       role = 'admin',
                       organization_id = EXCLUDED.organization_id,
                       plan = 'pro_business_starter',
                       is_billing_contact = true,
                       updated_at = now()
         RETURNING id`,
        [input.superAdminEmail.toLowerCase(), unusablePasswordHash, fullName, org.id],
      );
      const user = userResult.rows[0];

      const inviteResult = await client.query(
        `INSERT INTO organization_invites (
           organization_id, email, role, token, expires_at, source
         )
         VALUES ($1, $2, 'admin', $3, $4, 'platform')
         ON CONFLICT (organization_id, email)
         DO UPDATE SET role = 'admin',
                       token = EXCLUDED.token,
                       expires_at = EXCLUDED.expires_at,
                       source = 'platform'
         RETURNING token`,
        [org.id, input.superAdminEmail.toLowerCase(), token, expiresAt],
      );

      await client.query("COMMIT");

      return {
        tenantId: org.id,
        userId: user.id,
        inviteToken: inviteResult.rows[0].token,
        setPasswordUrl: this.acceptInviteUrl(inviteResult.rows[0].token),
        fullName,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private acceptInviteUrl(token: string): string {
    const base =
      this.configService.get<string>("ORBITONE_WEB_URL") ||
      this.configService.get<string>("FRONTEND_ORIGIN") ||
      "http://localhost:3000";
    return `${base.replace(/\/$/, "")}/accept-invite?token=${token}`;
  }
}
