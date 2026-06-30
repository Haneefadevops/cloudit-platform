import { Router } from "express";
import { requireUser } from "../../middleware/auth.js";
import { requireCRM } from "../../middleware/plan.js";
import { getUser } from "../../middleware/auth.js";
import {
  listDocuments,
  createDocument,
  getDocument,
  updateDocumentStatus,
  generateDocumentPDF,
  DocumentError,
  type DocumentContext,
} from "./service.js";
import { documentInputSchema, documentStatusUpdateSchema } from "./schemas.js";

export const documentsRouter = Router();

documentsRouter.use(requireUser, requireCRM);

function getContext(req: Parameters<typeof getUser>[0]): DocumentContext {
  const user = getUser(req);
  return { userId: user.id, organizationId: user.organizationId };
}

documentsRouter.get("/:id/download", async (req, res, next) => {
  try {
    const document = await getDocument(getContext(req), req.params.id);
    if (!document) {
      res.status(404).json({ ok: false, error: "Document not found." });
      return;
    }
    const pdf = await generateDocumentPDF(document);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${document.title.replace(/\s+/g, "_")}.pdf"`);
    res.send(pdf);
  } catch (error) {
    if (error instanceof DocumentError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

documentsRouter.put("/:id/status", async (req, res, next) => {
  try {
    const input = documentStatusUpdateSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid status." });
      return;
    }
    const document = await updateDocumentStatus(getContext(req), req.params.id, input.data.status);
    if (!document) {
      res.status(404).json({ ok: false, error: "Document not found." });
      return;
    }
    res.json({ ok: true, data: document });
  } catch (error) {
    if (error instanceof DocumentError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

export function addCustomerDocumentRoutes(router: Router) {
  router.get("/:id/documents", async (req, res, next) => {
    try {
      const documents = await listDocuments(getContext(req), req.params.id);
      res.json({ ok: true, data: documents });
    } catch (error) {
      if (error instanceof DocumentError) {
        res.status(error.statusCode).json({ ok: false, error: error.message });
        return;
      }
      next(error);
    }
  });

  router.post("/:id/documents", async (req, res, next) => {
    try {
      const input = documentInputSchema.safeParse(req.body);
      if (!input.success) {
        res.status(400).json({ ok: false, error: "Invalid document details." });
        return;
      }
      const document = await createDocument(getContext(req), req.params.id, input.data);
      res.status(201).json({ ok: true, data: document });
    } catch (error) {
      if (error instanceof DocumentError) {
        res.status(error.statusCode).json({ ok: false, error: error.message });
        return;
      }
      next(error);
    }
  });
}
