import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import pg from "pg";

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: pg.Pool;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.configService.get<string>("DATABASE_URL");
    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured");
    }
    this.pool = new pg.Pool({ connectionString });
  }

  get client(): pg.Pool {
    return this.pool;
  }

  query<R extends pg.QueryResultRow = any>(
    text: string,
    values?: unknown[],
  ): Promise<pg.QueryResult<R>> {
    return this.pool.query<R>(text, values);
  }

  async connect(): Promise<pg.PoolClient> {
    return this.pool.connect();
  }

  async check(): Promise<boolean> {
    const result = await this.pool.query<{ ok: number }>("SELECT 1 AS ok");
    return result.rows[0]?.ok === 1;
  }

  onModuleDestroy() {
    return this.pool.end();
  }
}
