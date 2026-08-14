// The text layer.
//
// One pass over the code points, classifying each against the tables, with
// three context guards that keep the cleaner from breaking legitimate text:
//
//   1. ZWJ between two pictographs is an emoji sequence, not a fingerprint.
//   2. ZWNJ/ZWJ next to Arabic or Indic letters is orthography, not a fingerprint.
//   3. A Cyrillic letter is only a homoglyph if the word around it is Latin.
//
// Without these, cleaning would corrupt family emoji, Persian, Hindi and every
// line of genuine Russian prose — a much worse outcome than a missed mark.

import {
  BIDI,
  CATEGORY_META,
  CONFUSABLES,
  EXOTIC_SPACE,
  TYPOGRAPHY,
  TYPOGRAPHY_NAMES,
  ZERO_WIDTH,
  foldStyledLatin,
  isStrayControl,
  isTagChar,
  isVariationSelector,
} from "./unicode-tables";
import type { Finding, HiddenPayload, MarkCategory, MarkSpan } from "./types";
import { SEVERITY_ORDER } from "./types";

export interface TextOptions {
  tagChars: boolean;
  variationSelectors: boolean;
  zeroWidth: boolean;
  bidi: boolean;
  controls: boolean;
  exoticSpace: boolean;
  softHyphen: boolean;
  confusables: boolean;
  typography: boolean;
  /** Keep ZWJ that joins emoji, and joiners required by Arabic/Indic scripts. */
  preserveLegitimateJoiners: boolean;
  /** Collapse runs of spaces and trailing whitespace left behind after removal. */
  tidyWhitespace: boolean;
  /** Normalise to NFC so composed and decomposed forms stop being distinguishable. */
  normalizeNfc: boolean;
}

export const DEFAULT_TEXT_OPTIONS: TextOptions = {
  tagChars: true,
  variationSelectors: true,
  zeroWidth: true,
  bidi: true,
  controls: true,
  exoticSpace: true,
  softHyphen: true,
  confusables: true,
  typography: false,
  preserveLegitimateJoiners: true,
  tidyWhitespace: true,
  normalizeNfc: true,
};

export interface TextResult {
  text: string;
  findings: Finding[];
  marks: MarkSpan[];
  payloads: HiddenPayload[];
  totalMarks: number;
  changed: boolean;
}

// Built at runtime so the \p{...} escapes aren't subject to the ES2017 target.
const PICTOGRAPHIC = new RegExp("\\p{Extended_Pictographic}", "u");
const JOINING_SCRIPT = new RegExp(
  "[\\p{Script=Arabic}\\p{Script=Devanagari}\\p{Script=Bengali}\\p{Script=Gurmukhi}" +
    "\\p{Script=Gujarati}\\p{Script=Oriya}\\p{Script=Tamil}\\p{Script=Telugu}" +
    "\\p{Script=Kannada}\\p{Script=Malayalam}\\p{Script=Sinhala}\\p{Script=Thaana}" +
    "\\p{Script=Syriac}\\p{Script=Mongolian}\\p{Script=Nko}]",
  "u",
);
const WORD_CHAR = new RegExp("[\\p{L}\\p{M}\\p{N}_]", "u");

function codePointAtSafe(s: string, i: number): number {
  return s.codePointAt(i) ?? 0;
}

function isPictographic(ch: string): boolean {
  return ch.length > 0 && PICTOGRAPHIC.test(ch);
}

/** The code point immediately before index i, skipping nothing. */
function prevCodePoint(s: string, i: number): string {
  if (i <= 0) return "";
  const before = s.slice(Math.max(0, i - 2), i);
  const cp = before.codePointAt(0);
  // If the two chars before form a surrogate pair, take both.
  if (before.length === 2 && cp !== undefined && cp > 0xffff) return before;
  return s[i - 1] ?? "";
}

function nextCodePoint(s: string, i: number): string {
  if (i >= s.length) return "";
  const cp = s.codePointAt(i);
  if (cp === undefined) return "";
  return String.fromCodePoint(cp);
}

/**
 * Marks which offsets sit inside a word that mixes scripts. A confusable is
 * only substituted when its word also contains an ASCII Latin letter, so a
 * genuinely Cyrillic word is left completely alone.
 */
function computeMixedScriptMask(s: string): Uint8Array {
  const mask = new Uint8Array(s.length);
  let i = 0;
  while (i < s.length) {
    const cp = codePointAtSafe(s, i);
    const ch = String.fromCodePoint(cp);
    const width = ch.length;
    if (!WORD_CHAR.test(ch)) {
      i += width;
      continue;
    }
    // Walk to the end of this word.
    const start = i;
    let hasAsciiLatin = false;
    let hasConfusable = false;
    let j = i;
    while (j < s.length) {
      const c = codePointAtSafe(s, j);
      const cs = String.fromCodePoint(c);
      if (!WORD_CHAR.test(cs)) break;
      if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) hasAsciiLatin = true;
      if (CONFUSABLES[c] !== undefined) hasConfusable = true;
      j += cs.length;
    }
    if (hasAsciiLatin && hasConfusable) mask.fill(1, start, j);
    i = j;
  }
  return mask;
}

