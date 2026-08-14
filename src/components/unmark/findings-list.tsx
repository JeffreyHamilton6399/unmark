"use client";

import * as React from "react";
import { AlertTriangle, Check, Eye, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Finding, Severity } from "@/lib/types";

const SEVERITY_STYLE: Record<Severity, { icon: React.ElementType; className: string; label: string }> = {
  high: {
    icon: ShieldAlert,
    className: "text-rose-600 dark:text-rose-400",
    label: "High",
  },
  medium: {
    icon: AlertTriangle,
    className: "text-amber-600 dark:text-amber-400",
    label: "Medium",
  },
  low: {
    icon: Info,
    className: "text-sky-600 dark:text-sky-400",
    label: "Low",
  },
};

export function FindingsList({
  findings,
  emptyMessage = "Nothing found. This looks clean.",
  className,
}: {
  findings: Finding[];
  emptyMessage?: string;
  className?: string;
}) {
  if (findings.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-dashed px-3 py-4 text-xs text-muted-foreground",
          className,
        )}
      >
        <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <ul className={cn("flex flex-col gap-1.5", className)}>
      {findings.map((finding) => {
        const style = SEVERITY_STYLE[finding.severity];
        const Icon = style.icon;
        return (
          <li
            key={finding.id}
            className="rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-muted/40"
          >
            <div className="flex items-start gap-2.5">
              <Icon className={cn("mt-0.5 size-4 shrink-0", style.className)} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-xs font-semibold">{finding.label}</span>
                  {finding.count > 1 && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      ×{finding.count}
                    </span>
                  )}
                  {!finding.removed && (
                    <span className="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      <Eye className="size-2.5" />
                      kept
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {finding.detail}
                </p>
                {finding.sample && (
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground/80">
                    {finding.sample}
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
