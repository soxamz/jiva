"use client";

import { Eye, ShieldAlert, ArrowUpRight, Lock, Key } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileHeader } from "./mobile-header";

interface MobileAccessLogProps {
  data: {
    auditLogs: Array<{
      id: string;
      action: string;
      targetResourceType: string;
      createdAt: Date;
    }>;
  };
}

export function MobileAccessLog({ data }: MobileAccessLogProps) {
  const logs = data.auditLogs ?? [];

  const getLogIcon = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes("BREAK_GLASS")) return { icon: ShieldAlert, bg: "bg-red-50 text-red-600 border-red-200/50" };
    if (act.includes("UPLOAD")) return { icon: ArrowUpRight, bg: "bg-teal-50 text-teal-650 border-teal-200/50" };
    if (act.includes("LOGIN") || act.includes("SIGN_UP")) return { icon: Lock, bg: "bg-amber-50 text-amber-600 border-amber-200/50" };
    return { icon: Eye, bg: "bg-sky-50 text-sky-600 border-sky-200/50" };
  };

  const getLogTitle = (action: string, type: string) => {
    const formattedAction = action.replaceAll("_", " ").toLowerCase();
    return (
      <span className="capitalize text-xs font-bold text-[#111827]">
        {formattedAction}
      </span>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-24 md:hidden">
      <MobileHeader title="Access log" showBack backHref="/profile" />

      <div className="p-4 flex flex-col gap-4">
        <div>
          <h2 className="text-base font-extrabold text-[#111827]">
            Who viewed your records
          </h2>
          <p className="text-[#64748B] text-[11px] mt-1 leading-relaxed">
            A full audit trail of physician and system access to your health vault.
          </p>
        </div>

        <div className="flex flex-col gap-3 mt-2">
          {logs.length === 0 ? (
            <div className="bg-white rounded-[20px] p-6 border border-[#E2E8F0] text-center text-xs text-[#64748B] shadow-sm">
              No audit activities recorded.
            </div>
          ) : (
            logs.map((log) => {
              const { icon: Icon, bg } = getLogIcon(log.action);
              const isCritical = log.action.toUpperCase().includes("BREAK_GLASS");

              return (
                <div
                  key={log.id}
                  className="bg-white border border-[#E2E8F0] rounded-[16px] p-4 shadow-sm flex items-center gap-3.5"
                >
                  {/* Action Icon Indicator */}
                  <div className={cn("size-10 rounded-[10px] flex items-center justify-center shrink-0 border", bg)}>
                    <Icon className="size-4.5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      {getLogTitle(log.action, log.targetResourceType)}
                      <span className="text-[10px] text-[#0D5F5A] font-bold shrink-0">
                        {new Date(log.createdAt).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="text-[#64748B] text-[10px] mt-0.5 font-medium leading-none">
                      Resource: <span className="font-bold text-[#334155]">{log.targetResourceType}</span>
                    </p>

                    <p className="text-[9px] text-[#64748B] mt-2 font-bold uppercase tracking-wider">
                      {new Date(log.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
