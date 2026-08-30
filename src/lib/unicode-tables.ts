// Code point tables for the text layer.
//
// Every entry here is a character that is either invisible, or visible but
// pretending to be a different character. Names follow the Unicode names so a
// finding can be looked up against the standard.

import type { MarkCategory, Severity } from "./types";

export interface CharInfo {
  category: MarkCategory;
  name: string;
  /** What to put in its place. Empty string deletes it. */
  replacement: string;
}

/** Zero-width and invisible formatting characters. */
export const ZERO_WIDTH: Record<number, string> = {
  0x200b: "ZERO WIDTH SPACE",
  0x200c: "ZERO WIDTH NON-JOINER",
  0x200d: "ZERO WIDTH JOINER",
  0x2060: "WORD JOINER",
  0x2061: "FUNCTION APPLICATION",
  0x2062: "INVISIBLE TIMES",
  0x2063: "INVISIBLE SEPARATOR",
  0x2064: "INVISIBLE PLUS",
  0xfeff: "ZERO WIDTH NO-BREAK SPACE (BOM)",
  0x180e: "MONGOLIAN VOWEL SEPARATOR",
  0x115f: "HANGUL CHOSEONG FILLER",
  0x1160: "HANGUL JUNGSEONG FILLER",
  0x3164: "HANGUL FILLER",
  0xffa0: "HALFWIDTH HANGUL FILLER",
};

/**
 * Bidirectional controls. These are the "Trojan Source" characters: they can
 * make text render in an order that differs from its byte order, which is how
 * source-code review attacks hide their payload.
 */
export const BIDI: Record<number, string> = {
  0x061c: "ARABIC LETTER MARK",
  0x200e: "LEFT-TO-RIGHT MARK",
  0x200f: "RIGHT-TO-LEFT MARK",
  0x202a: "LEFT-TO-RIGHT EMBEDDING",
  0x202b: "RIGHT-TO-LEFT EMBEDDING",
  0x202c: "POP DIRECTIONAL FORMATTING",
  0x202d: "LEFT-TO-RIGHT OVERRIDE",
  0x202e: "RIGHT-TO-LEFT OVERRIDE",
  0x2066: "LEFT-TO-RIGHT ISOLATE",
  0x2067: "RIGHT-TO-LEFT ISOLATE",
  0x2068: "FIRST STRONG ISOLATE",
  0x2069: "POP DIRECTIONAL ISOLATE",
};

/**
 * Spaces that are not U+0020. Mostly typographic, but they survive copy/paste
 * and make a distinctive fingerprint, so they get normalised rather than deleted.
 */
export const EXOTIC_SPACE: Record<number, string> = {
  0x00a0: "NO-BREAK SPACE",
  0x1680: "OGHAM SPACE MARK",
  0x2000: "EN QUAD",
  0x2001: "EM QUAD",
  0x2002: "EN SPACE",
  0x2003: "EM SPACE",
  0x2004: "THREE-PER-EM SPACE",
  0x2005: "FOUR-PER-EM SPACE",
  0x2006: "SIX-PER-EM SPACE",
  0x2007: "FIGURE SPACE",
  0x2008: "PUNCTUATION SPACE",
  0x2009: "THIN SPACE",
  0x200a: "HAIR SPACE",
  0x202f: "NARROW NO-BREAK SPACE",
  0x205f: "MEDIUM MATHEMATICAL SPACE",
  0x3000: "IDEOGRAPHIC SPACE",
};

/**
 * Letters from other scripts that render identically to ASCII. Only applied
 * inside words that already contain ASCII letters - see the mixed-script guard
 * in unicode.ts. Without that guard this table would mangle genuine Russian
 * or Greek text, which is a far worse failure than leaving a homoglyph in.
 */
export const CONFUSABLES: Record<number, string> = {
  // Cyrillic
  0x0410: "A", 0x0412: "B", 0x0415: "E", 0x041a: "K", 0x041c: "M",
  0x041d: "H", 0x041e: "O", 0x0420: "P", 0x0421: "C", 0x0422: "T",
  0x0423: "Y", 0x0425: "X", 0x0405: "S", 0x0406: "I", 0x0408: "J",
  0x04ae: "Y", 0x0492: "F", 0x0417: "3",
  0x0430: "a", 0x0435: "e", 0x043e: "o", 0x0440: "p", 0x0441: "c",
  0x0443: "y", 0x0445: "x", 0x0456: "i", 0x0458: "j", 0x0455: "s",
  0x0501: "d", 0x04bb: "h", 0x04cf: "l", 0x043c: "m", 0x0432: "b",
  // Greek
  0x0391: "A", 0x0392: "B", 0x0395: "E", 0x0396: "Z", 0x0397: "H",
  0x0399: "I", 0x039a: "K", 0x039c: "M", 0x039d: "N", 0x039f: "O",
  0x03a1: "P", 0x03a4: "T", 0x03a5: "Y", 0x03a7: "X",
  0x03bf: "o", 0x03b1: "a", 0x03c1: "p", 0x03f2: "c", 0x03b9: "i",
  0x03ba: "k", 0x03bd: "v", 0x03c5: "u",
  // Armenian / Cherokee strays that show up in filter-evasion text
  0x0585: "o", 0x0578: "n", 0x13a0: "D", 0x13c0: "G",
};

export const CONFUSABLE_NAMES: Record<number, string> = {};
for (const cp of Object.keys(CONFUSABLES)) {
  CONFUSABLE_NAMES[Number(cp)] = "HOMOGLYPH";
}

