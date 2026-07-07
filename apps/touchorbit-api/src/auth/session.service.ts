import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Response, Request } from "express";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { RedisService } from "../redis/redis.service";
import { DatabaseService } from "../database/database.service";
import { AuthContext, JwtPayload, SessionUser } from "./types";

export const authCookieName = "touchorbit_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly databaseService: DatabaseService,
  ) {}

  private get jwtSecret(): string {
    return this.configService.getOrThrow<string>("JWT_SECRET");
  }

  private isProduction(): boolean {
    return this.configService.get<string>("NODE_ENV") === "production";
  }

  get cookieDomain(): string | undefined {
    const raw = this.configService.get<string>("SESSION_COOKIE_DOMAIN")?.trim();
    let configuredDomain = raw;

    // Guard against unexpanded shell variable syntax like ${DOMAIN:-cloudit.lk}
    // which dotenv / Node will not expand.
    if (configuredDomain && configuredDomain.includes("${")) {
      this.logger.error(
        `SESSION_COOKIE_DOMAIN contains unexpanded variable: ${configuredDomain}. Falling back to .cloudit.lk`,
      );
      configuredDomain = undefined;
    }

    if (configuredDomain) {
      const domain = configuredDomain.startsWith(".")
        ? configuredDomain
        : `.${configuredDomain}`;
      return domain;
    }
    return this.isProduction() ? ".cloudit.lk" : undefined;
  }

  private sessionKey(sid: string): string {
    return `touchorbit:session:${sid}`;
  }

  private userSessionsKey(userId: string): string {
    return `touchorbit:user_sessions:${userId}`;
  }

  async signSession(user: SessionUser): Promise<string> {
    const sid = randomUUID();
    const token = jwt.sign(
      { sub: user.id, email: user.email, sid },
      this.jwtSecret,
      { expiresIn: "7d" },
    );

    const pipeline = this.redisService.client.pipeline();
    pipeline.set(
      this.sessionKey(sid),
      JSON.stringify(user),
      "EX",
      SESSION_TTL_SECONDS,
    );
    pipeline.sadd(this.userSessionsKey(user.id), sid);
    pipeline.expire(this.userSessionsKey(user.id), SESSION_TTL_SECONDS);
    await pipeline.exec();

    return token;
  }

  async canReadSessionToken(token: string): Promise<boolean> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;
      const sessionData = await this.redisService.client.get(
        this.sessionKey(payload.sid),
      );
      return !!sessionData;
    } catch (error) {
      this.logger.error(
        "Session read-back verification failed",
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  setSessionCookie(res: Response, token: string): void {
    res.cookie(authCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.isProduction(),
      maxAge: SESSION_TTL_SECONDS * 1000,
      path: "/",
      domain: this.cookieDomain,
    });
  }

  clearSessionCookie(res: Response): void {
    res.clearCookie(authCookieName, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.isProduction(),
      path: "/",
      domain: this.cookieDomain,
    });
  }

  clearSessionCookiesForDomains(
    res: Response,
    domains: (string | undefined)[],
  ): void {
    for (const domain of domains) {
      if (!domain) continue;
      res.clearCookie(authCookieName, {
        httpOnly: true,
        sameSite: "lax",
        secure: this.isProduction(),
        path: "/",
        domain,
      });
    }
  }

  async revokeSessionByCookie(req: Request, res: Response): Promise<void> {
    const token = this.getCookie(req.headers.cookie, authCookieName);
    if (token) {
      try {
        const payload = jwt.decode(token) as JwtPayload | null;
        if (payload?.sid) {
          const pipeline = this.redisService.client.pipeline();
          pipeline.del(this.sessionKey(payload.sid));
          pipeline.srem(this.userSessionsKey(payload.sub), payload.sid);
          await pipeline.exec();
        }
      } catch {
        // Ignore decode errors during revocation.
      }
    }
    this.clearSessionCookie(res);
  }

  async getAuthUser(req: Request): Promise<SessionUser | null> {
    const token = this.getCookie(req.headers.cookie, authCookieName);
    if (!token) return null;

    try {
      const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;
      const sessionData = await this.redisService.client.get(
        this.sessionKey(payload.sid),
      );
      if (!sessionData) return null;

      const user = JSON.parse(sessionData) as SessionUser;
      await this.redisService.client.expire(
        this.sessionKey(payload.sid),
        SESSION_TTL_SECONDS,
      );
      return user;
    } catch {
      return null;
    }
  }

  async getAuthUserWithOrg(req: Request): Promise<AuthContext | null> {
    const user = await this.getAuthUser(req);
    if (!user) return null;

    const result = await this.databaseService.query(
      `SELECT
         u.id, u.email, u.first_name, u.last_name, u.role, u.organization_id,
         o.id AS org_id, o.slug AS org_slug, o.name AS org_name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = $1::uuid`,
      [user.id],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      fullName:
        `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || row.email,
      role: row.role,
      organizationId: row.organization_id,
      organization: row.org_id
        ? {
            id: row.org_id,
            slug: row.org_slug,
            name: row.org_name,
          }
        : null,
    };
  }

  getCookie(cookieHeader: string | undefined, name: string): string | null {
    if (!cookieHeader) return null;
    const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
    const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
  }
}
