import { z } from "zod";

export const documentTypes = [
  "lab",
  "rx",
  "discharge",
  "note",
  "other",
] as const;

export const allowedDocumentMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export const maxDocumentSizeBytes = 10 * 1024 * 1024;

export const uploadDocumentInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Enter a document title.")
    .max(120, "Use 120 characters or fewer."),
  docType: z.enum(documentTypes),
  notes: z
    .string()
    .trim()
    .max(1_000, "Use 1,000 characters or fewer.")
    .optional(),
});

export const storedDocumentIdSchema = z.object({
  documentId: z.string().uuid("Invalid stored document."),
});

export type DocumentType = (typeof documentTypes)[number];
