import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

interface CreateDocumentInput {
  templateId: string;
  employeeId: string;
  senderId?: string;
  title?: string;
  content?: string;
  notes?: string | null;
  status?: string;
}

interface UpdateDocumentInput {
  title?: string;
  content?: string;
  status?: string;
  signatureUrl?: string | null;
  signedAt?: string | null;
  signedIp?: string | null;
  signedLatitude?: number | null;
  signedLongitude?: number | null;
  notes?: string | null;
}

@Injectable()
export class DocumentsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT sd.*,
              jsonb_build_object(
                'id', e.id,
                'first_name', e.first_name,
                'last_name', e.last_name,
                'employee_number', e.employee_number
              ) AS employee,
              jsonb_build_object(
                'id', dt.id,
                'name', dt.name,
                'description', dt.description,
                'status', dt.status
              ) AS template,
              concat_ws(' ', e.first_name, e.last_name) AS employee_name
       FROM sent_documents sd
       JOIN employees e ON e.id = sd.employee_id
       JOIN document_templates dt ON dt.id = sd.template_id
       WHERE sd.organization_id = $1::uuid
       ORDER BY sd.created_at DESC`,
      [organizationId],
    );
    return result.rows;
  }

  async create(organizationId: string, input: CreateDocumentInput) {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const templateResult = await client.query(
        `SELECT id, name, content
         FROM document_templates
         WHERE id = $1::uuid AND organization_id = $2::uuid`,
        [input.templateId, organizationId],
      );
      if (templateResult.rows.length === 0) {
        throw new NotFoundException("Document template not found");
      }
      const template = templateResult.rows[0];

      const employeeResult = await client.query(
        `SELECT id
         FROM employees
         WHERE id = $1::uuid AND organization_id = $2::uuid`,
        [input.employeeId, organizationId],
      );
      if (employeeResult.rows.length === 0) {
        throw new NotFoundException("Employee not found");
      }

      const result = await client.query(
        `INSERT INTO sent_documents (
           organization_id, template_id, employee_id, sender_id,
           title, content, status, notes
         )
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, COALESCE($7, 'pending'), $8)
         RETURNING *`,
        [
          organizationId,
          input.templateId,
          input.employeeId,
          input.senderId ?? null,
          input.title ?? template.name,
          input.content ?? template.content,
          input.status ?? null,
          input.notes ?? null,
        ],
      );

      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async findOne(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `SELECT sd.*,
              jsonb_build_object(
                'id', e.id,
                'first_name', e.first_name,
                'last_name', e.last_name,
                'employee_number', e.employee_number
              ) AS employee,
              jsonb_build_object(
                'id', dt.id,
                'name', dt.name,
                'description', dt.description,
                'status', dt.status
              ) AS template
       FROM sent_documents sd
       JOIN employees e ON e.id = sd.employee_id
       JOIN document_templates dt ON dt.id = sd.template_id
       WHERE sd.id = $1::uuid AND sd.organization_id = $2::uuid`,
      [id, organizationId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Document not found");
    }
    return result.rows[0];
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateDocumentInput,
  ) {
    const params: unknown[] = [id, organizationId];
    const setClauses: string[] = [];
    const add = (column: string, value: unknown, cast = "") => {
      if (value !== undefined) {
        params.push(value);
        setClauses.push(`${column} = $${params.length}${cast}`);
      }
    };

    add("title", input.title);
    add("content", input.content);
    add("status", input.status);
    add("signature_url", input.signatureUrl);
    add("signed_at", input.signedAt, "::timestamptz");
    add("signed_ip", input.signedIp);
    add("signed_latitude", input.signedLatitude);
    add("signed_longitude", input.signedLongitude);
    add("notes", input.notes);

    if (setClauses.length === 0) {
      return this.findOne(organizationId, id);
    }

    setClauses.push("updated_at = now()");
    const result = await this.databaseService.query(
      `UPDATE sent_documents
       SET ${setClauses.join(", ")}
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      params,
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Document not found");
    }
    return result.rows[0];
  }

  async delete(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `DELETE FROM sent_documents
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING id`,
      [id, organizationId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Document not found");
    }
    return { deleted: true, id: result.rows[0].id };
  }

  async findTemplates(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT dt.*,
              COUNT(sd.id)::int AS sent_count
       FROM document_templates dt
       LEFT JOIN sent_documents sd
         ON sd.template_id = dt.id AND sd.organization_id = dt.organization_id
       WHERE dt.organization_id = $1::uuid
       GROUP BY dt.id
       ORDER BY dt.created_at DESC`,
      [organizationId],
    );
    return result.rows;
  }

  async createTemplate(
    organizationId: string,
    input: {
      name: string;
      content: string;
      description?: string | null;
      status?: string | null;
    },
  ) {
    const result = await this.databaseService.query(
      `INSERT INTO document_templates (
         organization_id, name, content, description, status
       )
       VALUES ($1::uuid, $2, $3, $4, COALESCE($5, 'active'))
       RETURNING *`,
      [
        organizationId,
        input.name,
        input.content,
        input.description ?? null,
        input.status ?? null,
      ],
    );
    return result.rows[0];
  }

  async updateTemplate(
    organizationId: string,
    id: string,
    input: {
      name?: string;
      content?: string;
      description?: string | null;
      status?: string | null;
    },
  ) {
    const params: unknown[] = [id, organizationId];
    const setClauses: string[] = [];
    const add = (column: string, value: unknown) => {
      if (value !== undefined) {
        params.push(value);
        setClauses.push(`${column} = $${params.length}`);
      }
    };

    add("name", input.name);
    add("content", input.content);
    add("description", input.description);
    add("status", input.status);

    if (setClauses.length === 0) {
      const current = await this.databaseService.query(
        `SELECT * FROM document_templates
         WHERE id = $1::uuid AND organization_id = $2::uuid`,
        [id, organizationId],
      );
      if (current.rows.length === 0) {
        throw new NotFoundException("Document template not found");
      }
      return current.rows[0];
    }

    setClauses.push("updated_at = now()");
    const result = await this.databaseService.query(
      `UPDATE document_templates
       SET ${setClauses.join(", ")}
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      params,
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Document template not found");
    }
    return result.rows[0];
  }

  async deleteTemplate(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `DELETE FROM document_templates
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING id`,
      [id, organizationId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Document template not found");
    }
    return { deleted: true, id: result.rows[0].id };
  }
}