/**
 * Stylistic substitutions. These are NOT watermarks - they're ordinary
 * typography that happens to correlate with machine-written prose. Off by
 * default, and labelled as cosmetic in the UI, because removing them changes
 * how the text reads without removing any signal.
 */
export const TYPOGRAPHY: Record<number, string> = {
  0x2014: "-", // em dash
  0x2013: "-", // en dash
  0x2018: "'", // left single quote
  0x2019: "'", // right single quote
  0x201a: "'",
  0x201c: '"', // left double quote
  0x201d: '"', // right double quote
  0x201e: '"',
  0x2026: "...", // horizontal ellipsis
  0x2032: "'",
  0x2033: '"',
  0x00b7: "-", // middle dot used as a bullet
  0x2022: "-", // bullet
};

export const TYPOGRAPHY_NAMES: Record<number, string> = {
  0x2014: "EM DASH",
  0x2013: "EN DASH",
  0x2018: "LEFT SINGLE QUOTATION MARK",
  0x2019: "RIGHT SINGLE QUOTATION MARK",
  0x201a: "SINGLE LOW-9 QUOTATION MARK",
  0x201c: "LEFT DOUBLE QUOTATION MARK",
  0x201d: "RIGHT DOUBLE QUOTATION MARK",
  0x201e: "DOUBLE LOW-9 QUOTATION MARK",
  0x2026: "HORIZONTAL ELLIPSIS",
  0x2032: "PRIME",
  0x2033: "DOUBLE PRIME",
  0x00b7: "MIDDLE DOT",
  0x2022: "BULLET",
};

/** Mathematical alphanumerics and fullwidth forms fold back to plain ASCII. */
export function foldStyledLatin(cp: number): string | null {
  // Fullwidth A-Z a-z 0-9
  if (cp >= 0xff21 && cp <= 0xff3a) return String.fromCharCode(cp - 0xff21 + 65);
  if (cp >= 0xff41 && cp <= 0xff5a) return String.fromCharCode(cp - 0xff41 + 97);
  if (cp >= 0xff10 && cp <= 0xff19) return String.fromCharCode(cp - 0xff10 + 48);

  // Mathematical alphanumeric symbols: 13 contiguous 52-letter blocks of
  // A-Z a-z, plus assorted digit blocks. Each block maps straight back.
  const LETTER_BLOCKS = [
    0x1d400, 0x1d434, 0x1d468, 0x1d49c, 0x1d4d0, 0x1d504, 0x1d538,
    0x1d56c, 0x1d5a0, 0x1d5d4, 0x1d608, 0x1d63c, 0x1d670,
  ];
  for (const base of LETTER_BLOCKS) {
    if (cp >= base && cp < base + 26) return String.fromCharCode(cp - base + 65);
    if (cp >= base + 26 && cp < base + 52) return String.fromCharCode(cp - base - 26 + 97);
  }
  const DIGIT_BLOCKS = [0x1d7ce, 0x1d7d8, 0x1d7e2, 0x1d7ec, 0x1d7f6];
  for (const base of DIGIT_BLOCKS) {
    if (cp >= base && cp < base + 10) return String.fromCharCode(cp - base + 48);
  }
  return null;
}

/** Tag characters - a full invisible ASCII alphabet at U+E0000. */
export function isTagChar(cp: number): boolean {
  return cp >= 0xe0000 && cp <= 0xe007f;
}

/** Variation selectors: VS1-16 and the 240-strong supplement. */
export function isVariationSelector(cp: number): boolean {
  return (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef);
}

/** C0/C1 control characters, excluding tab, newline and carriage return. */
export function isStrayControl(cp: number): boolean {
  if (cp === 0x09 || cp === 0x0a || cp === 0x0d) return false;
  return (cp >= 0x00 && cp <= 0x1f) || (cp >= 0x7f && cp <= 0x9f);
}

export const CATEGORY_META: Record<
  MarkCategory,
  { label: string; detail: string; severity: Severity }
> = {
  "tag-chars": {
    label: "Tag characters",
    detail:
      "An invisible copy of ASCII at U+E0000. Renders as nothing and can carry an arbitrary hidden message.",
    severity: "high",
  },
  "variation-selectors": {
    label: "Variation selectors",
    detail:
      "Invisible modifiers. Legitimate after emoji, but the supplement block can smuggle a byte per character.",
    severity: "high",
  },
  "zero-width": {
    label: "Zero-width characters",
    detail:
      "Occupy no space but survive copy and paste. A common carrier for per-recipient text fingerprints.",
    severity: "high",
  },
  bidi: {
    label: "Bidirectional controls",
    detail:
      "Reorder how text renders without changing its bytes, the basis of Trojan Source attacks.",
    severity: "high",
  },
  controls: {
    label: "Stray control characters",
    detail: "C0/C1 controls other than tab and newline. Almost never intentional in prose.",
    severity: "medium",
  },
  "exotic-space": {
    label: "Non-standard spaces",
    detail:
      "Spaces that aren't U+0020. Visually identical, distinctive in the bytes. Normalised, not deleted.",
    severity: "medium",
  },
  "soft-hyphen": {
    label: "Soft hyphens",
    detail: "Invisible unless a line breaks there. Easy to scatter through a document unnoticed.",
    severity: "medium",
  },
  confusables: {
    label: "Look-alike letters",
    detail:
      "Cyrillic, Greek or styled letters standing in for ASCII. Only changed inside words that are otherwise Latin.",
    severity: "medium",
  },
  typography: {
    label: "Smart typography",
    detail:
      "Curly quotes, em dashes, ellipses. Cosmetic, not a watermark, off by default.",
    severity: "low",
  },
};