function decodeTagRun(codePoints: number[]): HiddenPayload["decoded"] {
  return codePoints.map((cp) => String.fromCharCode(cp - 0xe0000)).join("");
}

function variationSelectorByte(cp: number): number {
  if (cp >= 0xfe00 && cp <= 0xfe0f) return cp - 0xfe00;
  return cp - 0xe0100 + 16;
}

// Written as escapes rather than literal bytes so the source stays editable.
const NON_PRINTABLE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

function bytesToText(bytes: number[]): { text: string; printable: boolean } {
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const text = decoder.decode(new Uint8Array(bytes));
    const printable = !NON_PRINTABLE.test(text);
    return { text, printable };
  } catch {
    return { text: "", printable: false };
  }
}

export function processText(
  input: string,
  options: TextOptions = DEFAULT_TEXT_OPTIONS,
): TextResult {
  const marks: MarkSpan[] = [];
  const payloads: HiddenPayload[] = [];
  const out: string[] = [];
  // Always computed, even when substitution is off, so inspect mode still
  // reports homoglyphs rather than silently ignoring them.
  const mixedMask = computeMixedScriptMask(input);

  // Buffers for runs of invisible carriers, so a hidden message is decoded
  // as a whole rather than one character at a time.
  let tagRun: { start: number; cps: number[] } | null = null;
  let vsRun: { start: number; cps: number[] } | null = null;

  const flushTagRun = () => {
    if (!tagRun || tagRun.cps.length === 0) return;
    const decoded = decodeTagRun(tagRun.cps).replace(CONTROL_CHARS, "");
    if (decoded.trim().length > 0) {
      payloads.push({
        kind: "tag-chars",
        offset: tagRun.start,
        decoded,
        bytes: tagRun.cps.map((cp) => cp - 0xe0000),
        printable: true,
      });
    }
    tagRun = null;
  };

  const flushVsRun = () => {
    if (!vsRun || vsRun.cps.length < 2) {
      vsRun = null;
      return;
    }
    const bytes = vsRun.cps.map(variationSelectorByte);
    const { text, printable } = bytesToText(bytes);
    payloads.push({
      kind: "variation-selectors",
      offset: vsRun.start,
      decoded: text,
      bytes,
      printable: printable && text.trim().length > 0,
    });
    vsRun = null;
  };

  let i = 0;
  while (i < input.length) {
    const cp = codePointAtSafe(input, i);
    const ch = String.fromCodePoint(cp);
    const width = ch.length;
    const start = i;
    i += width;

    const push = (
      category: MarkCategory,
      name: string,
      replacement: string,
      enabled: boolean,
    ) => {
      const action = !enabled ? "kept" : replacement === "" ? "removed" : "replaced";
      marks.push({
        start,
        end: start + width,
        category,
        code: "U+" + cp.toString(16).toUpperCase().padStart(4, "0"),
        name,
        action,
        replacement: replacement || undefined,
      });
      out.push(enabled ? replacement : ch);
    };

    // --- Tag characters -------------------------------------------------
    if (isTagChar(cp)) {
      if (!tagRun) tagRun = { start, cps: [] };
      tagRun.cps.push(cp);
      push("tag-chars", "TAG CHARACTER", "", options.tagChars);
      continue;
    }
    if (tagRun) flushTagRun();

    // --- Variation selectors --------------------------------------------
    if (isVariationSelector(cp)) {
      const prev = prevCodePoint(input, start);
      const legitEmoji =
        options.preserveLegitimateJoiners &&
        (cp === 0xfe0f || cp === 0xfe0e) &&
        isPictographic(prev);
      if (legitEmoji) {
        out.push(ch);
        if (vsRun) flushVsRun();
        continue;
      }
      if (!vsRun) vsRun = { start, cps: [] };
      vsRun.cps.push(cp);
      push(
        "variation-selectors",
        cp <= 0xfe0f ? "VARIATION SELECTOR" : "VARIATION SELECTOR SUPPLEMENT",
        "",
        options.variationSelectors,
      );
      continue;
    }
    if (vsRun) flushVsRun();

    // --- Zero-width ------------------------------------------------------
    const zwName = ZERO_WIDTH[cp];
    if (zwName !== undefined) {
      if (options.preserveLegitimateJoiners && (cp === 0x200d || cp === 0x200c)) {
        const prev = prevCodePoint(input, start);
        const next = nextCodePoint(input, i);
        // Emoji ZWJ sequence: 👨‍👩‍👧 is three pictographs joined by U+200D.
        if (cp === 0x200d && isPictographic(prev) && isPictographic(next)) {
          out.push(ch);
          continue;
        }
        // Required orthography in Arabic, Persian, Hindi and friends.
        if (JOINING_SCRIPT.test(prev) || JOINING_SCRIPT.test(next)) {
          out.push(ch);
          continue;
        }
      }
      push("zero-width", zwName, "", options.zeroWidth);
      continue;
    }

    // --- Bidirectional controls -----------------------------------------
    const bidiName = BIDI[cp];
    if (bidiName !== undefined) {
      push("bidi", bidiName, "", options.bidi);
      continue;
    }

    // --- Soft hyphen ------------------------------------------------------
    if (cp === 0x00ad) {
      push("soft-hyphen", "SOFT HYPHEN", "", options.softHyphen);
      continue;
    }

    // --- Non-standard spaces ---------------------------------------------
    const spaceName = EXOTIC_SPACE[cp];
    if (spaceName !== undefined) {
      push("exotic-space", spaceName, " ", options.exoticSpace);
      continue;
    }

    // --- Stray controls ---------------------------------------------------
    if (isStrayControl(cp)) {
      push("controls", "CONTROL CHARACTER", "", options.controls);
      continue;
    }

    // --- Styled Latin (math alphanumerics, fullwidth) ---------------------
    // Unambiguously Latin already, so no mixed-script guard needed.
    const folded = foldStyledLatin(cp);
    if (folded !== null) {
      push("confusables", "STYLED LATIN LETTER", folded, options.confusables);
      continue;
    }

    // --- Cross-script homoglyphs ------------------------------------------
    const confusable = CONFUSABLES[cp];
    if (confusable !== undefined && mixedMask[start] === 1) {
      push("confusables", "HOMOGLYPH", confusable, options.confusables);
      continue;
    }

    // --- Smart typography (cosmetic) --------------------------------------
    const typo = TYPOGRAPHY[cp];
    if (typo !== undefined) {
      // Only reported when the user asked for it; otherwise it's just prose.
      if (options.typography) {
        push("typography", TYPOGRAPHY_NAMES[cp] ?? "PUNCTUATION", typo, true);
      } else {
        out.push(ch);
      }
      continue;
    }

    out.push(ch);
  }

  flushTagRun();
  flushVsRun();

  let text = out.join("");

  if (options.tidyWhitespace) {
    // Removal leaves double spaces and ragged line ends behind.
    text = text
      .split("\n")
      .map((line) => line.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/g, ""))
      .join("\n");
  }

  let nfcChanged = false;
  if (options.normalizeNfc) {
    const normalized = text.normalize("NFC");
    nfcChanged = normalized !== text;
    text = normalized;
  }

  return {
    text,
    findings: buildFindings(marks, nfcChanged, input),
    marks,
    payloads,
    totalMarks: marks.filter((m) => m.action !== "kept").length,
    changed: text !== input,
  };
}

