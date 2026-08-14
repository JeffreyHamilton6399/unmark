// PNG is a stream of length-prefixed chunks. Rebuilding the stream without the
// metadata chunks leaves IDAT — the actual compressed pixels — completely
// untouched, so the output is byte-identical image data with the extras gone.

import type { Finding } from "../types";
import {
  type FileOptions,
  ascii,
  concat,
  describeTextKey,
  finding,
  mergeFindings,
  u32,
} from "./common";

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Chunks carrying provenance or personal data. Everything else is kept. */
const DROP = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "caBX", "tIME", "dSIG"]);

export function isPng(bytes: Uint8Array): boolean {
  return SIGNATURE.every((b, i) => bytes[i] === b);
}

/** Decompresses a zTXt/iTXt payload far enough to name it. Best effort only. */
function readTextChunkKey(type: string, data: Uint8Array): { key: string; value: string } {
  let nul = data.indexOf(0);
  if (nul < 0) nul = data.length;
  const key = ascii(data, 0, nul);
  let value = "";
  if (type === "tEXt") {
    value = new TextDecoder("latin1").decode(data.subarray(nul + 1));
  } else if (type === "iTXt") {
    // keyword \0 compressionFlag compressionMethod languageTag \0 translatedKey \0 text
    const flag = data[nul + 1];
    if (flag === 0) {
      let p = nul + 3;
      let seen = 0;
      while (p < data.length && seen < 2) {
        if (data[p] === 0) seen++;
        p++;
      }
      value = new TextDecoder("utf-8").decode(data.subarray(p));
    }
  }
  return { key, value };
}

export function stripPng(bytes: Uint8Array, options: FileOptions) {
  const out: Uint8Array[] = [bytes.subarray(0, 8)];
  const findings: Finding[] = [];
  let offset = 8;

  while (offset + 8 <= bytes.length) {
    const length = u32(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    const total = 12 + length;
    if (offset + total > bytes.length) break; // truncated file — stop cleanly

    const chunk = bytes.subarray(offset, offset + total);
    const data = bytes.subarray(offset + 8, offset + 8 + length);

    let drop = DROP.has(type);
    if (type === "iCCP") drop = !options.keepColorProfile;

    if (drop) {
      if (type === "tEXt" || type === "zTXt" || type === "iTXt") {
        const { key, value } = readTextChunkKey(type, data);
        findings.push(
          finding(
            `png:text:${key}`,
            describeTextKey(key),
            value
              ? `Stored in a ${type} chunk. Begins: ${value.slice(0, 120).replace(/\s+/g, " ")}`
              : `Stored in a ${type} chunk (${length} bytes).`,
            key === "parameters" || key === "prompt" || key === "workflow" ? "high" : "medium",
          ),
        );
      } else if (type === "caBX") {
        findings.push(
          finding(
            "png:c2pa",
            "C2PA content credentials",
            `A signed provenance manifest (${length} bytes) recording how this image was made and edited.`,
            "high",
          ),
        );
      } else if (type === "eXIf") {
        findings.push(
          finding(
            "png:exif",
            "EXIF block",
            `Camera, timestamp and possibly GPS data (${length} bytes).`,
            "high",
          ),
        );
      } else if (type === "tIME") {
        findings.push(
          finding("png:time", "Modification timestamp", "Last-modified time of the image.", "low"),
        );
      } else if (type === "dSIG") {
        findings.push(
          finding("png:dsig", "Digital signature", "An embedded PNG signature chunk.", "medium"),
        );
      } else if (type === "iCCP") {
        findings.push(
          finding(
            "png:iccp",
            "ICC colour profile",
            "Removed at your request. Colour may render slightly differently.",
            "low",
          ),
        );
      }
    } else if (type === "iCCP") {
      // Kept, but worth telling the user it's there and that it is identifying.
      findings.push({
        ...finding(
          "png:iccp",
          "ICC colour profile",
          "Kept — removing it shifts colour. Profiles can name the originating device.",
          "low",
        ),
        removed: false,
      });
      out.push(chunk);
    } else {
      out.push(chunk);
    }

    offset += total;
    if (type === "IEND") break;
  }

  return { bytes: concat(out), findings: mergeFindings(findings), lossless: true };
}
