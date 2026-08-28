"use client";

import { useState, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useUploadThing } from "@/lib/uploadthing-client";
import { processStoredDocumentAction } from "@/lib/actions";
import { allowedDocumentMimeTypes, maxDocumentSizeBytes, type DocumentType } from "@/lib/document-upload";
import { FileText, Plus, Sparkles, Calendar, Loader2, LinkIcon, FileHeart, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileHeader } from "./mobile-header";

interface MobileRecordsProps {
  data: {
    documents: Array<{
      document: {
        id: string;
        title: string;
        fileName: string;
        docType: string;
        uploadedAt: Date;
        status: "processed" | "processing" | "failed";
        storageUrl: string | null;
        fileSizeBytes: number;
        notes: string | null;
      };
      structured: {
        aiConfidenceScore: number | null;
      } | null;
    }>;
  };
}

const DOC_TYPES: Array<{ value: DocumentType; label: string }> = [
  { value: "lab", label: "lab" },
  { value: "rx", label: "prescription" },
  { value: "note", label: "note" },
  { value: "other", label: "scan" },
];

export function MobileRecords({ data }: MobileRecordsProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [activeFilter, setActiveFilter] = useState<"all" | DocumentType>("all");

  // Form State
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState<DocumentType>("lab");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [progress, setProgress] = useState(0);

  const { isUploading, startUpload } = useUploadThing("medicalDocument", {
    onUploadProgress: setProgress,
  });

  const isPending = isUploading || isFinalizing;

  const filteredDocs = data.documents.filter(({ document }) => {
    if (activeFilter === "all") return true;
    return document.docType === activeFilter;
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors(null);
    setMessage(null);
    setProgress(0);

    if (!docName.trim()) {
      setErrors("Please enter a document name.");
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setErrors("Choose a PDF, JPG, or PNG file.");
      return;
    }

    if (!(allowedDocumentMimeTypes as readonly string[]).includes(file.type)) {
      setErrors("Unsupported file type. Use PDF, JPG, or PNG.");
      return;
    }

    if (file.size > maxDocumentSizeBytes) {
      setErrors("File exceeds the 10MB limit.");
      return;
    }

    try {
      const metadata = {
        title: docName.trim(),
        docType,
        notes: notes.trim() || undefined,
      };

      const uploaded = await startUpload([file], metadata);
      const documentId = uploaded?.[0]?.serverData?.documentId;

      if (!documentId) {
        setErrors("The file upload did not return a stored document.");
        return;
      }

      setIsFinalizing(true);
      const result = await processStoredDocumentAction({ documentId });

      if (result.message) {
        setMessage(result.message);
      }

      router.refresh();
      setDocName("");
      setDocType("lab");
      setNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setErrors(err instanceof Error ? err.message : "Unable to upload this document.");
    } finally {
      setIsFinalizing(false);
    }
  }

  const getDocTypeColor = (type: string) => {
    switch (type) {
      case "lab":
        return "bg-amber-50 text-amber-600 border-amber-200/50";
      case "rx":
      case "prescription":
        return "bg-emerald-50 text-emerald-600 border-emerald-200/50";
      case "note":
        return "bg-sky-50 text-sky-600 border-sky-200/50";
      default:
        return "bg-violet-50 text-violet-600 border-violet-200/50";
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-24 md:hidden">
      <MobileHeader title="Medical records" showBack backHref="/dashboard" />

      <div className="p-4 flex flex-col gap-5">
        
        {/* Title and Intro */}
        <div>
          <h2 className="text-[24px] font-extrabold text-[#111827] tracking-tight">
            Your medical records
          </h2>
          <p className="text-[#64748B] text-[13px] mt-1 leading-relaxed">
            Keep reports, prescriptions, and discharge summaries in one place.
          </p>
        </div>

        {/* Upload Record Form */}
        <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-5 shadow-sm">
          <div>
            <h3 className="text-sm font-extrabold text-[#111827]">
              Upload record
            </h3>
            <p className="text-[#64748B] text-[11px] mt-0.5 font-semibold">
              PDF, JPG, or PNG under 10MB.
            </p>
          </div>

          <form className="flex flex-col gap-4 mt-4" onSubmit={handleSubmit}>
            {/* Title Input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mobile-doc-title" className="text-[11px] font-bold text-[#111827] uppercase tracking-wider">
                Document
              </label>
              <input
                id="mobile-doc-title"
                type="text"
                placeholder="CBC report"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                disabled={isPending}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] px-3.5 py-3 text-xs text-[#111827] focus:outline-none focus:border-[#0D5F5A] font-medium"
              />
            </div>

            {/* Type Chips */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-[#111827] uppercase tracking-wider">
                Document type
              </span>
              <div className="flex flex-wrap gap-2">
                {DOC_TYPES.map((t) => {
                  const active = docType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setDocType(t.value)}
                      className={cn(
                        "px-4 py-2 rounded-full text-xs font-bold border transition-colors capitalize",
                        active
                          ? "bg-[#0D5F5A] border-[#0D5F5A] text-white"
                          : "bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B]"
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes Input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mobile-doc-notes" className="text-[11px] font-bold text-[#111827] uppercase tracking-wider">
                Notes
              </label>
              <textarea
                id="mobile-doc-notes"
                placeholder="Optional context for the doctor"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isPending}
                rows={3}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-[12px] p-3.5 text-xs text-[#111827] focus:outline-none focus:border-[#0D5F5A] font-medium"
              />
            </div>

            {/* File Upload Input */}
            <div className="flex flex-col gap-1.5">
              <input
                id="mobile-doc-file"
                type="file"
                ref={fileInputRef}
                disabled={isPending}
                accept=".pdf,.jpg,.jpeg,.png"
                className="w-full text-xs text-[#64748B] file:mr-3 file:py-1.5 file:px-3.5 file:rounded-full file:border-0 file:text-[11px] file:font-semibold file:bg-[#E6F4F1] file:text-[#0D5F5A] file:cursor-pointer"
              />
            </div>

            {/* Progress indicators */}
            {isUploading && (
              <div className="flex items-center gap-2 text-[#0D5F5A] text-xs font-semibold">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Uploading: {progress}%</span>
              </div>
            )}

            {isFinalizing && (
              <div className="flex items-center gap-2 text-teal-600 text-xs font-semibold">
                <Loader2 className="size-3.5 animate-spin" />
                <span>AI Summary Engine Processing...</span>
              </div>
            )}

            {errors && <p className="text-red-500 text-[11px] font-bold mt-1">{errors}</p>}
            {message && <p className="text-teal-600 text-[11px] font-bold mt-1">{message}</p>}

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 bg-[#0D5F5A] text-white py-3.5 rounded-[12px] text-xs font-bold active:scale-[0.99] transition-transform disabled:opacity-60 mt-1"
            >
              <Plus className="size-4 stroke-[2.5]" />
              <span>Add Record</span>
            </button>
          </form>
        </div>

        {/* Saved Records Header */}
        <div className="mt-2">
          <h3 className="text-sm font-extrabold text-[#111827]">
            Saved records
          </h3>
          <p className="text-[#64748B] text-[11px] mt-0.5">
            Your records are ready when you need to share them.
          </p>
        </div>

        {/* Filter Chip Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveFilter("all")}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-bold border transition-colors flex-shrink-0",
              activeFilter === "all"
                ? "bg-[#0D5F5A] border-[#0D5F5A] text-white"
                : "bg-white border-[#E2E8F0] text-[#64748B]"
            )}
          >
            All
          </button>
          {DOC_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setActiveFilter(type.value)}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-bold border transition-colors flex-shrink-0 capitalize",
                activeFilter === type.value
                  ? "bg-[#0D5F5A] border-[#0D5F5A] text-white"
                  : "bg-white border-[#E2E8F0] text-[#64748B]"
              )}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* List of Documents */}
        <div className="flex flex-col gap-3">
          {filteredDocs.length === 0 ? (
            <div className="text-center py-10 bg-white border border-[#E2E8F0] rounded-[20px] p-6 text-[#64748B] text-xs">
              No records matching the filter.
            </div>
          ) : (
            filteredDocs.map(({ document, structured }) => (
              <div
                key={document.id}
                className="bg-white border border-[#E2E8F0] rounded-[16px] p-4 shadow-sm flex items-start gap-3.5"
              >
                <div
                  className={cn(
                    "size-10 rounded-[10px] flex items-center justify-center shrink-0 border border-transparent",
                    getDocTypeColor(document.docType)
                  )}
                >
                  <FileHeart className="size-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 justify-between">
                    <h3 className="text-xs font-extrabold text-[#111827] truncate">
                      {document.title}
                    </h3>
                    {structured?.aiConfidenceScore && (
                      <div className="bg-[#E6F4F1] text-[#0D5F5A] text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5">
                        <Sparkles className="size-2" />
                        <span>{structured.aiConfidenceScore}%</span>
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] text-[#64748B] mt-0.5 uppercase tracking-wide font-bold">
                    {document.docType === "rx" ? "prescription" : document.docType}
                  </p>

                  <div className="flex items-center gap-1.5 mt-2">
                    <Calendar className="size-3 text-[#64748B]/70" />
                    <span className="text-[10px] text-[#64748B] font-semibold">
                      {new Date(document.uploadedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <div className="size-1 rounded-full bg-[#E2E8F0]" />
                    <span
                      className={cn(
                        "text-[10px] font-bold capitalize",
                        document.status === "processed"
                          ? "text-emerald-600"
                          : document.status === "processing"
                          ? "text-amber-500 animate-pulse"
                          : "text-red-500"
                      )}
                    >
                      {document.status}
                    </span>
                  </div>

                  {document.notes && (
                    <p className="text-[#64748B] text-[10px] bg-[#F8FAFC] border border-[#F1F5F9] rounded-[8px] p-2 mt-2 leading-relaxed italic">
                      &ldquo;{document.notes}&rdquo;
                    </p>
                  )}
                </div>

                {document.storageUrl && (
                  <a
                    href={document.storageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex size-8 items-center justify-center rounded-full bg-[#F8FAFC] border border-[#E2E8F0] text-[#0D5F5A] active:scale-90 transition-transform shrink-0"
                    title="Open document file"
                    aria-label="Open document file"
                  >
                    <LinkIcon className="size-3.5" />
                  </a>
                )}
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
