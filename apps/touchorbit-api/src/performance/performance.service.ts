import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class PerformanceService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Review cycles
  async findCycles(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT * FROM performance_review_cycles
       WHERE organization_id = $1::uuid
       ORDER BY created_at DESC`,
      [organizationId],
    );
    return result.rows;
  }

  async createCycle(
    organizationId: string,
    input: {
      title: string;
      start_date: string;
      end_date: string;
      status?: string;
    },
  ) {
    const result = await this.databaseService.query(
      `INSERT INTO performance_review_cycles (organization_id, title, start_date, end_date, status)
       VALUES ($1::uuid, $2, $3::date, $4::date, $5)
       RETURNING *`,
      [
        organizationId,
        input.title,
        input.start_date,
        input.end_date,
        input.status ?? "draft",
      ],
    );
    return result.rows[0];
  }

  // Reviews
  async findReviews(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT pr.*,
              jsonb_build_object('id', e.id, 'first_name', e.first_name, 'last_name', e.last_name, 'job_title', e.job_title) AS employee
       FROM performance_reviews pr
       JOIN employees e ON e.id = pr.employee_id
       WHERE pr.organization_id = $1::uuid
       ORDER BY pr.created_at DESC`,
      [organizationId],
    );
    return result.rows;
  }

  async findReviewsByEmployee(organizationId: string, employeeId: string) {
    const result = await this.databaseService.query(
      `SELECT * FROM performance_reviews
       WHERE organization_id = $1::uuid AND employee_id = $2::uuid
       ORDER BY created_at DESC`,
      [organizationId, employeeId],
    );
    return result.rows;
  }

  async createReview(
    organizationId: string,
    input: {
      employee_id: string;
      cycle_id?: string | null;
      review_period_start?: string | null;
      review_period_end?: string | null;
      overall_score?: number | null;
      attendance_score?: number | null;
      punctuality_score?: number | null;
      productivity_score?: number | null;
      teamwork_score?: number | null;
      notes?: string | null;
      status?: string;
    },
  ) {
    const result = await this.databaseService.query(
      `INSERT INTO performance_reviews (
        organization_id, employee_id, cycle_id, review_period_start, review_period_end,
        overall_score, attendance_score, punctuality_score, productivity_score, teamwork_score,
        notes, status
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::date, $5::date, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        organizationId,
        input.employee_id,
        input.cycle_id ?? null,
        input.review_period_start ?? null,
        input.review_period_end ?? null,
        input.overall_score ?? null,
        input.attendance_score ?? null,
        input.punctuality_score ?? null,
        input.productivity_score ?? null,
        input.teamwork_score ?? null,
        input.notes ?? null,
        input.status ?? "pending_self",
      ],
    );
    return result.rows[0];
  }

  async submitSelfReview(
    organizationId: string,
    id: string,
    input: { self_rating: number; self_comments?: string | null },
  ) {
    const result = await this.databaseService.query(
      `UPDATE performance_reviews
       SET self_rating = $3,
           self_comments = COALESCE($4, self_comments),
           status = 'pending_manager',
           self_submitted_at = now()
       WHERE id = $1::uuid AND organization_id = $2::uuid AND status = 'pending_self'
       RETURNING *`,
      [id, organizationId, input.self_rating, input.self_comments ?? null],
    );
    if (result.rows.length === 0) {
      throw new BadRequestException("Review not found or not pending self-review");
    }
    return result.rows[0];
  }

  async submitManagerReview(
    organizationId: string,
    id: string,
    input: {
      manager_rating: number;
      manager_comments?: string | null;
      final_rating?: number | null;
      improvement_plan?: string | null;
      status?: string;
    },
  ) {
    const result = await this.databaseService.query(
      `UPDATE performance_reviews
       SET manager_rating = $3,
           manager_comments = COALESCE($4, manager_comments),
           final_rating = COALESCE($5, final_rating),
           improvement_plan = COALESCE($6, improvement_plan),
           status = COALESCE($7, status),
           updated_at = now()
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      [
        id,
        organizationId,
        input.manager_rating,
        input.manager_comments ?? null,
        input.final_rating ?? null,
        input.improvement_plan ?? null,
        input.status ?? "completed",
      ],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Review not found");
    }
    return result.rows[0];
  }

  // Goals
  async findGoals(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT eg.*,
              jsonb_build_object('id', e.id, 'first_name', e.first_name, 'last_name', e.last_name) AS employee
       FROM employee_goals eg
       JOIN employees e ON e.id = eg.employee_id
       WHERE eg.organization_id = $1::uuid
       ORDER BY eg.created_at DESC`,
      [organizationId],
    );
    return result.rows;
  }

  async createGoal(
    organizationId: string,
    input: {
      employee_id: string;
      title: string;
      description?: string | null;
      kpi_metric: string;
      target_value: number;
      target_date?: string | null;
      status?: string;
    },
  ) {
    const result = await this.databaseService.query(
      `INSERT INTO employee_goals (
        organization_id, employee_id, title, description, kpi_metric, target_value, target_date, status
      ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::date, $8)
      RETURNING *`,
      [
        organizationId,
        input.employee_id,
        input.title,
        input.description ?? null,
        input.kpi_metric,
        input.target_value,
        input.target_date ?? null,
        input.status ?? "active",
      ],
    );
    return result.rows[0];
  }

  async updateGoal(
    organizationId: string,
    id: string,
    input: Partial<{
      employee_id: string;
      title: string;
      description: string | null;
      kpi_metric: string;
      target_value: number;
      current_value: number;
      target_date: string | null;
      status: string;
    }>,
  ) {
    const result = await this.databaseService.query(
      `UPDATE employee_goals
       SET employee_id = COALESCE($3::uuid, employee_id),
           title = COALESCE($4, title),
           description = COALESCE($5, description),
           kpi_metric = COALESCE($6, kpi_metric),
           target_value = COALESCE($7, target_value),
           current_value = COALESCE($8, current_value),
           target_date = COALESCE($9::date, target_date),
           status = COALESCE($10, status),
           updated_at = now()
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      [
        id,
        organizationId,
        input.employee_id ?? null,
        input.title ?? null,
        input.description ?? null,
        input.kpi_metric ?? null,
        input.target_value ?? null,
        input.current_value ?? null,
        input.target_date ?? null,
        input.status ?? null,
      ],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Goal not found");
    }
    return result.rows[0];
  }

  async deleteGoal(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `DELETE FROM employee_goals WHERE id = $1::uuid AND organization_id = $2::uuid RETURNING id`,
      [id, organizationId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Goal not found");
    }
    return { id: result.rows[0].id };
  }

  // Skills
  async findSkills(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT es.*,
              jsonb_build_object('id', e.id, 'first_name', e.first_name, 'last_name', e.last_name) AS employee
       FROM employee_skills es
       JOIN employees e ON e.id = es.employee_id
       WHERE es.organization_id = $1::uuid
       ORDER BY es.created_at DESC`,
      [organizationId],
    );
    return result.rows;
  }

  async createSkill(
    organizationId: string,
    input: {
      employee_id: string;
      skill_name: string;
      category?: string;
      proficiency_level?: number;
    },
  ) {
    const result = await this.databaseService.query(
      `INSERT INTO employee_skills (organization_id, employee_id, skill_name, category, proficiency_level)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5)
       RETURNING *`,
      [
        organizationId,
        input.employee_id,
        input.skill_name,
        input.category ?? "technical",
        input.proficiency_level ?? 1,
      ],
    );
    return result.rows[0];
  }

  async updateSkill(
    organizationId: string,
    id: string,
    input: Partial<{
      employee_id: string;
      skill_name: string;
      category: string;
      proficiency_level: number;
    }>,
  ) {
    const result = await this.databaseService.query(
      `UPDATE employee_skills
       SET employee_id = COALESCE($3::uuid, employee_id),
           skill_name = COALESCE($4, skill_name),
           category = COALESCE($5, category),
           proficiency_level = COALESCE($6, proficiency_level)
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      [
        id,
        organizationId,
        input.employee_id ?? null,
        input.skill_name ?? null,
        input.category ?? null,
        input.proficiency_level ?? null,
      ],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Skill not found");
    }
    return result.rows[0];
  }

  async deleteSkill(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `DELETE FROM employee_skills WHERE id = $1::uuid AND organization_id = $2::uuid RETURNING id`,
      [id, organizationId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Skill not found");
    }
    return { id: result.rows[0].id };
  }

  async overview(organizationId: string) {
    const [reviewsRes, cyclesRes, goalsRes] = await Promise.all([
      this.databaseService.query(
        `SELECT status FROM performance_reviews WHERE organization_id = $1::uuid`,
        [organizationId],
      ),
      this.databaseService.query(
        `SELECT COUNT(*)::int AS count FROM performance_review_cycles WHERE organization_id = $1::uuid AND status = 'active'`,
        [organizationId],
      ),
      this.databaseService.query(
        `SELECT COUNT(*)::int AS count FROM employee_goals WHERE organization_id = $1::uuid AND status = 'active'`,
        [organizationId],
      ),
    ]);
    let pendingSelf = 0,
      pendingManager = 0;
    for (const r of reviewsRes.rows) {
      if (r.status === "pending_self") pendingSelf++;
      else if (r.status === "pending_manager") pendingManager++;
    }
    return {
      activeCycles: cyclesRes.rows[0]?.count ?? 0,
      pendingSelf,
      pendingManager,
      activeGoals: goalsRes.rows[0]?.count ?? 0,
    };
  }
}
