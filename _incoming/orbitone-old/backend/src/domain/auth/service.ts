import bcrypt from "bcryptjs";
import type { Response } from "express";
import { pool } from "../../db/postgres.js";
import { clearSessionCookie, setSessionCookie, signSession } from "../../lib/auth.js";
import { makeUniqueProfileSlug } from "../../lib/slug.js";
import { mapUser } from "../../lib/mappers.js";
import type { LoginInput, RegisterInput, User } from "../../../../contracts/orbitone.v2.js";

export async function registerUser(input: RegisterInput, res: Response): Promise<User> {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const userResult = await client.query(
      "INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, 'freelancer') RETURNING id, email, full_name, role, plan, created_at, updated_at",
      [input.email, passwordHash, input.fullName]
    );
    const user = mapUser(userResult.rows[0]);
    const slug = await makeUniqueProfileSlug(input.fullName || input.email);

    await client.query(
      `INSERT INTO profiles (
        user_id, slug, full_name, email, type, is_published
      ) VALUES ($1, $2, $3, $4, 'personal', false)`,
      [user.id, slug, user.fullName, user.email]
    );

    await client.query("COMMIT");
    setSessionCookie(res, await signSession(user));
    return user;
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") {
      throw new AuthError("An account with this email already exists.", 409);
    }
    throw new AuthError("Could not create account.", 500);
  } finally {
    client.release();
  }
}

export async function loginUser(input: LoginInput, res: Response): Promise<User> {
  const result = await pool.query(
    "SELECT id, email, full_name, role, password_hash, organization_id, is_billing_contact, plan, created_at, updated_at FROM users WHERE email = $1",
    [input.email]
  );

  const row = result.rows[0];
  if (!row || !(await bcrypt.compare(input.password, row.password_hash))) {
    throw new AuthError("Invalid email or password.", 401);
  }

  const user = mapUser(row);
  setSessionCookie(res, await signSession(user));
  return user;
}

export function logoutUser(res: Response) {
  clearSessionCookie(res);
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}
