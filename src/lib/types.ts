// Shared vocabulary between the text layer and the file layer. Both produce
// Findings; the UI renders them identically whether they came from a paragraph
// of prose or the APP11 segment of a JPEG.

export type Severity = "high" | "medium" | "low";

/** Stable ids so the options bar and the findings list can talk about the same thing. */
export type MarkCategory =
  | "tag-chars"
  | "variation-selectors"
  | "zero-width"
  | "bidi"
  | "controls"
  | "exotic-space"
  | "soft-hyphen"
  | "confusables"
  | "typography";

export interface Finding {
  /** Category id, or a format-specific key like "png:iTXt". */
  id: string;
  label: string;
  /** One line explaining what this is and why it's here. */
  detail: string;
  count: number;
  severity: Severity;
  /** False when the category was detected but left alone (toggle off, or preserved as legitimate). */
  removed: boolean;
  /** Short sample of what was found, for the report. */
  sample?: string;
}

/**
 * Something invisible that carried actual data. Tag characters and variation
 * selectors can smuggle arbitrary bytes through text that looks completely
 * clean - decoding them is usually more interesting than the removal itself.
 */
export interface HiddenPayload {
  kind: "tag-chars" | "variation-selectors";
  /** Character offset in the original string. */
  offset: number;
  /** Decoded content, best-effort UTF-8. */
  decoded: string;
  /** Raw bytes, when the decode was not clean text. */
  bytes: number[];
  printable: boolean;
}

/** A span of the original text that was flagged, for the inspect highlighter. */
export interface MarkSpan {
  start: number;
  end: number;
  category: MarkCategory;
  /** U+XXXX of the first code point in the span. */
  code: string;
  name: string;
  action: "removed" | "replaced" | "kept";
  replacement?: string;
}

export const SEVERITY_ORDER: Record<Severity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};
