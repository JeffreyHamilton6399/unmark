// JPEG metadata lives in APPn marker segments ahead of the compressed scan.
// Dropping those segments and copying the scan through verbatim re-quantises
// nothing - the image is the same image, minus the attached records.

import type { Finding } from "../types";
import { type FileOptions, ascii, concat, finding, mergeFindings } from "./common";

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8;
}

/** Markers with no length field, copied straight through. */
const STANDALONE = new Set([0xd8, 0x01, ...Array.from({ length: 8 }, (_, i) => 0xd0 + i)]);

export function stripJpeg(bytes: Uint8Array, options: FileOptions) {
  const out: Uint8Array[] = [bytes.subarray(0, 2)]; // SOI
  const findings: Finding[] = [];
  let offset = 2;

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break; // desynchronised, bail and keep the rest
    const marker = bytes[offset + 1];

    if (marker === 0xd9) {
      out.push(bytes.subarray(offset)); // EOI and any trailer
      offset = bytes.length;
      break;
    }
    if (STANDALONE.has(marker)) {
      out.push(bytes.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }

    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    const segEnd = offset + 2 + length;
    if (length < 2 || segEnd > bytes.length) break;

    // Start of Scan: everything from here to the end is entropy-coded data
    // (plus any later scans in a progressive file). Copy it all, untouched.
    if (marker === 0xda) {
      out.push(bytes.subarray(offset));
      offset = bytes.length;
      break;
    }

    const payload = bytes.subarray(offset + 4, segEnd);
    const tag = ascii(payload, 0, Math.min(32, payload.length));
    let drop = false;

    if (marker === 0xfe) {
      drop = true;
      const text = new TextDecoder("latin1").decode(payload).replace(/\s+/g, " ").trim();
      findings.push(
        finding(
          "jpeg:com",
          "Embedded comment",
          text ? `Comment segment. Begins: ${text.slice(0, 120)}` : "An empty comment segment.",
          "medium",
        ),
      );
    } else if (marker === 0xe1) {
      if (tag.startsWith("Exif")) {
        drop = true;
        findings.push(
          finding(
            "jpeg:exif",
            "EXIF block",
            `Camera model, capture time and possibly GPS coordinates (${length} bytes).`,
            "high",
          ),
        );
      } else if (tag.includes("ns.adobe.com/xap")) {
        drop = true;
        const xmp = new TextDecoder("utf-8").decode(payload);
        const isC2pa = xmp.includes("c2pa") || xmp.includes("contentauth");
        findings.push(
          finding(
            "jpeg:xmp",
            isC2pa ? "XMP with content credentials" : "XMP metadata packet",
            `Adobe XMP: editing history, tool names and identifiers (${length} bytes).`,
            "high",
          ),
        );
      } else {
        drop = true;
        findings.push(
          finding("jpeg:app1", "APP1 segment", `An unrecognised APP1 record (${length} bytes).`, "medium"),
        );
      }
    } else if (marker === 0xe2) {
      if (tag.startsWith("ICC_PROFILE")) {
        if (options.keepColorProfile) {
          findings.push({
            ...finding(
              "jpeg:icc",
              "ICC colour profile",
              "Kept: removing it shifts colour. Profiles can name the originating device.",
              "low",
            ),
            removed: false,
          });
        } else {
          drop = true;
          findings.push(
            finding("jpeg:icc", "ICC colour profile", "Removed at your request.", "low"),
          );
        }
      } else {
        drop = true;
        findings.push(
          finding("jpeg:app2", "APP2 segment", `Multi-picture or vendor data (${length} bytes).`, "medium"),
        );
      }
    } else if (marker === 0xeb) {
      // APP11 carries JUMBF, which is how C2PA manifests ride along in JPEG.
      drop = true;
      const isC2pa = ascii(payload, 0, Math.min(payload.length, 256)).includes("c2pa");
      findings.push(
        finding(
          "jpeg:c2pa",
          isC2pa ? "C2PA content credentials" : "JUMBF box",
          `A signed provenance manifest recording how this image was made and edited (${length} bytes).`,
          "high",
        ),
      );
    } else if (marker === 0xed) {
      drop = true;
      findings.push(
        finding(
          "jpeg:iptc",
          "Photoshop / IPTC record",
          `Captions, credits, keywords and editing history (${length} bytes).`,
          "high",
        ),
      );
    } else if (marker === 0xee) {
      // APP14 "Adobe" declares the colour transform. Removing it turns some
      // CMYK and YCCK files inside out, so it stays.
      out.push(bytes.subarray(offset, segEnd));
      offset = segEnd;
      continue;
    } else if (marker >= 0xe0 && marker <= 0xef) {
      if (marker === 0xe0 && tag.startsWith("JFIF")) {
        // Structural, not metadata.
      } else {
        drop = true;
        findings.push(
          finding(
            `jpeg:app${marker - 0xe0}`,
            `APP${marker - 0xe0} segment`,
            `Vendor-specific metadata (${length} bytes).`,
            "medium",
          ),
        );
      }
    }

    if (!drop) out.push(bytes.subarray(offset, segEnd));
    offset = segEnd;
  }

  if (offset < bytes.length) out.push(bytes.subarray(offset));
  return { bytes: concat(out), findings: mergeFindings(findings), lossless: true };
}
