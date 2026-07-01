import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class TrainingService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT id, title, description, category, total_hours, is_mandatory, created_at
       FROM training_programs
       WHERE organization_id = $1::uuid
       ORDER BY created_at DESC`,
      [organizationId],
    );
    return result.rows;
  }

  async findByEmployee(
    organizationId: string,
    employeeId: string,
    start?: string,
    end?: string,
  ) {
    const rangeCond = start && end
      ? ` AND ((et.start_date <= $3::date AND et.end_date >= $2::date) OR (ta.start_date <= $3::date AND ta.end_date >= $2::date))`
      : "";
    const values: unknown[] = [organizationId, employeeId];
    if (start && end) {
      values.push(start, end);
    }
    const [selfRes, assignedRes] = await Promise.all([
      this.databaseService.query(
        `SELECT et.id, et.employee_id, et.training_name AS title, et.description,
                et.start_date, et.end_date, 'self' AS source
         FROM employee_training et
         WHERE et.organization_id = $1::uuid AND et.employee_id = $2::uuid${rangeCond}`,
        values,
      ),
      this.databaseService.query(
        `SELECT ta.id, ta.employee_id, tp.title, tp.description,
                ta.start_date, ta.end_date, 'assigned' AS source
         FROM training_assignments ta
         JOIN training_programs tp ON tp.id = ta.program_id
         WHERE ta.organization_id = $1::uuid AND ta.employee_id = $2::uuid
           AND ta.status <> 'cancelled'${rangeCond}`,
        values,
      ),
    ]);
    return [...selfRes.rows, ...assignedRes.rows];
  }
}
