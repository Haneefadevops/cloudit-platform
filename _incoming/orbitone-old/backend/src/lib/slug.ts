import { pool } from "../db/postgres.js";

export function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  return slug.length >= 3 ? slug : `user-${slug || "profile"}`;
}

export async function makeUniqueProfileSlug(baseValue: string) {
  const baseSlug = slugify(baseValue);

  for (let index = 0; index < 100; index += 1) {
    const slug = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    const result = await pool.query("SELECT 1 FROM profiles WHERE slug = $1", [slug]);
    if (result.rowCount === 0) return slug;
  }

  return `${baseSlug}-${Date.now()}`;
}

export async function makeUniqueOrganizationSlug(baseValue: string) {
  const baseSlug = slugify(baseValue);

  for (let index = 0; index < 100; index += 1) {
    const slug = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    const result = await pool.query("SELECT 1 FROM organizations WHERE slug = $1", [slug]);
    if (result.rowCount === 0) return slug;
  }

  return `${baseSlug}-${Date.now()}`;
}
