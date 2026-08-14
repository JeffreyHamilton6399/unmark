// WebP is a RIFF container. Metadata sits in its own EXIF/XMP chunks, and the
// VP8X header carries flag bits announcing which of them exist — so removing a
// chunk means clearing its bit too, or decoders go looking for something gone.

import type { Finding } from "../types";
import { type FileOptions, ascii, concat, finding, mergeFindings, u32le, writeU32le } from "./common";

const FLAG_ICC = 0x20;
const FLAG_EXIF = 0x08;
const FLAG_XMP = 0x04;

export function isWebp(bytes: Uint8Array): boolean {
  return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";
}

export function stripWebp(bytes: Uint8Array, options: FileOptions) {
  const findings: Finding[] = [];
  const kept: Uint8Array[] = [];
  let offset = 12;
  let removedExif = false;
  let removedXmp = false;
  let removedIcc = false;

  while (offset + 8 <= bytes.length) {
    const fourcc = ascii(bytes, offset, 4);
    const size = u32le(bytes, offset + 4);
    const padded = size + (size % 2); // RIFF chunks pad to even length
    const end = offset + 8 + padded;
    if (end > bytes.length) break;

    let drop = false;
    if (fourcc === "EXIF") {
      drop = true;
      removedExif = true;
      findings.push(
        finding("webp:exif", "EXIF block", `Camera, timestamp and possibly GPS data (${size} bytes).`, "high"),
      );
    } else if (fourcc === "XMP ") {
      drop = true;
      removedXmp = true;
      const xmp = new TextDecoder("utf-8").decode(bytes.subarray(offset + 8, offset + 8 + size));
      const isC2pa = xmp.includes("c2pa") || xmp.includes("contentauth");
      findings.push(
        finding(
          "webp:xmp",
          isC2pa ? "XMP with content credentials" : "XMP metadata packet",
          `Editing history, tool names and identifiers (${size} bytes).`,
          "high",
        ),
      );
    } else if (fourcc === "ICCP") {
      if (options.keepColorProfile) {
        findings.push({
          ...finding("webp:icc", "ICC colour profile", "Kept — removing it shifts colour.", "low"),
          removed: false,
        });
      } else {
        drop = true;
        removedIcc = true;
        findings.push(finding("webp:icc", "ICC colour profile", "Removed at your request.", "low"));
      }
    }

    if (!drop) kept.push(bytes.subarray(offset, end));
    offset = end;
  }

  // Rewrite the VP8X feature flags so they match what actually survived.
  if (kept.length > 0 && ascii(kept[0], 0, 4) === "VP8X") {
    const vp8x = new Uint8Array(kept[0]);
    if (removedExif) vp8x[8] &= ~FLAG_EXIF;
    if (removedXmp) vp8x[8] &= ~FLAG_XMP;
    if (removedIcc) vp8x[8] &= ~FLAG_ICC;
    kept[0] = vp8x;
  }

  const body = concat(kept);
  const out = new Uint8Array(12 + body.length);
  out.set(bytes.subarray(0, 12), 0);
  out.set(body, 12);
  writeU32le(out, 4, body.length + 4); // RIFF size covers "WEBP" plus the chunks

  return { bytes: out, findings: mergeFindings(findings), lossless: true };
}
