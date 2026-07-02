import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { mapProfile, mapPublicProfile } from "../common/lib/mappers";
import { generateVCard } from "./vcard.helper";
import type { ProfileInput } from "./profiles.schemas";

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
}
