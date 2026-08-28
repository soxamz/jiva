"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, FileTextIcon, HeartPulseIcon, UserCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Home",
      href: "/dashboard",
      icon: HomeIcon,
    },
    {
      label: "Records",
      href: "/documents",
      icon: FileTextIcon,
    },
    {
      label: "Arohi",
      href: "/intake",
      icon: HeartPulseIcon,
    },
    {
      label: "Profile",
      href: "/profile",
      icon: UserCircleIcon,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#E2E8F0] bg-white/95 backdrop-blur-md px-4 shadow-[0_-2px_10px_rgba(15,23,42,0.03)] pb-[calc(env(safe-area-inset-bottom,0px)+8px)] pt-2 md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 py-1 px-3 text-center transition-colors"
            >
              <Icon
                className={cn(
                  "size-5.5 transition-transform",
                  isActive ? "text-[#0D5F5A] scale-105" : "text-[#64748B]"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-semibold tracking-wide",
                  isActive ? "text-[#0D5F5A]" : "text-[#64748B]"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