function buildFindings(marks: MarkSpan[], nfcChanged: boolean, source: string): Finding[] {
  const byCategory = new Map<MarkCategory, MarkSpan[]>();
  for (const mark of marks) {
    const list = byCategory.get(mark.category);
    if (list) list.push(mark);
    else byCategory.set(mark.category, [mark]);
  }

  const findings: Finding[] = [];
  for (const [category, list] of byCategory) {
    const meta = CATEGORY_META[category];
    const removed = list.some((m) => m.action !== "kept");
    // Show the distinct code points involved rather than the raw invisible text.
    const codes = Array.from(new Set(list.map((m) => m.code))).slice(0, 4);
    findings.push({
      id: category,
      label: meta.label,
      detail: meta.detail,
      count: list.length,
      severity: meta.severity,
      removed,
      sample: codes.join(", ") + (codes.length < new Set(list.map((m) => m.code)).size ? ", …" : ""),
    });
  }

  if (nfcChanged) {
    findings.push({
      id: "nfc",
      label: "Unnormalised composition",
      detail:
        "Some characters were stored decomposed. Composed and decomposed forms look identical but differ in the bytes.",
      count: 1,
      severity: "low",
      removed: true,
    });
  }

  findings.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.count - a.count,
  );
  return findings;
}

/** Inspect without modifying — same scan, every category left in place. */
export function inspectText(input: string): TextResult {
  const inspectOptions: TextOptions = {
    tagChars: false,
    variationSelectors: false,
    zeroWidth: false,
    bidi: false,
    controls: false,
    exoticSpace: false,
    softHyphen: false,
    confusables: false,
    typography: false,
    preserveLegitimateJoiners: true,
    tidyWhitespace: false,
    normalizeNfc: false,
  };
  return processText(input, inspectOptions);
}
