// Shared plumbing for the file layer.
//
// Every stripper works on bytes and rebuilds the container by hand. That keeps
// the image data bit-for-bit identical - unlike a canvas re-encode, which
// scrubs metadata by throwing the original pixels away and generating new ones.

import type { Finding, Severity } from "../types";

export interface FileResult {
  blob: Blob;
  name: string;
  findings: Finding[];
  bytesBefore: number;
  bytesAfter: number;
  changed: boolean;
  /** True when the payload (pixels, page content) was copied through untouched. */
  lossless: boolean;
  /** Set when the format was recognised but could not be processed. */
  error?: string;
}

export interface FileOptions {
  /** ICC colour profiles are metadata, but dropping them shifts colour. */
  keepColorProfile: boolean;
  /** Run the text layer over textual formats and embedded document text. */
  cleanText: boolean;
}

export const DEFAULT_FILE_OPTIONS: FileOptions = {
  keepColorProfile: true,
  cleanText: true,
};

export function finding(
  id: string,
  label: string,
  detail: string,
  severity: Severity,
  count = 1,
  sample?: string,
): Finding {
  return { id, label, detail, count, severity, removed: true, sample };
}

export const u32 = (b: Uint8Array, o: number) =>
  ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

export const u32le = (b: Uint8Array, o: number) =>
  (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

export function writeU32le(b: Uint8Array, o: number, v: number) {
  b[o] = v & 0xff;
  b[o + 1] = (v >>> 8) & 0xff;
  b[o + 2] = (v >>> 16) & 0xff;
  b[o + 3] = (v >>> 24) & 0xff;
}

export function ascii(b: Uint8Array, o: number, len: number): string {
  let s = "";
  for (let i = 0; i < len && o + i < b.length; i++) s += String.fromCharCode(b[o + i]);
  return s;
}

export function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Roll up repeat findings with the same id into one entry with a count. */
export function mergeFindings(list: Finding[]): Finding[] {
  const map = new Map<string, Finding>();
  for (const f of list) {
    const existing = map.get(f.id);
    if (existing) {
      existing.count += f.count;
      if (f.sample && !existing.sample?.includes(f.sample)) {
        existing.sample = [existing.sample, f.sample].filter(Boolean).join(", ");
      }
    } else {
      map.set(f.id, { ...f });
    }
  }
  return [...map.values()];
}

/**
 * Signatures for the generation-parameter blocks that image tools bury in text
 * metadata. Finding one of these is usually the most informative thing in a
 * report - it names the tool and often preserves the entire prompt.
 */
export const GENERATOR_KEYS: Record<string, string> = {
  parameters: "Stable Diffusion / Automatic1111 generation parameters",
  prompt: "ComfyUI prompt graph",
  workflow: "ComfyUI workflow graph",
  "sd-metadata": "InvokeAI generation metadata",
  "invokeai_metadata": "InvokeAI generation metadata",
  Comment: "NovelAI generation metadata",
  Software: "Originating software tag",
  Source: "Originating source tag",
  Title: "Embedded title",
  Author: "Embedded author",
  Description: "Embedded description",
  Copyright: "Embedded copyright",
  "Creation Time": "Creation timestamp",
  "XML:com.adobe.xmp": "Adobe XMP packet",
  "openai": "OpenAI generation metadata",
  "dalle": "OpenAI DALL-E metadata",
};

export function describeTextKey(key: string): string {
  return GENERATOR_KEYS[key] ?? `Text metadata "${key}"`;
}
