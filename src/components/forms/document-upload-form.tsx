"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { processStoredDocumentAction } from "@/lib/actions";
import {
  allowedDocumentMimeTypes,
  maxDocumentSizeBytes,
  type DocumentType,
  uploadDocumentInputSchema,
} from "@/lib/document-upload";
import { useUploadThing } from "@/lib/uploadthing-client";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/components/i18n-provider";

const documentTypeOptions: Array<{ value: DocumentType; label: string }> = [
  { value: "lab", label: "Lab report" },
  { value: "rx", label: "Prescription" },
  { value: "discharge", label: "Discharge summary" },
  { value: "note", label: "Clinical note" },
  { value: "other", label: "Other" },
];

type UploadErrors = Partial<
  Record<"title" | "docType" | "notes" | "file", string[]>
>;

export function DocumentUploadForm() {
  const { t } = useI18n();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocumentType>("lab");
  const [errors, setErrors] = useState<UploadErrors>({});
  const [message, setMessage] = useState<string>();
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const { isUploading, startUpload } = useUploadThing("medicalDocument", {
    onUploadProgress: setProgress,
  });

  const isPending = isUploading || isFinalizing;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setErrors({});
    setMessage(undefined);
    setProgress(0);

    const formData = new FormData(form);
    const parsed = uploadDocumentInputSchema.safeParse({
      title: formData.get("title"),
      docType,
      notes: formData.get("notes"),
    });

    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }

    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      setErrors({ file: ["Choose a PDF, JPG, or PNG file."] });
      return;
    }

    if (
      !allowedDocumentMimeTypes.includes(
        file.type as (typeof allowedDocumentMimeTypes)[number],
      )
    ) {
      setErrors({ file: ["Unsupported file type. Use PDF, JPG, or PNG."] });
      return;
    }

    if (file.size > maxDocumentSizeBytes) {
      setErrors({ file: ["File exceeds the 10MB limit."] });
      return;
    }

    try {
      const uploaded = await startUpload([file], parsed.data);
      const documentId = uploaded?.[0]?.serverData?.documentId;

      if (!documentId) {
        setMessage("The file upload did not return a stored document.");
        return;
      }

      setIsFinalizing(true);
      const result = await processStoredDocumentAction({ documentId });

      if (result.message) {
        setMessage(result.message);
      }

      router.refresh();
      form.reset();
      setDocType("lab");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to upload this document.",
      );
    } finally {
      setIsFinalizing(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.title)}>
          <FieldLabel htmlFor="title">{t("documents.document")}</FieldLabel>
          <Input
            aria-invalid={Boolean(errors.title)}
            id="title"
            maxLength={120}
            name="title"
            placeholder="CBC report"
            required
          />
          <FieldError errors={errors.title?.map((message) => ({ message }))} />
        </Field>
        <Field data-invalid={Boolean(errors.docType)}>
          <FieldLabel htmlFor="docType">
            {t("documents.documentType")}
          </FieldLabel>
          <Select
            name="docType"
            onValueChange={(value) => setDocType(value as DocumentType)}
            value={docType}
          >
            <SelectTrigger
              aria-invalid={Boolean(errors.docType)}
              className="w-full"
              id="docType"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {documentTypeOptions.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldError
            errors={errors.docType?.map((message) => ({ message }))}
          />
        </Field>
        <Field data-invalid={Boolean(errors.file)}>
          <FieldLabel htmlFor="file">{t("documents.file")}</FieldLabel>
          <Input
            accept=".pdf,.jpg,.jpeg,.png"
            aria-invalid={Boolean(errors.file)}
            id="file"
            name="file"
            onChange={() =>
              setErrors((current) => ({ ...current, file: undefined }))
            }
            ref={fileInputRef}
            required
            type="file"
          />
          <FieldError errors={errors.file?.map((message) => ({ message }))} />
        </Field>
        <Field data-invalid={Boolean(errors.notes)}>
          <FieldLabel htmlFor="notes">{t("documents.notes")}</FieldLabel>
          <Textarea
            aria-invalid={Boolean(errors.notes)}
            id="notes"
            maxLength={1000}
            name="notes"
            placeholder="Optional context for the doctor"
          />
          <FieldError errors={errors.notes?.map((message) => ({ message }))} />
        </Field>
        {isUploading ? (
          <p className="text-muted-foreground text-sm">
            Uploading: {progress}%
          </p>
        ) : null}
        {message ? (
          <p className="text-destructive text-sm" role="alert">
            {message}
          </p>
        ) : null}
        <Field>
          <Button disabled={isPending} type="submit">
            {isPending ? t("documents.uploading") : t("documents.add")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
