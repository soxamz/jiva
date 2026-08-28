import "server-only";

import { UTApi } from "uploadthing/server";

import {
  allowedDocumentMimeTypes,
  maxDocumentSizeBytes,
} from "@/lib/document-upload";

function getUploadThingToken() {
  const token = process.env.UPLOADTHING_TOKEN?.trim();

  if (!token) {
    throw new Error(
      "Upload storage is not configured. Set UPLOADTHING_TOKEN in the root .env.local file.",
    );
  }

  return token;
}

export async function downloadStoredDocument(input: {
  storageKey: string;
  fileName: string;
  fileType: string;
}) {
  const utapi = new UTApi({ token: getUploadThingToken() });
  const { ufsUrl } = await utapi.generateSignedURL(input.storageKey, {
    expiresIn: "5m",
  });
  const response = await fetch(ufsUrl);

  if (!response.ok) {
    throw new Error(
      "The stored document could not be retrieved for processing.",
    );
  }

  const contentType =
    response.headers.get("content-type")?.split(";", 1)[0] ?? input.fileType;

  if (
    !allowedDocumentMimeTypes.includes(
      contentType as (typeof allowedDocumentMimeTypes)[number],
    )
  ) {
    throw new Error("The stored document has an unsupported file type.");
  }

  const bytes = await response.arrayBuffer();

  if (bytes.byteLength === 0 || bytes.byteLength > maxDocumentSizeBytes) {
    throw new Error("The stored document exceeds the 10MB processing limit.");
  }

  return new File([bytes], input.fileName, { type: contentType });
}
