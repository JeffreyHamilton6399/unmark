"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { MarkCategory, MarkSpan } from "@/lib/types";

/** Short chip labels — the whole point is that these characters render as nothing. */
const CHIP: Record<MarkCategory, string> = {
  "tag-chars": "TAG",
  "variation-selectors": "VS",
  "zero-width": "ZW",
  bidi: "BIDI",
  controls: "CTRL",
  "exotic-space": "SP",
  "soft-hyphen": "SHY",
  confusables: "",
  typography: "",
};

const TONE: Record<MarkCategory, string> = {
  "tag-chars": "bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300",
  "variation-selectors": "bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300",
  "zero-width": "bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300",
  bidi: "bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300",
  controls: "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300",
  "exotic-space": "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300",
  "soft-hyphen": "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300",
  confusables: "bg-violet-500/15 text-violet-700 ring-violet-500/30 dark:text-violet-300",
  typography: "bg-sky-500/15 text-sky-700 ring-sky-500/30 dark:text-sky-300",
};

/** Rendering every mark in a novel-length paste would lock the tab up. */
const RENDER_LIMIT = 40000;

export function MarkedText({ text, marks }: { text: string; marks: MarkSpan[] }) {
  const nodes = React.useMemo(() => {
    const slice = text.slice(0, RENDER_LIMIT);
    const visible = marks
      .filter((m) => m.start < RENDER_LIMIT)
      .sort((a, b) => a.start - b.start);

    const out: React.ReactNode[] = [];
    let cursor = 0;

    visible.forEach((mark, index) => {
      if (mark.start > cursor) out.push(slice.slice(cursor, mark.start));
      const chip = CHIP[mark.category];
      const original = slice.slice(mark.start, mark.end);
      const title = `${mark.code} ${mark.name}${
        mark.replacement ? ` → "${mark.replacement}"` : " → removed"
      }`;

      out.push(
        <span
          key={`${mark.start}-${index}`}
          title={title}
          className={cn(
            "mx-px rounded px-1 align-baseline font-mono text-[0.7em] ring-1 ring-inset",
            TONE[mark.category],
          )}
        >
          {chip || original}
        </span>,
      );
      cursor = mark.end;
    });

    if (cursor < slice.length) out.push(slice.slice(cursor));
    if (text.length > RENDER_LIMIT) {
      out.push(
        <span key="truncated" className="text-muted-foreground">
          {`\n\n… ${(text.length - RENDER_LIMIT).toLocaleString()} more characters not shown`}
        </span>,
      );
    }
    return out;
  }, [text, marks]);

  if (text.length === 0) {
    return (
      <p className="p-3 text-xs text-muted-foreground">
        Paste text on the left to see what is hiding in it.
      </p>
    );
  }

  return (
    <div className="whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed">
      {nodes}
    </div>
  );
}
