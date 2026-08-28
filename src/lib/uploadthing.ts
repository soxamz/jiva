import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

import { createUploadThingDocument } from "@/lib/dal";
import {
  maxDocumentSizeBytes,
  uploadDocumentInputSchema,
} from "@/lib/document-upload";
import { readSessionFromRequest } from "@/lib/session";

const f = createUploadthing();

export const uploadRouter = {
  medicalDocument: f(
    {
      "application/pdf": {
        acl: "public-read",
        contentDisposition: "attachment",
        maxFileCount: 1,
        maxFileSize: "16MB",
      },
      "image/jpeg": {
        acl: "public-read",
        contentDisposition: "attachment",
        maxFileCount: 1,
        maxFileSize: "16MB",
      },
      "image/png": {
        acl: "public-read",
        contentDisposition: "attachment",
        maxFileCount: 1,
        maxFileSize: "16MB",
      },
    },
    { awaitServerData: true },
  )
    .input(uploadDocumentInputSchema)
    .middleware(async ({ files, req, input }) => {
      const session = await readSessionFromRequest(req);

      if (!session || session.role !== "patient") {
        throw new UploadThingError(
          "Sign in as a patient to upload a medical record.",
        );
      }

      if (files.some((file) => file.size > maxDocumentSizeBytes)) {
        throw new UploadThingError("File exceeds the 10MB limit.");
      }

      return { patientId: session.userId, ...input };
    })
    .onUploadComplete(async ({ file, metadata }) => {
      const document = await createUploadThingDocument({
        userId: metadata.patientId,
        title: metadata.title,
        docType: metadata.docType,
        notes: metadata.notes || undefined,
        fileName: file.name,
        fileType: file.type,
        fileSizeBytes: file.size,
        storageKey: file.key,
        storageUrl: file.ufsUrl,
      });

      return { documentId: document.id };
    }),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
