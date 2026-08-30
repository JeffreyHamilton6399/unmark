"use client";

import * as React from "react";
import { Check, Copy, Download, Eraser, Eye, KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { processText, type TextOptions } from "@/lib/unicode";
import type { HiddenPayload } from "@/lib/types";
import { FindingsList } from "./findings-list";
import { MarkedText } from "./marked-text";

type View = "clean" | "inspect";

/** Decoded hidden messages get their own callout - they are the headline result. */
function PayloadCallout({ payloads }: { payloads: HiddenPayload[] }) {
  const useful = payloads.filter((p) => p.printable && p.decoded.trim().length > 0);
  if (useful.length === 0) return null;

  return (
    <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
        <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
          {useful.length === 1 ? "Hidden message decoded" : `${useful.length} hidden messages decoded`}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        These characters were invisible in the text but carried readable data.
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {useful.map((payload, index) => (
          <li
            key={index}
            className="rounded border bg-background px-2 py-1.5 font-mono text-[11px] break-all"
          >
            <span className="text-muted-foreground">
              {payload.kind === "tag-chars" ? "tag chars" : "variation selectors"} @{payload.offset}:{" "}
            </span>
            {payload.decoded.slice(0, 300)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TextPanel({ options }: { options: TextOptions }) {
  const { toast } = useToast();
  const [input, setInput] = React.useState("");
  const [view, setView] = React.useState<View>("clean");
  const [copied, setCopied] = React.useState(false);

  const result = React.useMemo(() => processText(input, options), [input, options]);

  const handleCopy = React.useCallback(async () => {
    if (!result.text) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({
        title: "Could not copy",
        description: "Your browser blocked clipboard access. Select the text and copy manually.",
      });
    }
  }, [result.text, toast]);

  const handleDownload = React.useCallback(() => {
    const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "unmarked.txt";
    link.click();
    URL.revokeObjectURL(url);
  }, [result.text]);

  const removed = result.totalMarks;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_1fr_20rem]">
        {/* Input */}
        <section className="flex min-h-[16rem] flex-col overflow-hidden rounded-xl border">
          <div className="flex h-9 shrink-0 items-center justify-between border-b bg-muted/40 px-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Paste here
            </span>
            {input.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground"
                onClick={() => setInput("")}
              >
                <Trash2 className="size-3" />
                Clear
              </Button>
            )}
          </div>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            spellCheck={false}
            placeholder="Paste the text you want to check…"
            className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-relaxed outline-none placeholder:text-muted-foreground"
          />
          <div className="flex h-7 shrink-0 items-center gap-2 border-t px-3 text-[10px] text-muted-foreground">
            <span>{input.length.toLocaleString()} characters</span>
          </div>
        </section>

        {/* Output */}
        <section className="flex min-h-[16rem] flex-col overflow-hidden rounded-xl border">
          <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b bg-muted/40 px-2">
            <div className="flex items-center gap-0.5 rounded-md bg-background p-0.5">
              {(
                [
                  { id: "clean" as const, label: "Cleaned", icon: Eraser },
                  { id: "inspect" as const, label: "Inspect", icon: Eye },
                ]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id)}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors",
                    view === tab.id
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <tab.icon className="size-3" />
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-1.5 text-[11px]"
                onClick={handleDownload}
                disabled={!result.text}
              >
                <Download className="size-3" />
                <span className="hidden sm:inline">Save</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-1.5 text-[11px]"
                onClick={handleCopy}
                disabled={!result.text}
              >
                {copied ? <Check className="size-3 text-lime-600 dark:text-lime-400" /> : <Copy className="size-3" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {view === "clean" ? (
              input.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">
                  The cleaned version appears here as you type.
                </p>
              ) : (
                <pre className="whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed">
                  {result.text}
                </pre>
              )
            ) : (
              <MarkedText text={input} marks={result.marks} />
            )}
          </div>

          <div className="flex h-7 shrink-0 items-center gap-2 border-t px-3 text-[10px] text-muted-foreground">
            {removed > 0 ? (
              <span className="font-medium text-foreground">
                {removed.toLocaleString()} {removed === 1 ? "mark" : "marks"} removed
              </span>
            ) : (
              <span>{input.length > 0 ? "No marks found" : "Waiting for input"}</span>
            )}
          </div>
        </section>

        {/* Report */}
        <aside className="flex min-h-0 flex-col gap-2 overflow-y-auto lg:max-h-full">
          <PayloadCallout payloads={result.payloads} />
          <FindingsList
            findings={result.findings}
            emptyMessage={
              input.length === 0
                ? "Paste some text to see what it contains."
                : "Nothing found. This text is clean."
            }
          />
        </aside>
      </div>
    </div>
  );
}
