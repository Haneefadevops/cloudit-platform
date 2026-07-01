import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class PayrollService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findRuns(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT id, organization_id, month, year, status, total_employees,
              total_gross, total_net, total_epf_employee, total_epf_employer,
              total_etf, total_paye, run_by, finalized_at, finalized_by,
              created_at, updated_at
       FROM payroll_runs
       WHERE organization_id = $1::uuid
       ORDER BY year DESC, month DESC`,
      [organizationId],
    );
    return result.rows;
  }

  async createRun(
    organizationId: string,
    input: { month: number; year: number; payDate?: string },
    runBy?: string,
  ) {
    const result = await this.databaseService.query(
      `INSERT INTO payroll_runs (organization_id, month, year, run_by)
       VALUES ($1::uuid, $2, $3, $4::uuid)
       RETURNING *`,
      [organizationId, input.month, input.year, runBy ?? null],
    );
    return result.rows[0];
  }

  async findRunById(organizationId: string, id: string) {
    const runResult = await this.databaseService.query(
      `SELECT id, organization_id, month, year, status, total_employees,
              total_gross, total_net, total_epf_employee, total_epf_employer,
              total_etf, total_paye, run_by, finalized_at, finalized_by,
              created_at, updated_at
       FROM payroll_runs
       WHERE id = $2::uuid AND organization_id = $1::uuid`,
      [organizationId, id],
    );
    if (runResult.rows.length === 0) {
      throw new NotFoundException("Payroll run not found");
    }
    const summaryResult = await this.databaseService.query(
      `SELECT COUNT(*)::int AS total_employees,
              COALESCE(SUM(net_salary), 0) AS total_net
       FROM payroll_items
       WHERE payroll_run_id = $1::uuid AND organization_id = $2::uuid`,
      [id, organizationId],
    );
    return {
      ...runResult.rows[0],
      summary: summaryResult.rows[0],
    };
  }

  async processRun(organizationId: string, id: string) {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const runResult = await client.query(
        `SELECT id, month, year, status
         FROM payroll_runs
         WHERE id = $2::uuid AND organization_id = $1::uuid
         FOR UPDATE`,
        [organizationId, id],
      );
      if (runResult.rows.length === 0) {
        throw new NotFoundException("Payroll run not found");
      }
      const run = runResult.rows[0];

      await client.query(
        `DELETE FROM payroll_items
         WHERE payroll_run_id = $1::uuid AND organization_id = $2::uuid`,
        [id, organizationId],
      );

      const employeesResult = await client.query<{
        id: string;
        basic_salary: number;
        bank_name: string;
        bank_account_number: string;
      }>(
        `SELECT id, basic_salary, bank_name, bank_account_number
         FROM employees
         WHERE organization_id = $1::uuid
           AND employment_status = 'active'`,
        [organizationId],
      );

      let totalGross = 0;
      let totalNet = 0;
      let totalEpfEmployee = 0;
      let totalEpfEmployer = 0;
      let totalEtf = 0;
      let totalPaye = 0;

      for (const employee of employeesResult.rows) {
        const basicSalary = Number(employee.basic_salary ?? 0);
        const attendanceResult = await client.query<{
          total_days: number;
          days_worked: number;
          days_on_leave: number;
          days_absent: number;
          prorated_salary: number;
        }>(
          `SELECT * FROM calculate_attendance_based_salary($1::uuid, $2, $3, $4)`,
          [employee.id, basicSalary, run.month, run.year],
        );
        const attendance = attendanceResult.rows[0];

        const structureResult = await client.query<{
          component_id: string;
          amount: number;
        }>(
          `SELECT component_id, amount
           FROM employee_salary_structure
           WHERE organization_id = $1::uuid
             AND employee_id = $2::uuid
             AND effective_from <= CURRENT_DATE
             AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)`,
          [organizationId, employee.id],
        );

        const earnings = structureResult.rows.map((row) => ({
          component_id: row.component_id,
          amount: Number(row.amount),
        }));
        const earningsTotal = earnings.reduce((sum, e) => sum + e.amount, 0);
        const grossSalary = Number(attendance.prorated_salary) + earningsTotal;

        const deductionsResult = await client.query<{
          epf_employee: number;
          epf_employer: number;
          etf: number;
          paye_tax: number;
        }>(`SELECT * FROM calculate_statutory_deductions($1, $2)`, [
          basicSalary,
          grossSalary,
        ]);
        const deductions = deductionsResult.rows[0];
        const totalDeductions =
          Number(deductions.epf_employee) + Number(deductions.paye_tax);
        const netSalary = grossSalary - totalDeductions;

        await client.query(
          `INSERT INTO payroll_items (
             payroll_run_id, organization_id, employee_id, basic_salary,
             earnings_json, deductions_json, total_days_in_month, days_worked,
             days_on_leave, days_absent, epf_employee, epf_employer, etf,
             paye_tax, gross_salary, total_deductions, net_salary,
             bank_name, bank_account
           )
           VALUES (
             $1::uuid, $2::uuid, $3::uuid, $4,
             $5::jsonb, $6::jsonb, $7, $8, $9, $10,
             $11, $12, $13, $14, $15, $16, $17, $18, $19
           )`,
          [
            id,
            organizationId,
            employee.id,
            basicSalary,
            JSON.stringify(earnings),
            JSON.stringify([
              { type: "epf_employee", amount: Number(deductions.epf_employee) },
              { type: "paye_tax", amount: Number(deductions.paye_tax) },
            ]),
            attendance.total_days,
            attendance.days_worked,
            attendance.days_on_leave,
            attendance.days_absent,
            Number(deductions.epf_employee),
            Number(deductions.epf_employer),
            Number(deductions.etf),
            Number(deductions.paye_tax),
            grossSalary,
            totalDeductions,
            netSalary,
            employee.bank_name ?? null,
            employee.bank_account_number ?? null,
          ],
        );

        totalGross += grossSalary;
        totalNet += netSalary;
        totalEpfEmployee += Number(deductions.epf_employee);
        totalEpfEmployer += Number(deductions.epf_employer);
        totalEtf += Number(deductions.etf);
        totalPaye += Number(deductions.paye_tax);
      }

      await client.query(
        `UPDATE payroll_runs
         SET status = 'draft',
             total_employees = $3,
             total_gross = $4,
             total_net = $5,
             total_epf_employee = $6,
             total_epf_employer = $7,
             total_etf = $8,
             total_paye = $9,
             updated_at = now()
         WHERE id = $1::uuid AND organization_id = $2::uuid`,
        [
          id,
          organizationId,
          employeesResult.rows.length,
          totalGross,
          totalNet,
          totalEpfEmployee,
          totalEpfEmployer,
          totalEtf,
          totalPaye,
        ],
      );

      await client.query("COMMIT");
      return { id, processed_count: employeesResult.rows.length };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findRunItems(organizationId: string, runId: string) {
    const result = await this.databaseService.query(
      `SELECT pi.*,
              e.first_name || ' ' || e.last_name AS employee_name
       FROM payroll_items pi
       JOIN employees e ON e.id = pi.employee_id
       WHERE pi.payroll_run_id = $2::uuid AND pi.organization_id = $1::uuid
       ORDER BY e.first_name, e.last_name`,
      [organizationId, runId],
    );
    return result.rows;
  }

  async updatePayrollItem(
    organizationId: string,
    runId: string,
    itemId: string,
    input: {
      earningsJson?: Array<{ component_id?: string; amount: number }>;
      deductionsJson?: Array<{ type?: string; amount: number }>;
      lateDeduction?: number;
      overtimeAmount?: number;
      basicSalary?: number;
    },
  ) {
    const itemResult = await this.databaseService.query(
      `SELECT *
       FROM payroll_items
       WHERE id = $3::uuid
         AND payroll_run_id = $2::uuid
         AND organization_id = $1::uuid`,
      [organizationId, runId, itemId],
    );
    if (itemResult.rows.length === 0) {
      throw new NotFoundException("Payroll item not found");
    }
    const item = itemResult.rows[0];

    const basicSalary =
      input.basicSalary !== undefined
        ? Number(input.basicSalary)
        : Number(item.basic_salary);
    const earnings: Array<{ amount?: number }> =
      input.earningsJson !== undefined
        ? input.earningsJson
        : (item.earnings_json ?? []);
    const deductions: Array<{ amount?: number }> =
      input.deductionsJson !== undefined
        ? input.deductionsJson
        : (item.deductions_json ?? []);
    const lateDeduction =
      input.lateDeduction !== undefined
        ? Number(input.lateDeduction)
        : Number(item.late_deduction ?? 0);
    const overtimeAmount =
      input.overtimeAmount !== undefined
        ? Number(input.overtimeAmount)
        : Number(item.overtime_amount ?? 0);

    const earningsTotal = earnings.reduce(
      (sum, e) => sum + Number(e.amount ?? 0),
      0,
    );
    const grossSalary =
      basicSalary + earningsTotal + overtimeAmount - lateDeduction;

    const statutoryResult = await this.databaseService.query<{
      epf_employee: number;
      epf_employer: number;
      etf: number;
      paye_tax: number;
    }>(`SELECT * FROM calculate_statutory_deductions($1, $2)`, [
      basicSalary,
      grossSalary,
    ]);
    const statutory = statutoryResult.rows[0];

    const extraDeductionsTotal = deductions.reduce(
      (sum, d) => sum + Number(d.amount ?? 0),
      0,
    );
    const totalDeductions =
      Number(statutory.epf_employee) +
      Number(statutory.paye_tax) +
      extraDeductionsTotal;
    const netSalary = grossSalary - totalDeductions;

    const result = await this.databaseService.query(
      `UPDATE payroll_items
       SET basic_salary = $4,
           earnings_json = $5::jsonb,
           deductions_json = $6::jsonb,
           late_deduction = $7,
           overtime_amount = $8,
           epf_employee = $9,
           epf_employer = $10,
           etf = $11,
           paye_tax = $12,
           gross_salary = $13,
           total_deductions = $14,
           net_salary = $15,
           updated_at = now()
       WHERE id = $3::uuid
         AND payroll_run_id = $2::uuid
         AND organization_id = $1::uuid
       RETURNING *`,
      [
        organizationId,
        runId,
        itemId,
        basicSalary,
        JSON.stringify(earnings),
        JSON.stringify(deductions),
        lateDeduction,
        overtimeAmount,
        Number(statutory.epf_employee),
        Number(statutory.epf_employer),
        Number(statutory.etf),
        Number(statutory.paye_tax),
        grossSalary,
        totalDeductions,
        netSalary,
      ],
    );

    return result.rows[0];
  }

  async findSalaryComponents(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT *
       FROM salary_components
       WHERE organization_id = $1::uuid
       ORDER BY name`,
      [organizationId],
    );
    return result.rows;
  }

  async createSalaryComponent(
    organizationId: string,
    input: {
      name: string;
      type: string;
      calculationType: string;
      defaultAmount?: number;
      isStatutory?: boolean;
      isTaxable?: boolean;
      description?: string;
    },
  ) {
    const result = await this.databaseService.query(
      `INSERT INTO salary_components (
         organization_id, name, type, calculation_type, default_amount,
         is_statutory, is_taxable, description
       )
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        organizationId,
        input.name,
        input.type,
        input.calculationType,
        input.defaultAmount ?? null,
        input.isStatutory ?? false,
        input.isTaxable ?? true,
        input.description ?? null,
      ],
    );
    return result.rows[0];
  }

  async findStructures(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT ess.*,
              e.first_name || ' ' || e.last_name AS employee_name,
              sc.name AS component_name
       FROM employee_salary_structure ess
       JOIN employees e ON e.id = ess.employee_id
       JOIN salary_components sc ON sc.id = ess.component_id
       WHERE ess.organization_id = $1::uuid
       ORDER BY e.first_name, e.last_name, sc.name`,
      [organizationId],
    );
    return result.rows;
  }

  async findStructureByEmployee(organizationId: string, employeeId: string) {
    const result = await this.databaseService.query(
      `SELECT ess.*, sc.name AS component_name
       FROM employee_salary_structure ess
       JOIN salary_components sc ON sc.id = ess.component_id
       WHERE ess.organization_id = $1::uuid AND ess.employee_id = $2::uuid
       ORDER BY sc.name`,
      [organizationId, employeeId],
    );
    return result.rows;
  }

  async upsertStructure(
    organizationId: string,
    employeeId: string,
    input: Array<{
      component_id: string;
      amount: number;
      effective_from?: string;
      effective_to?: string | null;
    }>,
  ) {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `DELETE FROM employee_salary_structure
         WHERE organization_id = $1::uuid AND employee_id = $2::uuid`,
        [organizationId, employeeId],
      );

      const inserted: unknown[] = [];
      for (const row of input) {
        const result = await client.query(
          `INSERT INTO employee_salary_structure (
             organization_id, employee_id, component_id, amount,
             effective_from, effective_to
           )
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::date, $6::date)
           RETURNING *`,
          [
            organizationId,
            employeeId,
            row.component_id,
            row.amount,
            row.effective_from ?? new Date().toISOString().split("T")[0],
            row.effective_to ?? null,
          ],
        );
        inserted.push(result.rows[0]);
      }
      await client.query("COMMIT");
      return inserted;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findSalaryRevisions(organizationId: string, employeeId: string) {
    const result = await this.databaseService.query(
      `SELECT sr.*,
              sr.old_basic_salary AS previous_salary,
              sr.new_basic_salary AS new_salary,
              concat_ws(' ', approver.first_name, approver.last_name) AS approved_by_name
       FROM salary_revisions sr
       LEFT JOIN users approver
         ON approver.id = sr.approved_by
        AND approver.organization_id = sr.organization_id
       WHERE sr.organization_id = $1::uuid
         AND sr.employee_id = $2::uuid
       ORDER BY sr.effective_date DESC, sr.created_at DESC`,
      [organizationId, employeeId],
    );
    return result.rows;
  }

  async createSalaryRevision(
    organizationId: string,
    employeeId: string,
    input: {
      newBasicSalary: number;
      effectiveDate: string;
      reason?: string;
      approvedBy?: string;
    },
  ) {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const employeeResult = await client.query(
        `SELECT id, basic_salary
         FROM employees
         WHERE id = $1::uuid AND organization_id = $2::uuid
         FOR UPDATE`,
        [employeeId, organizationId],
      );
      if (employeeResult.rows.length === 0) {
        throw new NotFoundException("Employee not found");
      }

      const oldBasicSalary = employeeResult.rows[0].basic_salary;
      const revisionResult = await client.query(
        `INSERT INTO salary_revisions (
           organization_id, employee_id, old_basic_salary, new_basic_salary,
           effective_date, reason, approved_by, approved_at
         )
         VALUES ($1::uuid, $2::uuid, $3, $4, $5::date, $6, $7::uuid, now())
         RETURNING *,
                   old_basic_salary AS previous_salary,
                   new_basic_salary AS new_salary`,
        [
          organizationId,
          employeeId,
          oldBasicSalary ?? null,
          input.newBasicSalary,
          input.effectiveDate,
          input.reason ?? null,
          input.approvedBy ?? null,
        ],
      );

      await client.query(
        `UPDATE employees
         SET basic_salary = $3,
             updated_at = now()
         WHERE id = $1::uuid AND organization_id = $2::uuid`,
        [employeeId, organizationId, input.newBasicSalary],
      );

      await client.query("COMMIT");
      return revisionResult.rows[0];
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  sendPayslips(
    _organizationId: string,
    input: { run_id?: string; employee_ids?: string[] },
  ) {
    return {
      sent: true,
      run_id: input.run_id ?? null,
      employee_ids: input.employee_ids ?? [],
    };
  }
}
