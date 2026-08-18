import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { mapProfile, mapPublicProfile } from "../common/lib/mappers";
import { generateVCard } from "./vcard.helper";
import type { ProfileInput } from "./profiles.schemas";
import type { PublicContactCaptureInput } from "./profiles.schemas";
import { filterXSS } from "xss";

@Injectable()
export class ProfilesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getMyProfile(userId: string) {
    const result = await this.databaseService.query(
      "SELECT * FROM profiles WHERE user_id = $1",
      [userId],
    );
    if (result.rowCount === 0) return null;
    return mapProfile(result.rows[0]);
  }

  async updateMyProfile(userId: string, input: ProfileInput) {
    const existing = await this.getMyProfile(userId);

    const result = await this.databaseService.query(
      `INSERT INTO profiles (
        user_id, slug, full_name, headline, company, location, bio, avatar_url,
        email, phone, website_url, linkedin_url, x_url, department, job_title, type, is_published
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'personal', $16
      )
      ON CONFLICT (user_id) DO UPDATE SET
        slug = EXCLUDED.slug,
        full_name = EXCLUDED.full_name,
        headline = EXCLUDED.headline,
        company = EXCLUDED.company,
        location = EXCLUDED.location,
        bio = EXCLUDED.bio,
        avatar_url = EXCLUDED.avatar_url,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        website_url = EXCLUDED.website_url,
        linkedin_url = EXCLUDED.linkedin_url,
        x_url = EXCLUDED.x_url,
        department = EXCLUDED.department,
        job_title = EXCLUDED.job_title,
        is_published = EXCLUDED.is_published
      RETURNING *`,
      [
        userId,
        input.slug ?? existing?.slug ?? "",
        input.fullName ?? existing?.fullName ?? "",
        input.headline ?? existing?.headline ?? null,
        input.company ?? existing?.company ?? null,
        input.location ?? existing?.location ?? null,
        input.bio ?? existing?.bio ?? null,
        input.avatarUrl ?? existing?.avatarUrl ?? null,
        input.email ?? existing?.email ?? null,
        input.phone ?? existing?.phone ?? null,
        input.websiteUrl ?? existing?.websiteUrl ?? null,
        input.linkedinUrl ?? existing?.linkedinUrl ?? null,
        input.xUrl ?? existing?.xUrl ?? null,
        input.department ?? existing?.department ?? null,
        input.jobTitle ?? existing?.jobTitle ?? null,
        input.isPublished ?? existing?.isPublished ?? false,
      ],
    );

    return mapProfile(result.rows[0]);
  }

  async getPublicProfile(slug: string) {
    const result = await this.databaseService.query(
      "SELECT * FROM profiles WHERE slug = $1 AND is_published = true",
      [slug],
    );
    if (result.rowCount === 0) return null;

    const profile = mapPublicProfile(result.rows[0]);
    await this.databaseService.query(
      "INSERT INTO analytics_events (profile_id, event_type, referrer, user_agent) VALUES ($1, 'profile_view', $2, $3)",
      [profile.id, null, null],
    );

    return profile;
  }

  async getVCard(slug: string) {
    const result = await this.databaseService.query(
      "SELECT * FROM profiles WHERE slug = $1 AND is_published = true",
      [slug],
    );
    if (result.rowCount === 0) return null;

    const profile = mapPublicProfile(result.rows[0]);
    await this.databaseService.query(
      "INSERT INTO analytics_events (profile_id, event_type, referrer, user_agent) VALUES ($1, 'vcard_download', $2, $3)",
      [profile.id, null, null],
    );

    return generateVCard(profile);
  }

  /** Captures a voluntary public-page introduction without accepting tenant identity from the visitor. */
  async capturePublicContact(
    slug: string,
    input: PublicContactCaptureInput,
  ): Promise<boolean> {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");
      const target = await client.query(
        `SELECT p.id AS profile_id, p.user_id, u.organization_id
         FROM profiles p JOIN users u ON u.id = p.user_id
         WHERE p.slug = $1 AND p.is_published = true FOR UPDATE`,
        [slug],
      );
      if (target.rowCount === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      const profile = target.rows[0] as Record<string, string | null>;
      const organizationId = profile.organization_id;
      const ownerUserId = profile.user_id!;
      const scope = organizationId
        ? "organization_id = $1"
        : "assigned_to_user_id = $1";
      const scopeValue = organizationId ?? ownerUserId;
      const existing = await client.query(
        `SELECT id FROM customers WHERE ${scope} AND (email = $2 OR phone = $3)
         ORDER BY CASE WHEN email = $2 THEN 0 ELSE 1 END, id ASC LIMIT 1 FOR UPDATE`,
        [scopeValue, input.email || null, input.phone || null],
      );
      let customerId: string;
      if (existing.rowCount) {
        customerId = existing.rows[0].id as string;
        await client.query(
          `UPDATE customers SET email = COALESCE(email, $1), phone = COALESCE(phone, $2),
           company = COALESCE(company, $3), last_contacted_at = now(), updated_at = now() WHERE id = $4`,
          [
            input.email || null,
            input.phone || null,
            input.company || null,
            customerId,
          ],
        );
      } else {
        const created = await client.query(
          `INSERT INTO customers (organization_id, assigned_to_user_id, full_name, email, phone, company, source, source_profile_id, source_user_id, lifecycle_stage)
           VALUES ($1, $2, $3, $4, $5, $6, 'manual', $7, $8, 'new') RETURNING id`,
          [
            organizationId,
            organizationId ? null : ownerUserId,
            input.fullName,
            input.email || null,
            input.phone || null,
            input.company || null,
            profile.profile_id,
            ownerUserId,
          ],
        );
        customerId = created.rows[0].id as string;
      }
      const safeMessage = input.message
        ? filterXSS(input.message, {
            whiteList: {},
            stripIgnoreTag: true,
            stripIgnoreTagBody: ["script"],
          })
        : "";
      const body = safeMessage
        ? `Introduced via public page. Message: ${safeMessage}`
        : "Introduced via public page.";
      await client.query(
        `INSERT INTO customer_activities (customer_id, created_by_user_id, type, title, body, occurred_at)
         VALUES ($1, $2, 'note', 'Public page introduction', $3, now())`,
        [customerId, ownerUserId, body],
      );
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
