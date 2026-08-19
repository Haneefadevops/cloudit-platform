import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("AI recap usage migration", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../migrations/0021_ai_recap_usage.sql"),
    "utf8",
  ).toLowerCase();

  it("stores bounded operational metadata without private content columns", () => {
    expect(sql).toContain("create table if not exists ai_recap_usage");
    expect(sql).toContain("organization_id uuid not null");
    expect(sql).toContain("status in ('started','succeeded','failed')");
    expect(sql).toContain("audio_bytes integer not null");
    expect(sql).toContain("accepted_at timestamptz");
    expect(sql).not.toMatch(
      /\b(transcript|audio_data|audio_url|prompt|summary|private_note)\b/,
    );
  });

  it("indexes organization, user, and booking usage lookups", () => {
    expect(sql).toContain("ai_recap_usage_org_created_idx");
    expect(sql).toContain("ai_recap_usage_user_created_idx");
    expect(sql).toContain("ai_recap_usage_booking_idx");
  });
});
