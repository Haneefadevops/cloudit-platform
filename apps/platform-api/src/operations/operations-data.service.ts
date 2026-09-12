import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { operationsConfig } from './operations.config';

/**
 * Read-only data access for the private `operations` database.
 *
 * Every query runs inside an explicit transaction that first executes
 * `SET LOCAL operations.global_role = 'cloud_owner';` — without it the
 * fail-closed RLS policies in migration 0003 return zero rows. Only SELECT
 * statements are ever issued through this service.
 */
@Injectable()
export class OperationsDataService implements OnModuleDestroy {
  private readonly logger = new Logger(OperationsDataService.name);
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: operationsConfig.db.host,
      port: operationsConfig.db.port,
      database: operationsConfig.db.database,
      user: operationsConfig.db.user,
      password: operationsConfig.db.password,
      // Schema-qualify everything in SQL anyway; this is a second safety net.
      options: '-c search_path=operations',
      statement_timeout: operationsConfig.statementTimeoutMs,
      // This module is strictly read-only; no write workload is expected.
      max: 5,
    });
    this.pool.on('error', (err: Error) => {
      // Idle client errors must not crash the process.
      this.logger.error(
        `operations pool client error: ${err.message}`,
        OperationsDataService.name,
      );
    });
  }

  /**
   * Run a read-only query inside the RLS-context transaction. The SQL text
   * is always a literal in this module; `values` are bound parameters.
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ): Promise<QueryResult<T>> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL operations.global_role = 'cloud_owner'");
      const result = await client.query<T>(text, values);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Connection is likely broken; the pool will replace the client.
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
