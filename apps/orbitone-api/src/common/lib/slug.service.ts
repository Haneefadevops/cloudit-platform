import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";

@Injectable()
export class SlugService {
  constructor(private readonly databaseService: DatabaseService) {}

  slugify(value: string): string {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);

    return slug.length >= 3 ? slug : `user-${slug || "profile"}`;
  }

  async makeUniqueProfileSlug(baseValue: string): Promise<string> {
    const baseSlug = this.slugify(baseValue);

    for (let index = 0; index < 100; index += 1) {
      const slug = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
      const result = await this.databaseService.query(
        "SELECT 1 FROM profiles WHERE slug = $1",
        [slug],
      );
      if (result.rowCount === 0) return slug;
    }

    return `${baseSlug}-${Date.now()}`;
  }

  async makeUniqueOrganizationSlug(baseValue: string): Promise<string> {
    const baseSlug = this.slugify(baseValue);

    for (let index = 0; index < 100; index += 1) {
      const slug = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
      const result = await this.databaseService.query(
        "SELECT 1 FROM organizations WHERE slug = $1",
        [slug],
      );
      if (result.rowCount === 0) return slug;
    }

    return `${baseSlug}-${Date.now()}`;
  }
}
