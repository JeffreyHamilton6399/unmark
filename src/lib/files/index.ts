// Format detection and dispatch. Sniffing is done on the bytes rather than the
// extension wherever a magic number exists, because a mislabelled file is
// exactly the case where silently doing nothing would be worst.

import type { Finding } from "../types";
import { DEFAULT_FILE_OPTIONS, type FileOptions, type FileResult } from "./common";
import { isPng, stripPng } from "./png";
import { isJpeg, stripJpeg } from "./jpeg";
import { isWebp, stripWebp } from "./webp";
import { stripSvg } from "./svg";
import { isZipDocument, stripZipDocument } from "./documents";
import { isPdf, stripPdf } from "./pdf";
import { DEFAULT_TEXT_OPTIONS, processText, type TextOptions } from "../unicode";

export type { FileResult, FileOptions };
export { DEFAULT_FILE_OPTIONS };

export const SUPPORTED_EXTENSIONS = [
  "png", "jpg", "jpeg", "webp", "svg",
  "pdf", "docx", "xlsx", "pptx", "docm", "xlsm", "pptm",
  "odt", "ods", "odp", "odg",
  "txt", "md", "markdown", "html", "htm", "csv", "json", "srt", "vtt",
];

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "html", "htm", "csv", "json", "srt", "vtt", "xml",
]);

export function isSupportedFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return SUPPORTED_EXTENSIONS.includes(ext);
}

function extensionOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

/** HTML carries its own generator tags alongside whatever the text layer finds. */
function stripHtmlMeta(html: string): { text: string; findings: Finding[] } {
  const findings: Finding[] = [];
  let out = html;

  const generator = out.match(/<meta[^>]+name=["']generator["'][^>]*>/gi);
  if (generator) {
    findings.push({
      id: "html:generator",
      label: "Generator meta tag",
      detail: `Names the tool that produced the page: ${generator[0].slice(0, 120)}`,
      count: generator.length,
      severity: "medium",
      removed: true,
    });
    out = out.replace(/<meta[^>]+name=["']generator["'][^>]*>\s*/gi, "");
  }

  const comments = out.match(/<!--[\s\S]*?-->/g);
  if (comments) {
    findings.push({
      id: "html:comments",
      label: "HTML comments",
      detail: "Comments in the markup, which often retain drafting notes or tool output.",
      count: comments.length,
      severity: "low",
      removed: true,
    });
    out = out.replace(/<!--[\s\S]*?-->/g, "");
  }

  return { text: out, findings };
}

export async function cleanFile(
  file: File,
  fileOptions: FileOptions = DEFAULT_FILE_OPTIONS,
  textOptions: TextOptions = DEFAULT_TEXT_OPTIONS,
): Promise<FileResult> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const ext = extensionOf(file.name);
  const bytesBefore = buffer.length;
  const activeText = fileOptions.cleanText ? textOptions : null;

  const wrap = (
    outBytes: Uint8Array,
    findings: Finding[],
    lossless: boolean,
    mime: string,
  ): FileResult => ({
    blob: new Blob([outBytes as unknown as BlobPart], { type: mime }),
    name: file.name,
    findings,
    bytesBefore,
    bytesAfter: outBytes.length,
    changed: outBytes.length !== bytesBefore || findings.some((f) => f.removed),
    lossless,
  });

  try {
    if (isPng(buffer)) {
      const r = stripPng(buffer, fileOptions);
      return wrap(r.bytes, r.findings, r.lossless, "image/png");
    }
    if (isJpeg(buffer)) {
      const r = stripJpeg(buffer, fileOptions);
      return wrap(r.bytes, r.findings, r.lossless, "image/jpeg");
    }
    if (isWebp(buffer)) {
      const r = stripWebp(buffer, fileOptions);
      return wrap(r.bytes, r.findings, r.lossless, "image/webp");
    }
    if (isPdf(buffer)) {
      const r = await stripPdf(buffer);
      return wrap(r.bytes, r.findings, r.lossless, "application/pdf");
    }
    if (isZipDocument(file.name, buffer)) {
      const r = await stripZipDocument(buffer, file.name, activeText);
      return wrap(r.bytes, r.findings, r.lossless, file.type || "application/octet-stream");
    }
    if (ext === "svg") {
      const source = new TextDecoder("utf-8").decode(buffer);
      const r = stripSvg(source, activeText);
      return wrap(new TextEncoder().encode(r.text), r.findings, r.lossless, "image/svg+xml");
    }
    if (TEXT_EXTENSIONS.has(ext)) {
      let source = new TextDecoder("utf-8").decode(buffer);
      const findings: Finding[] = [];
      if (ext === "html" || ext === "htm") {
        const meta = stripHtmlMeta(source);
        source = meta.text;
        findings.push(...meta.findings);
      }
      const result = processText(source, textOptions);
      findings.push(...result.findings);
      return wrap(
        new TextEncoder().encode(result.text),
        findings,
        true,
        file.type || "text/plain",
      );
    }
  } catch (error) {
    return {
      blob: new Blob([buffer as unknown as BlobPart], { type: file.type }),
      name: file.name,
      findings: [],
      bytesBefore,
      bytesAfter: bytesBefore,
      changed: false,
      lossless: true,
      error: error instanceof Error ? error.message : "Could not read this file.",
    };
  }

  return {
    blob: new Blob([buffer as unknown as BlobPart], { type: file.type }),
    name: file.name,
    findings: [],
    bytesBefore,
    bytesAfter: bytesBefore,
    changed: false,
    lossless: true,
    error: `Unsupported format (.${ext || "unknown"}).`,
  };
}
