import { Injectable, Logger } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { Request, Response } from "express";
import { DatabaseService } from "../database/database.service";
import { SessionService } from "./session.service";
import { SlugService } from "../common/lib/slug.service";
import { mapUser } from "../common/lib/mappers";
import {
  RegisterInput,
  LoginInput,
  User,
} from "../common/contracts/notchme.v2";
import { TransactionalEmailService } from "./transactional-email.service";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly sessionService: SessionService,
    private readonly slugService: SlugService,
    private readonly email: TransactionalEmailService,
  ) {}

  async register(input: RegisterInput, res: Response): Promise<User> {
    if (this.email.verificationRequired() && !this.email.enabled()) {
      throw new AuthError("Registration is temporarily unavailable.", 503);
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    const client = await this.databaseService.connect();

    try {
      await client.query("BEGIN");
      const userResult = await client.query(
        "INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, 'freelancer') RETURNING id, email, full_name, role, plan, email_verified_at, created_at, updated_at",
        [input.email, passwordHash, input.fullName],
      );
      const user = mapUser(userResult.rows[0]);
      const slug = await this.slugService.makeUniqueProfileSlug(
        input.fullName || input.email,
      );

      await client.query(
        `INSERT INTO profiles (
          user_id, slug, full_name, email, type, is_published
        ) VALUES ($1, $2, $3, $4, 'personal', false)`,
        [user.id, slug, user.fullName, user.email],
      );

      await client.query("COMMIT");
      this.sessionService.setSessionCookie(
        res,
        await this.sessionService.signSession(user),
      );
      if (this.email.enabled()) {
        await this.issueEmailVerification(user).catch(() => {
          this.logger.warn(`Verification delivery failed for user ${user.id}`);
        });
      }
      return user;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if ((error as { code?: string }).code === "23505") {
        throw new AuthError("An account with this email already exists.", 409);
      }
      throw new AuthError("Could not create account.", 500);
    } finally {
      client.release();
    }
  }

  async login(input: LoginInput, res: Response): Promise<User> {
    const result = await this.databaseService.query(
      "SELECT id, email, full_name, role, password_hash, organization_id, is_billing_contact, plan, email_verified_at, created_at, updated_at FROM users WHERE email = $1",
      [input.email],
    );

    const row = result.rows[0];
    if (!row || !(await bcrypt.compare(input.password, row.password_hash))) {
      throw new AuthError("Invalid email or password.", 401);
    }

    const user = mapUser(row);
    this.sessionService.setSessionCookie(
      res,
      await this.sessionService.signSession(user),
    );
    return user;
  }

  async logout(req: Request, res: Response): Promise<void> {
    await this.sessionService.revokeSessionByCookie(req as any, res);
  }

  verificationRequired(): boolean {
    return this.email.verificationRequired();
  }

  emailDeliveryEnabled(): boolean {
    return this.email.enabled();
  }

  async requestPasswordReset(email: string): Promise<void> {
    const result = await this.databaseService.query<{
      id: string;
      email: string;
      full_name: string;
    }>("SELECT id, email, full_name FROM users WHERE email = $1", [email]);
    const user = result.rows[0];
    if (!user || !this.email.enabled()) return;
    await this.issueToken(user.id, "password_reset", 60 * 60, async (token) =>
      this.email.sendPasswordReset(user.email, user.full_name, token),
    ).catch(() => {
      this.logger.warn(`Password reset delivery failed for user ${user.id}`);
    });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const passwordHash = await bcrypt.hash(password, 12);
    const client = await this.databaseService.connect();
    let userId: string;
    try {
      await client.query("BEGIN");
      const result = await client.query<{ id: string; user_id: string }>(
        `SELECT id, user_id FROM auth_action_tokens
         WHERE token_hash = $1 AND type = 'password_reset'
           AND consumed_at IS NULL AND expires_at > now()
         FOR UPDATE`,
        [tokenHash],
      );
      const action = result.rows[0];
      if (!action)
        throw new AuthError("This reset link is invalid or expired.", 400);
      userId = action.user_id;
      await client.query(
        "UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1",
        [userId, passwordHash],
      );
      await client.query(
        "UPDATE auth_action_tokens SET consumed_at = now() WHERE id = $1",
        [action.id],
      );
      await client.query(
        `UPDATE auth_action_tokens SET consumed_at = now()
         WHERE user_id = $1 AND type = 'password_reset' AND consumed_at IS NULL`,
        [userId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await this.sessionService.revokeAllUserSessions(userId);
  }

  async requestEmailVerification(userId: string): Promise<void> {
    if (!this.email.enabled()) {
      throw new AuthError("Email verification is not configured.", 503);
    }
    const result = await this.databaseService.query<{
      id: string;
      email: string;
      full_name: string;
      email_verified_at: Date | null;
    }>(
      "SELECT id, email, full_name, email_verified_at FROM users WHERE id = $1",
      [userId],
    );
    const user = result.rows[0];
    if (!user || user.email_verified_at) return;
    await this.issueEmailVerification({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ id: string; user_id: string }>(
        `SELECT id, user_id FROM auth_action_tokens
         WHERE token_hash = $1 AND type = 'email_verification'
           AND consumed_at IS NULL AND expires_at > now()
         FOR UPDATE`,
        [this.hashToken(token)],
      );
      const action = result.rows[0];
      if (!action) {
        throw new AuthError(
          "This verification link is invalid or expired.",
          400,
        );
      }
      await client.query(
        "UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now() WHERE id = $1",
        [action.user_id],
      );
      await client.query(
        `UPDATE auth_action_tokens SET consumed_at = now()
         WHERE user_id = $1 AND type = 'email_verification' AND consumed_at IS NULL`,
        [action.user_id],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async issueEmailVerification(user: {
    id: string;
    email: string;
    fullName: string;
  }) {
    await this.issueToken(
      user.id,
      "email_verification",
      24 * 60 * 60,
      async (token) =>
        this.email.sendVerification(user.email, user.fullName, token),
    );
  }

  private async issueToken(
    userId: string,
    type: "email_verification" | "password_reset",
    ttlSeconds: number,
    deliver: (token: string) => Promise<void>,
  ) {
    const token = randomBytes(32).toString("base64url");
    const hash = this.hashToken(token);
    await this.databaseService.query(
      `UPDATE auth_action_tokens SET consumed_at = now()
       WHERE user_id = $1 AND type = $2 AND consumed_at IS NULL`,
      [userId, type],
    );
    const inserted = await this.databaseService.query<{ id: string }>(
      `INSERT INTO auth_action_tokens (user_id, type, token_hash, expires_at)
       VALUES ($1,$2,$3,now() + ($4 * interval '1 second')) RETURNING id`,
      [userId, type, hash, ttlSeconds],
    );
    try {
      await deliver(token);
    } catch (error) {
      await this.databaseService.query(
        "DELETE FROM auth_action_tokens WHERE id = $1",
        [inserted.rows[0]?.id],
      );
      throw error;
    }
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
