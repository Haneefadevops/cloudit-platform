OrbitOne deployment uses the custom SQL migrations in `apps/orbitone-api/migrations`.

Do not add Prisma migration files here unless the deployment path is switched back
to `prisma migrate deploy`. Running both systems against the same database creates
duplicate core tables such as `users` and `organizations`.
