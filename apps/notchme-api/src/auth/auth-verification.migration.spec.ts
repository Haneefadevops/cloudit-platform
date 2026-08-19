import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("auth verification migration", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../migrations/0024_auth_verification_recovery.sql"),
    "utf8",
  ).toLowerCase();

  it("backfills existing accounts and stores only expiring token hashes", () => {
    expect(sql).toContain("email_verified_at");
    expect(sql).toContain("set email_verified_at = coalesce");
    expect(sql).toContain("token_hash text not null unique");
    expect(sql).toContain("expires_at timestamptz not null");
    expect(sql).not.toContain(" token text");
  });
});
