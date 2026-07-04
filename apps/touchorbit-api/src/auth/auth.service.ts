import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { DatabaseService } from "../database/database.service";
import { SessionService } from "./session.service";

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SetPasswordInput {
  token: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
  ) {}

  async register(input: RegisterInput, res: Response) {
    const passwordHash = await bcrypt.hash(input.password, 12);
    const client = await this.databaseService.connect();

    try {
      await client.query("BEGIN");

      const orgSlug = this.slugify(input.organizationName);
      const orgResult = await client.query(
        `INSERT INTO organizations (name, slug)
         VALUES ($1, $2)
         RETURNING id, name, slug`,
        [input.organizationName, orgSlug],
      );
      const organization = orgResult.rows[0];

      const userResult = await client.query(
        `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, $5, 'owner')
         RETURNING id, email, first_name, last_name, role, organization_id`,
        [
          organization.id,
          input.email.toLowerCase().trim(),
          passwordHash,
          input.firstName.trim(),
          input.lastName.trim(),
        ],
      );
      const user = userResult.rows[0];

      await client.query("COMMIT");

      this.sessionService.setSessionCookie(
        res,
        await this.sessionService.signSession({
          id: user.id,
          email: user.email,
          fullName: `${user.first_name} ${user.last_name}`.trim(),
        }),
      );

      return {
        id: user.id,
        email: user.email,
        fullName: `${user.first_name} ${user.last_name}`.trim(),
        role: user.role,
        organizationId: user.organization_id,
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        },
      };
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

  async login(input: LoginInput, res: Response) {
    const result = await this.databaseService.query(
      `SELECT id, email, first_name, last_name, role, password_hash, organization_id, is_active
       FROM users
       WHERE email = $1`,
      [input.email.toLowerCase().trim()],
    );

    const row = result.rows[0];
    if (
      !row ||
      row.is_active === false ||
      !(await bcrypt.compare(input.password, row.password_hash || ""))
    ) {
      throw new AuthError("Invalid email or password.", 401);
    }

    this.sessionService.setSessionCookie(
      res,
      await this.sessionService.signSession({
        id: row.id,
        email: row.email,
        fullName: `${row.first_name} ${row.last_name}`.trim(),
      }),
    );

    return {
      id: row.id,
      email: row.email,
      fullName: `${row.first_name} ${row.last_name}`.trim(),
      role: row.role,
      organizationId: row.organization_id,
    };
  }

  async logout(req: Request, res: Response): Promise<void> {
    await this.sessionService.revokeSessionByCookie(req, res);
  }

  async setPassword(input: SetPasswordInput, res: Response) {
    const passwordHash = await bcrypt.hash(input.password, 12);
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");
      const inviteResult = await client.query(
        `SELECT t.*, o.platform_org_id
         FROM user_invite_tokens t
         JOIN organizations o ON o.id = t.organization_id
         WHERE t.token = $1 AND t.used_at IS NULL AND t.expires_at > now()
         FOR UPDATE`,
        [input.token],
      );
      if (inviteResult.rowCount === 0) {
        throw new AuthError("Invalid or expired invite token.", 400);
      }

      const invite = inviteResult.rows[0];
      const userResult = await client.query(
        `UPDATE users
         SET password_hash = $1, is_active = true, updated_at = now()
         WHERE id = $2
         RETURNING id, email, first_name, last_name, role, organization_id`,
        [passwordHash, invite.user_id],
      );
      const user = userResult.rows[0];

      await client.query(
        "UPDATE user_invite_tokens SET used_at = now() WHERE id = $1",
        [invite.id],
      );
      await client.query("COMMIT");

      const sessionUser = {
        id: user.id,
        email: user.email,
        fullName: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
      };
      this.sessionService.setSessionCookie(
        res,
        await this.sessionService.signSession(sessionUser),
      );

      await this.notifyPlatformInviteAccepted({
        platformOrgId: invite.platform_org_id,
        tenantId: user.organization_id,
        userId: user.id,
        email: user.email,
      });

      return {
        id: user.id,
        email: user.email,
        fullName: sessionUser.fullName,
        role: user.role,
        organizationId: user.organization_id,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (error instanceof AuthError) throw error;
      throw new AuthError("Could not set password.", 500);
    } finally {
      client.release();
    }
  }

  private async notifyPlatformInviteAccepted(input: {
    platformOrgId?: string;
    tenantId: string;
    userId: string;
    email: string;
  }): Promise<void> {
    const platformApiUrl = this.configService.get<string>("PLATFORM_API_URL");
    const internalToken = this.configService.get<string>("INTERNAL_API_TOKEN");
    if (!platformApiUrl || !internalToken || !input.platformOrgId) return;

    await axios
      .post(
        `${platformApiUrl.replace(/\/$/, "")}/onboarding/internal/invite-accepted`,
        {
          platformOrgId: input.platformOrgId,
          product: "touchorbit",
          tenantId: input.tenantId,
          userId: input.userId,
          email: input.email,
        },
        {
          headers: {
            "x-internal-token": internalToken,
            Authorization: `Bearer ${internalToken}`,
          },
          timeout: 10000,
        },
      )
      .catch(() => undefined);
  }

  private slugify(value: string): string {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);
    return slug.length >= 3 ? slug : `org-${slug || "default"}`;
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
