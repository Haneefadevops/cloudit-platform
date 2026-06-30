import { z } from "zod";
import type {
  DocumentType,
  DocumentStatus,
} from "../common/contracts/orbitone.v2";

const documentTypes: [DocumentType, ...DocumentType[]] = [
  "quotation",
  "invoice",
  "agreement",
  "other",
];
const documentStatuses: [DocumentStatus, ...DocumentStatus[]] = [
  "draft",
  "sent",
  "accepted",
  "rejected",
];

const lineItemSchema = z.object({
  description: z.string().min(1).max(200),
  quantity: z.number().int().min(0),
  unitPrice: z.number().min(0),
});

export const documentInputSchema = z.object({
  type: z.enum(documentTypes),
  title: z.string().min(1).max(200),
  data: z
    .object({
      items: z.array(lineItemSchema).optional(),
      taxRate: z.number().min(0).max(100).optional(),
      notes: z.string().max(2000).optional(),
      terms: z.string().max(5000).optional(),
      body: z.string().max(5000).optional(),
    })
    .optional(),
});

export const documentStatusUpdateSchema = z.object({
  status: z.enum(documentStatuses),
});
