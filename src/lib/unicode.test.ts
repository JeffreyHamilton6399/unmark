import { describe, expect, test } from "bun:test";
import { DEFAULT_TEXT_OPTIONS, processText, inspectText } from "./unicode";

const clean = (s: string) => processText(s).text;

describe("invisible carriers", () => {
  test("strips zero-width characters", () => {
    expect(clean("he​llo‍wor﻿ld")).toBe("helloworld");
  });

  test("strips bidi controls", () => {
    expect(clean("safe‮txet‬")).toBe("safetxet");
  });

  test("strips tag characters and decodes the payload", () => {
    // "hi" encoded in the tag-character block.
    const hidden = "\u{E0068}\u{E0069}";
    const result = processText("visible" + hidden);
    expect(result.text).toBe("visible");
    expect(result.payloads[0].kind).toBe("tag-chars");
    expect(result.payloads[0].decoded).toBe("hi");
  });

  test("decodes a variation-selector payload", () => {
    // Bytes 0x41 0x42 ("AB") encoded in the VS supplement block.
    const enc = (b: number) =>
      b < 16 ? String.fromCodePoint(0xfe00 + b) : String.fromCodePoint(0xe0100 + b - 16);
    const result = processText("x" + enc(0x41) + enc(0x42));
    expect(result.text).toBe("x");
    expect(result.payloads[0].decoded).toBe("AB");
    expect(result.payloads[0].printable).toBe(true);
  });

  test("removes soft hyphens and stray controls", () => {
    expect(clean("we­lldone")).toBe("welldone");
  });
});

describe("context guards", () => {
  test("keeps ZWJ inside an emoji sequence", () => {
    const family = "\u{1F468}‍\u{1F469}‍\u{1F467}";
    expect(clean(family)).toBe(family);
  });

  test("keeps VS16 that gives an emoji its colour presentation", () => {
    const heart = "❤️";
    expect(clean(heart)).toBe(heart);
  });

  test("keeps ZWNJ required by Persian orthography", () => {
    const persian = "می‌خواهم";
    expect(clean(persian)).toBe(persian);
  });

  test("strips a bare ZWJ between Latin letters", () => {
    expect(clean("a‍b")).toBe("ab");
  });
});

describe("homoglyphs", () => {
  test("folds Cyrillic inside an otherwise-Latin word", () => {
    // "pаypal" with a Cyrillic а
    expect(clean("pаypal")).toBe("paypal");
  });

  test("leaves genuine Cyrillic prose alone", () => {
    const russian = "привет мир";
    expect(clean(russian)).toBe(russian);
  });

  test("folds mathematical alphanumerics unconditionally", () => {
    expect(clean("\u{1D407}\u{1D41E}\u{1D425}\u{1D425}\u{1D428}")).toBe("Hello");
  });

  test("folds fullwidth forms", () => {
    expect(clean("Ｈｉ")).toBe("Hi");
  });
});

describe("spaces and typography", () => {
  test("normalises exotic spaces to U+0020", () => {
    expect(clean("a b c　d")).toBe("a b c d");
  });

  test("leaves smart typography alone by default", () => {
    expect(clean("it’s — fine")).toBe("it’s — fine");
  });

  test("rewrites typography when explicitly enabled", () => {
    const result = processText("it’s — fine…", {
      ...DEFAULT_TEXT_OPTIONS,
      typography: true,
    });
    expect(result.text).toBe("it's - fine...");
  });
});

describe("reporting", () => {
  test("clean text produces no findings", () => {
    const result = processText("A perfectly ordinary sentence.");
    expect(result.findings).toHaveLength(0);
    expect(result.changed).toBe(false);
    expect(result.totalMarks).toBe(0);
  });

  test("inspect reports without modifying", () => {
    const dirty = "he​llo pаypal";
    const result = inspectText(dirty);
    expect(result.text).toBe(dirty);
    expect(result.marks.every((m) => m.action === "kept")).toBe(true);
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain("zero-width");
    expect(ids).toContain("confusables");
  });

  test("groups findings by category with counts", () => {
    const result = processText("a​b​c‮d");
    const zw = result.findings.find((f) => f.id === "zero-width");
    expect(zw?.count).toBe(2);
    expect(zw?.removed).toBe(true);
    expect(result.findings[0].severity).toBe("high");
  });

  test("tidies whitespace left behind by removals", () => {
    expect(clean("word​  ​  next")).toBe("word next");
  });
});
