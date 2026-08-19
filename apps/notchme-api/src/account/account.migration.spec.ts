import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("account control migration", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../migrations/0023_account_control.sql"),
    "utf8",
  ).toLowerCase();

  it("allows billing history to survive an account erasure without identity FKs", () => {
    expect(sql).toContain("alter column organization_id drop not null");
    expect(sql).toContain("alter column owner_user_id drop not null");
    expect(sql.match(/on delete set null/g)).toHaveLength(2);
  });
});
