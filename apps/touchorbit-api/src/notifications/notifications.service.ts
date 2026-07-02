import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(organizationId: string, userId: string) {
    const result = await this.databaseService.query(
      `SELECT *
       FROM notifications
       WHERE organization_id = $1::uuid
         AND user_id = $2::uuid
       ORDER BY created_at DESC
       LIMIT 50`,
      [organizationId, userId],
    );
    return result.rows;
  }

  async markRead(organizationId: string, userId: string, id: string) {
    const result = await this.databaseService.query(
      `UPDATE notifications
       SET read = true
       WHERE id = $1::uuid
         AND organization_id = $2::uuid
         AND user_id = $3::uuid
       RETURNING *`,
      [id, organizationId, userId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Notification not found");
    }
    return result.rows[0];
  }

  async delete(organizationId: string, userId: string, id: string) {
    const result = await this.databaseService.query(
      `DELETE FROM notifications
       WHERE id = $1::uuid
         AND organization_id = $2::uuid
         AND user_id = $3::uuid
       RETURNING id`,
      [id, organizationId, userId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Notification not found");
    }
    return { deleted: true, id: result.rows[0].id };
  }

  async upsertPreferences(
    organizationId: string,
    userId: string,
    preferences: Array<{
      notificationType: string;
      emailEnabled: boolean;
      pushEnabled: boolean;
    }>,
  ) {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const rows: unknown[] = [];
      for (const preference of preferences) {
        const result = await client.query(
          `INSERT INTO notification_preferences (
             organization_id, user_id, notification_type, email_enabled, push_enabled
           )
           VALUES ($1::uuid, $2::uuid, $3, $4, $5)
           ON CONFLICT (user_id, notification_type) DO UPDATE
           SET organization_id = EXCLUDED.organization_id,
               email_enabled = EXCLUDED.email_enabled,
               push_enabled = EXCLUDED.push_enabled,
               updated_at = now()
           RETURNING *`,
          [
            organizationId,
            userId,
            preference.notificationType,
            preference.emailEnabled,
            preference.pushEnabled,
          ],
        );
        rows.push(result.rows[0]);
      }

      await client.query("COMMIT");
      return rows;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
