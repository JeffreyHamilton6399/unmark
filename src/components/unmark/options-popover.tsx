"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TextOptions } from "@/lib/unicode";
import type { FileOptions } from "@/lib/files";

interface Row {
  key: keyof TextOptions;
  label: string;
  hint: string;
}

const REMOVAL_ROWS: Row[] = [
  { key: "tagChars", label: "Tag characters", hint: "Invisible ASCII at U+E0000" },
  { key: "variationSelectors", label: "Variation selectors", hint: "Invisible byte carriers" },
  { key: "zeroWidth", label: "Zero-width characters", hint: "ZWSP, ZWNJ, ZWJ, BOM" },
  { key: "bidi", label: "Bidirectional controls", hint: "Reorder rendered text" },
  { key: "controls", label: "Stray control characters", hint: "C0/C1 other than tab and newline" },
  { key: "exoticSpace", label: "Non-standard spaces", hint: "Normalised to a plain space" },
  { key: "softHyphen", label: "Soft hyphens", hint: "Invisible until a line wraps" },
  { key: "confusables", label: "Look-alike letters", hint: "Cyrillic or styled letters posing as ASCII" },
];

const BEHAVIOUR_ROWS: Row[] = [
  {
    key: "preserveLegitimateJoiners",
    label: "Protect emoji and Arabic/Indic text",
    hint: "Keeps joiners those scripts genuinely need",
  },
  { key: "tidyWhitespace", label: "Tidy leftover whitespace", hint: "Collapse gaps left by removals" },
  { key: "normalizeNfc", label: "Normalise to NFC", hint: "Composed and decomposed forms stop differing" },
  {
    key: "typography",
    label: "Rewrite smart typography",
    hint: "Cosmetic — curly quotes and em dashes are not watermarks",
  },
];

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer text-xs font-medium">
          {label}
        </Label>
        <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5 shrink-0" />
    </div>
  );
}

export function OptionsPopover({
  textOptions,
  onTextChange,
  fileOptions,
  onFileChange,
  showFileOptions,
}: {
  textOptions: TextOptions;
  onTextChange: (next: TextOptions) => void;
  fileOptions: FileOptions;
  onFileChange: (next: FileOptions) => void;
  showFileOptions: boolean;
}) {
  const activeCount = REMOVAL_ROWS.filter((row) => textOptions[row.key]).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <SlidersHorizontal className="size-3.5" />
          Options
          <span className="rounded-full bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            {activeCount}/{REMOVAL_ROWS.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[70vh] w-80 overflow-y-auto p-3">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Remove
        </p>
        <div className="divide-y">
          {REMOVAL_ROWS.map((row) => (
            <ToggleRow
              key={row.key}
              id={`opt-${row.key}`}
              label={row.label}
              hint={row.hint}
              checked={Boolean(textOptions[row.key])}
              onChange={(value) => onTextChange({ ...textOptions, [row.key]: value })}
            />
          ))}
        </div>

        <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Behaviour
        </p>
        <div className="divide-y">
          {BEHAVIOUR_ROWS.map((row) => (
            <ToggleRow
              key={row.key}
              id={`opt-${row.key}`}
              label={row.label}
              hint={row.hint}
              checked={Boolean(textOptions[row.key])}
              onChange={(value) => onTextChange({ ...textOptions, [row.key]: value })}
            />
          ))}
        </div>

        {showFileOptions && (
          <>
            <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Files
            </p>
            <div className="divide-y">
              <ToggleRow
                id="opt-keepColorProfile"
                label="Keep ICC colour profiles"
                hint="Removing one shifts how colours render"
                checked={fileOptions.keepColorProfile}
                onChange={(value) => onFileChange({ ...fileOptions, keepColorProfile: value })}
              />
              <ToggleRow
                id="opt-cleanText"
                label="Clean text inside documents"
                hint="Runs the text pass over document bodies and SVG markup"
                checked={fileOptions.cleanText}
                onChange={(value) => onFileChange({ ...fileOptions, cleanText: value })}
              />
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
