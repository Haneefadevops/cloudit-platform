import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class OrganizationsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(_organizationId: string) {
    return [];
  }

  async findBranches(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT id, name, code, is_active
       FROM branches
       WHERE organization_id = $1::uuid AND is_active = true
       ORDER BY name`,
      [organizationId],
    );
    return result.rows;
  }

  async findDepartments(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT id, name, code, is_active
       FROM departments
       WHERE organization_id = $1::uuid AND is_active = true
       ORDER BY name`,
      [organizationId],
    );
    return result.rows;
  }
}
