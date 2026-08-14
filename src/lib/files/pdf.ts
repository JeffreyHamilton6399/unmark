// PDFs carry metadata in two places that disagree with each other often enough
// to be worth clearing separately: the trailer's Info dictionary, and an XMP
// packet hanging off the document catalog. C2PA manifests attach to the latter.

import { PDFDocument, PDFDict, PDFHexString, PDFName, PDFString } from "pdf-lib";
import type { Finding } from "../types";
import { finding, mergeFindings } from "./common";

const INFO_LABELS: Record<string, string> = {
  Title: "Title",
  Author: "Author",
  Subject: "Subject",
  Keywords: "Keywords",
  Creator: "Creating application",
  Producer: "Producing application",
  CreationDate: "Creation date",
  ModDate: "Modification date",
  Company: "Company",
  SourceModified: "Source modification date",
  Trapped: "Trapped flag",
};

export function isPdf(bytes: Uint8Array): boolean {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

export async function stripPdf(bytes: Uint8Array) {
  const findings: Finding[] = [];

  // updateMetadata:false stops pdf-lib stamping its own Producer on the way out.
  const doc = await PDFDocument.load(bytes, {
    updateMetadata: false,
    ignoreEncryption: true,
  });

  // --- Info dictionary --------------------------------------------------
  const infoRef = doc.context.trailerInfo.Info;
  if (infoRef) {
    const info = doc.context.lookup(infoRef);
    if (info instanceof PDFDict) {
      for (const key of [...info.keys()]) {
        const name = key.asString().replace(/^\//, "");
        const value = info.get(key);
        let text = "";
        if (value instanceof PDFString || value instanceof PDFHexString) {
          text = value.decodeText();
        }
        if (text.trim() || INFO_LABELS[name]) {
          const identifying = /Author|Creator|Producer|Company/.test(name);
          findings.push(
            finding(
              `pdf:info:${name}`,
              INFO_LABELS[name] ?? `Info field "${name}"`,
              text.trim() ? `Info dictionary: ${text.slice(0, 100)}` : "Present in the Info dictionary.",
              identifying ? "high" : "medium",
            ),
          );
        }
        info.delete(key);
      }
    }
  }

  // --- XMP packet on the catalog ----------------------------------------
  const metadataRef = doc.catalog.get(PDFName.of("Metadata"));
  if (metadataRef) {
    let isC2pa = false;
    try {
      const stream = doc.context.lookup(metadataRef) as any;
      const raw: Uint8Array | undefined = stream?.contents;
      if (raw) {
        const xmp = new TextDecoder("utf-8").decode(raw);
        isC2pa = /c2pa|contentauth/i.test(xmp);
      }
    } catch {
      // An unreadable stream is still worth removing.
    }
    findings.push(
      finding(
        "pdf:xmp",
        isC2pa ? "C2PA content credentials" : "XMP metadata packet",
        isC2pa
          ? "A signed provenance manifest recording how this document was made."
          : "Editing history, tool names and document identifiers.",
        "high",
      ),
    );
    doc.catalog.delete(PDFName.of("Metadata"));
  }

  // --- Document id ------------------------------------------------------
  // The /ID pair follows a document across revisions and links copies together.
  if (doc.context.trailerInfo.ID) {
    findings.push(
      finding(
        "pdf:id",
        "Document identifier",
        "A persistent id that links separate copies of this file back to one original.",
        "medium",
      ),
    );
    delete (doc.context.trailerInfo as any).ID;
  }

  const out = await doc.save({ useObjectStreams: false });
  return { bytes: out, findings: mergeFindings(findings), lossless: false };
}
