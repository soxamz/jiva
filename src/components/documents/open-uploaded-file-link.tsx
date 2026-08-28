import { ExternalLinkIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function OpenUploadedFileLink({
  href,
  label,
  className,
}: {
  href: string | null | undefined;
  label: string;
  className?: string;
}) {
  if (!href) {
    return null;
  }

  return (
    <a
      className={cn(
        "text-primary inline-flex w-fit items-center gap-1.5 text-sm font-medium hover:underline",
        className,
      )}
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {label}
      <ExternalLinkIcon className="size-3.5" />
    </a>
  );
}
