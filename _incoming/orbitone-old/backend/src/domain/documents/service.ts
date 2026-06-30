import { randomBytes } from "crypto";
import PDFDocument from "pdfkit";
import { pool } from "../../db/postgres.js";
import type { Document, DocumentInput, DocumentStatus, DocumentType } from "../../../../contracts/orbitone.v2.js";

export type DocumentContext = {
  userId: string;
  organizationId: string | null;
};

export class DocumentError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function mapDocument(row: Record<string, unknown>): Document {
  return {
    id: row.id as string,
    organizationId: (row.organization_id as string | null) ?? null,
    customerId: row.customer_id as string,
    createdByUserId: row.created_by_user_id as string,
    type: row.type as DocumentType,
    title: row.title as string,
    data: (row.data as Document["data"]) ?? {},
    fileUrl: (row.file_url as string | null) ?? null,
    status: row.status as DocumentStatus,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

function ownershipClause(tableAlias = "c"): string {
  return `${tableAlias}.organization_id = $1 OR (${tableAlias}.organization_id IS NULL AND ${tableAlias}.assigned_to_user_id = $2)`;
}

export async function listDocuments(context: DocumentContext, customerId: string): Promise<Document[]> {
  const result = await pool.query(
    `SELECT d.*
     FROM documents d
     JOIN customers c ON c.id = d.customer_id
     WHERE d.customer_id = $3 AND (${ownershipClause("c")})
     ORDER BY d.created_at DESC`,
    [context.organizationId, context.userId, customerId]
  );
  return result.rows.map(mapDocument);
}

export async function createDocument(
  context: DocumentContext,
  customerId: string,
  input: DocumentInput
): Promise<Document> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const customerResult = await client.query(
      `SELECT id FROM customers c
       WHERE c.id = $3 AND (${ownershipClause("c")})
       FOR UPDATE`,
      [context.organizationId, context.userId, customerId]
    );
    if (customerResult.rowCount === 0) {
      await client.query("ROLLBACK");
      throw new DocumentError("Customer not found.", 404);
    }

    const result = await client.query(
      `INSERT INTO documents (organization_id, customer_id, created_by_user_id, type, title, data, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'draft')
       RETURNING *`,
      [context.organizationId, customerId, context.userId, input.type, input.title, JSON.stringify(input.data ?? {})]
    );

    await client.query(
      `INSERT INTO customer_activities (customer_id, created_by_user_id, type, title, body, occurred_at)
       VALUES ($1, $2, 'other', $3, $4, now())`,
      [customerId, context.userId, `Document created: ${input.title}`, `Type: ${input.type}`]
    );

    await client.query("COMMIT");
    return mapDocument(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getDocument(context: DocumentContext, documentId: string): Promise<Document | null> {
  const result = await pool.query(
    `SELECT d.*
     FROM documents d
     JOIN customers c ON c.id = d.customer_id
     WHERE d.id = $3 AND (${ownershipClause("c")})`,
    [context.organizationId, context.userId, documentId]
  );
  if (result.rowCount === 0) return null;
  return mapDocument(result.rows[0]);
}

export async function updateDocumentStatus(
  context: DocumentContext,
  documentId: string,
  status: DocumentStatus
): Promise<Document | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const docResult = await client.query(
      `SELECT d.*
       FROM documents d
       JOIN customers c ON c.id = d.customer_id
       WHERE d.id = $3 AND (${ownershipClause("c")})
       FOR UPDATE`,
      [context.organizationId, context.userId, documentId]
    );
    if (docResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const updateResult = await client.query(
      `UPDATE documents SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [documentId, status]
    );

    const doc = mapDocument(updateResult.rows[0]);
    await client.query(
      `INSERT INTO customer_activities (customer_id, created_by_user_id, type, title, body, occurred_at)
       VALUES ($1, $2, 'other', $3, $4, now())`,
      [
        doc.customerId,
        context.userId,
        `Document status updated: ${doc.title}`,
        `New status: ${status}`,
      ]
    );

    await client.query("COMMIT");
    return doc;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function generateDocumentPDF(document: Document): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const docPdf = new PDFDocument({ margin: 50 });

    docPdf.on("data", (chunk) => chunks.push(chunk));
    docPdf.on("end", () => resolve(Buffer.concat(chunks)));
    docPdf.on("error", reject);

    const data = document.data ?? {};

    docPdf.fontSize(24).text(document.title, { align: "center" });
    docPdf.moveDown();
    docPdf.fontSize(12).fillColor("#555").text(`Type: ${document.type.toUpperCase()}`);
    docPdf.text(`Date: ${new Date(document.createdAt).toLocaleDateString()}`);
    docPdf.moveDown();

    if (data.notes) {
      docPdf.fontSize(12).fillColor("#333").text("Notes:");
      docPdf.fontSize(11).text(data.notes);
      docPdf.moveDown();
    }

    if (data.terms) {
      docPdf.fontSize(12).fillColor("#333").text("Terms:");
      docPdf.fontSize(11).text(data.terms);
      docPdf.moveDown();
    }

    if (data.body) {
      docPdf.fontSize(11).fillColor("#333").text(data.body);
      docPdf.moveDown();
    }

    if (Array.isArray(data.items) && data.items.length > 0) {
      docPdf.fontSize(14).fillColor("#000").text("Line items");
      docPdf.moveDown(0.5);

      let subtotal = 0;
      const tableTop = docPdf.y;
      const colWidths = [250, 70, 100, 100];
      const headers = ["Description", "Qty", "Unit price", "Total"];

      docPdf.fontSize(10).fillColor("#333");
      headers.forEach((header, i) => {
        docPdf.text(header, 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), tableTop);
      });
      docPdf.moveDown();

      data.items.forEach((item: { description?: string; quantity?: number; unitPrice?: number }) => {
        const qty = Number(item.quantity ?? 0);
        const price = Number(item.unitPrice ?? 0);
        const total = qty * price;
        subtotal += total;
        const rowY = docPdf.y;
        const values = [
          String(item.description ?? ""),
          String(qty),
          `LKR ${price.toFixed(2)}`,
          `LKR ${total.toFixed(2)}`,
        ];
        values.forEach((value, i) => {
          docPdf.text(value, 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), rowY);
        });
        docPdf.moveDown();
      });

      const taxRate = Number(data.taxRate ?? 0);
      const tax = subtotal * (taxRate / 100);
      const grandTotal = subtotal + tax;

      docPdf.moveDown();
      docPdf.fontSize(12).fillColor("#000");
      docPdf.text(`Subtotal: LKR ${subtotal.toFixed(2)}`, { align: "right" });
      if (taxRate > 0) {
        docPdf.text(`Tax (${taxRate}%): LKR ${tax.toFixed(2)}`, { align: "right" });
      }
      docPdf.fontSize(14).text(`Total: LKR ${grandTotal.toFixed(2)}`, { align: "right" });
    }

    docPdf.end();
  });
}

export function generateSecureToken(): string {
  return randomBytes(32).toString("hex");
}
