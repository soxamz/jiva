"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, LucideIcon } from "lucide-react";

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  backHref?: string;
  actionIcon?: LucideIcon;
  onActionClick?: () => void;
  rightElement?: React.ReactNode;
}

export function MobileHeader({
  title,
  showBack = false,
  backHref,
  actionIcon: ActionIcon,
  onActionClick,
  rightElement,
}: MobileHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-[#E2E8F0] bg-white px-4 py-3 md:hidden">
      <div className="flex w-10 items-center justify-start">
        {showBack && (
          <button
            onClick={handleBack}
            className="flex size-9 items-center justify-center rounded-full bg-[#F8FAFC] text-[#111827] active:scale-95 transition-transform"
            aria-label="Back"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}
      </div>

      <h1 className="text-[15px] font-bold tracking-tight text-[#111827] text-center flex-1 truncate">
        {title}
      </h1>

      <div className="flex w-10 items-center justify-end">
        {rightElement ? (
          rightElement
        ) : ActionIcon && onActionClick ? (
          <button
            onClick={onActionClick}
            className="flex size-9 items-center justify-center rounded-full bg-[#F8FAFC] text-[#111827] active:scale-95 transition-transform"
            aria-label="Header Action"
          >
            <ActionIcon className="size-4.5" />
          </button>
        ) : null}
      </div>
    </header>
  );
}
