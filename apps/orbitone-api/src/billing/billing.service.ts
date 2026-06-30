import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { mapUser } from "../common/lib/mappers";
import type { Plan, User } from "../common/contracts/orbitone.v2";

@Injectable()
export class BillingService {
  constructor(private readonly databaseService: DatabaseService) {}

  async upgradeUserPlan(userId: string, plan: Plan): Promise<User> {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const userResult = await client.query(
        "UPDATE users SET plan = $1, updated_at = now() WHERE id = $2 RETURNING *",
        [plan, userId],
      );

      if (userResult.rowCount === 0) {
        throw new BillingError("User not found.", 404);
      }

      const user = mapUser(userResult.rows[0]);
      const profileResult = await client.query(
        "SELECT id FROM profiles WHERE user_id = $1",
        [userId],
      );
      const profileId = profileResult.rows[0]?.id;

      if (profileId) {
        await client.query(
          "INSERT INTO analytics_events (profile_id, event_type, visitor_id, referrer, user_agent) VALUES ($1, 'plan_upgraded', $2, $3, $4)",
          [profileId, null, null, null],
        );
      }

      await client.query("COMMIT");
      return user;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

export class BillingError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "BillingError";
  }
}
