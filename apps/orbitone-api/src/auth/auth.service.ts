import { Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { DatabaseService } from "../database/database.service";
import { SessionService } from "./session.service";
import { SlugService } from "../common/lib/slug.service";
import { mapUser } from "../common/lib/mappers";
import {
  RegisterInput,
  LoginInput,
  User,
} from "../common/contracts/orbitone.v2";

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly sessionService: SessionService,
    private readonly slugService: SlugService,
  ) {}

  async register(input: RegisterInput, res: Response): Promise<User> {
    const passwordHash = await bcrypt.hash(input.password, 12);
    const client = await this.databaseService.connect();

    try {
      await client.query("BEGIN");
      const userResult = await client.query(
        "INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, 'freelancer') RETURNING id, email, full_name, role, plan, created_at, updated_at",
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
      "SELECT id, email, full_name, role, password_hash, organization_id, is_billing_contact, plan, created_at, updated_at FROM users WHERE email = $1",
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
