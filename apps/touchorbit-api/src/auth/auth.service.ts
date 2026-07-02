import { Injectable } from "@nestjs/common";
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

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly sessionService: SessionService,
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
      `SELECT id, email, first_name, last_name, role, password_hash, organization_id
       FROM users
       WHERE email = $1`,
      [input.email.toLowerCase().trim()],
    );

    const row = result.rows[0];
    if (!row || !(await bcrypt.compare(input.password, row.password_hash))) {
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
