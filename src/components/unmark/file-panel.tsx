"use client";

import * as React from "react";
import {
  AlertCircle,
  Check,
  Download,
  FileArchive,
  Loader2,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { cleanFile, SUPPORTED_EXTENSIONS, type FileOptions, type FileResult } from "@/lib/files";
import type { TextOptions } from "@/lib/unicode";
import { FindingsList } from "./findings-list";

interface Item {
  id: string;
  file: File;
  status: "queued" | "working" | "done" | "error";
  result?: FileResult;
}

/** Browsers get unhappy running many decodes at once; two keeps the tab responsive. */
const CONCURRENCY = 2;

let counter = 0;
const nextId = () => `f${(counter += 1)}-${Date.now().toString(36)}`;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function cleanedName(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return `${name}-unmarked`;
  return `${name.slice(0, dot)}-unmarked${name.slice(dot)}`;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function FilePanel({
  fileOptions,
  textOptions,
}: {
  fileOptions: FileOptions;
  textOptions: TextOptions;
}) {
  const { toast } = useToast();
  const [items, setItems] = React.useState<Item[]>([]);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [zipping, setZipping] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const patch = React.useCallback((id: string, next: Partial<Item>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...next } : item)));
  }, []);

  // Options travel with the queue rather than through a ref, so a run always
  // finishes on the settings it started with.
  const runQueue = React.useCallback(
    async (queue: Item[], opts: { fileOptions: FileOptions; textOptions: TextOptions }) => {
      let cursor = 0;
      const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        while (cursor < queue.length) {
          const item = queue[cursor++];
          patch(item.id, { status: "working" });
          try {
            const result = await cleanFile(item.file, opts.fileOptions, opts.textOptions);
            patch(item.id, { status: result.error ? "error" : "done", result });
          } catch (error) {
            patch(item.id, {
              status: "error",
              result: {
                blob: item.file,
                name: item.file.name,
                findings: [],
                bytesBefore: item.file.size,
                bytesAfter: item.file.size,
                changed: false,
                lossless: true,
                error: error instanceof Error ? error.message : "Could not process this file.",
              },
            });
          }
        }
      });
      await Promise.all(workers);
    },
    [patch],
  );

  const addFiles = React.useCallback(
    (list: File[]) => {
      if (list.length === 0) return;
      const fresh: Item[] = list.map((file) => ({ id: nextId(), file, status: "queued" }));
      setItems((prev) => [...prev, ...fresh]);
      setSelected((prev) => prev ?? fresh[0].id);
      void runQueue(fresh, { fileOptions, textOptions });
    },
    [runQueue, fileOptions, textOptions],
  );

  // Re-run everything when the options change, so the output always matches
  // what the panel currently says it will do.
  const optionSignature = JSON.stringify({ fileOptions, textOptions });
  const firstRun = React.useRef(true);
  const itemsRef = React.useRef(items);

  // Synced in its own effect — assigning during render trips the React rules
  // and can hand a stale list to the re-run below.
  React.useEffect(() => {
    itemsRef.current = items;
  });

  React.useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const pending = itemsRef.current;
    if (pending.length === 0) return;
    setItems((prev) => prev.map((item) => ({ ...item, status: "queued" as const })));
    void runQueue(pending, { fileOptions, textOptions });
  }, [optionSignature, runQueue]);

  const downloadAll = React.useCallback(async () => {
    const done = items.filter((item) => item.status === "done" && item.result);
    if (done.length === 0) return;
    if (done.length === 1) {
      download(done[0].result!.blob, cleanedName(done[0].result!.name));
      return;
    }
    setZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const item of done) {
        zip.file(cleanedName(item.result!.name), item.result!.blob);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      download(blob, "unmarked.zip");
    } catch {
      toast({ title: "Could not build the zip", description: "Try downloading files individually." });
    } finally {
      setZipping(false);
    }
  }, [items, toast]);

  const current = items.find((item) => item.id === selected);
  const doneCount = items.filter((item) => item.status === "done").length;
  const working = items.some((item) => item.status === "working" || item.status === "queued");

  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div
          role="button"
          tabIndex={0}
          aria-label="Drop files here or click to choose"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            addFiles(Array.from(event.dataTransfer.files));
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          className={cn(
            "flex min-h-[300px] w-full max-w-md cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            dragOver ? "border-foreground/50 bg-muted/50" : "border-border hover:border-foreground/35 hover:bg-muted/30",
          )}
        >
          <Upload className="size-7 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Drop files here</p>
            <p className="mt-1 text-xs text-muted-foreground">or click to choose</p>
          </div>
          <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground">
            Images, PDFs, Office and OpenDocument files, and plain text.
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Nothing is uploaded — this runs entirely in your browser.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={SUPPORTED_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => inputRef.current?.click()}>
          <Upload className="size-3.5" />
          Add files
        </Button>
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={downloadAll}
          disabled={doneCount === 0 || zipping}
        >
          {zipping ? <Loader2 className="size-3.5 animate-spin" /> : doneCount > 1 ? <FileArchive className="size-3.5" /> : <Download className="size-3.5" />}
          {doneCount > 1 ? `Download ${doneCount} as zip` : "Download"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground"
          onClick={() => {
            setItems([]);
            setSelected(null);
          }}
        >
          <Trash2 className="size-3.5" />
          Clear
        </Button>
        {working && (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Working…
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={SUPPORTED_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* File list */}
        <ul className="flex min-h-0 flex-col gap-1.5 overflow-y-auto">
          {items.map((item) => {
            const result = item.result;
            const marks = result?.findings.filter((f) => f.removed).length ?? 0;
            return (
              <li key={item.id}>
                <button
                  onClick={() => setSelected(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    selected === item.id ? "border-foreground/30 bg-muted/60" : "hover:bg-muted/30",
                  )}
                >
                  <span className="shrink-0">
                    {item.status === "working" || item.status === "queued" ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : item.status === "error" ? (
                      <AlertCircle className="size-4 text-amber-500" />
                    ) : marks > 0 ? (
                      <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Check className="size-4 text-muted-foreground" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{item.file.name}</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {item.status === "error"
                        ? result?.error ?? "Could not process this file."
                        : result
                          ? `${formatBytes(result.bytesBefore)} → ${formatBytes(result.bytesAfter)}${
                              marks > 0 ? ` · ${marks} removed` : " · already clean"
                            }${result.lossless ? "" : " · rebuilt"}`
                          : "Waiting…"}
                    </span>
                  </span>
                  {result && item.status === "done" && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Download ${item.file.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        download(result.blob, cleanedName(result.name));
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          download(result.blob, cleanedName(result.name));
                        }
                      }}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                    >
                      <Download className="size-3.5" />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Report for the selected file */}
        <aside className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {current?.result ? (
            <>
              {!current.result.lossless && (
                <p className="rounded-lg border bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                  This format is rebuilt rather than edited in place, so the bytes change even
                  though the content does not.
                </p>
              )}
              <FindingsList
                findings={current.result.findings}
                emptyMessage={
                  current.result.error ?? "No metadata found. This file was already clean."
                }
              />
            </>
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-4 text-xs text-muted-foreground">
              Select a file to see what was found in it.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
