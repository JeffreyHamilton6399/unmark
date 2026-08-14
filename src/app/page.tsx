"use client";

import * as React from "react";
import { FileText, Type } from "lucide-react";
import { Header } from "@/components/unmark/header";
import { SiteFooter } from "@/components/site-footer";
import { TextPanel } from "@/components/unmark/text-panel";
import { FilePanel } from "@/components/unmark/file-panel";
import { OptionsPopover } from "@/components/unmark/options-popover";
import { cn } from "@/lib/utils";
import { DEFAULT_TEXT_OPTIONS, type TextOptions } from "@/lib/unicode";
import { DEFAULT_FILE_OPTIONS, type FileOptions } from "@/lib/files";

type Mode = "text" | "files";

const TABS = [
  { id: "text" as const, label: "Text", icon: Type },
  { id: "files" as const, label: "Files", icon: FileText },
];

export default function Page() {
  const [mode, setMode] = React.useState<Mode>("text");
  const [textOptions, setTextOptions] = React.useState<TextOptions>(DEFAULT_TEXT_OPTIONS);
  const [fileOptions, setFileOptions] = React.useState<FileOptions>(DEFAULT_FILE_OPTIONS);

  return (
    <div className="flex h-dvh flex-col">
      <Header />

      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b px-3">
        <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                mode === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon className="size-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <OptionsPopover
          textOptions={textOptions}
          onTextChange={setTextOptions}
          fileOptions={fileOptions}
          onFileChange={setFileOptions}
          showFileOptions={mode === "files"}
        />
      </div>

      <main className="flex min-h-0 flex-1 flex-col">
        {mode === "text" ? (
          <TextPanel options={textOptions} />
        ) : (
          <FilePanel fileOptions={fileOptions} textOptions={textOptions} />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
