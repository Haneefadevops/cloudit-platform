import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class AnnouncementsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT id, organization_id, author_id, title, content, priority, created_at, updated_at
       FROM announcements
       WHERE organization_id = $1::uuid
       ORDER BY created_at DESC`,
      [organizationId],
    );
    return result.rows;
  }

  async create(
    organizationId: string,
    authorId: string,
    input: { title: string; content: string; priority: string },
  ) {
    const result = await this.databaseService.query(
      `INSERT INTO announcements (
         organization_id, author_id, title, content, priority
       ) VALUES ($1::uuid, $2::uuid, $3, $4, $5)
       RETURNING *`,
      [organizationId, authorId, input.title, input.content, input.priority],
    );
    return result.rows[0];
  }

  async remove(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `DELETE FROM announcements
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING id`,
      [id, organizationId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Announcement not found");
    }
    return result.rows[0];
  }
}
