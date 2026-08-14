// Office documents are zip archives with the metadata in known member files.
// Rewriting those members leaves the document body untouched, so formatting,
// images and revision content all survive.

import JSZip from "jszip";
import type { Finding } from "../types";
import { finding, mergeFindings } from "./common";
import { processText, type TextOptions } from "../unicode";

/** A fixed timestamp, so zip entry dates stop leaking when you edited the file. */
const FIXED_DATE = new Date(Date.UTC(1980, 0, 1, 0, 0, 0));

const EMPTY_CORE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"></cp:coreProperties>`;

const EMPTY_APP = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"></Properties>`;

const EMPTY_ODF_META = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.3"><office:meta/></office:document-meta>`;

/** Human names for the property tags worth calling out in a report. */
const PROPERTY_LABELS: Record<string, string> = {
  "dc:creator": "Author",
  "cp:lastModifiedBy": "Last modified by",
  "dc:title": "Title",
  "dc:subject": "Subject",
  "dc:description": "Description",
  "cp:keywords": "Keywords",
  "cp:category": "Category",
  "cp:revision": "Revision number",
  "dcterms:created": "Creation date",
  "dcterms:modified": "Modification date",
  Application: "Authoring application",
  AppVersion: "Application version",
  Company: "Company",
  Manager: "Manager",
  Template: "Template name",
  TotalTime: "Total editing time",
  "meta:generator": "Generator",
  "meta:creation-date": "Creation date",
  "meta:editing-cycles": "Number of times saved",
  "meta:editing-duration": "Total editing time",
  "meta:initial-creator": "Original author",
};

function readProperties(xml: string, source: string): Finding[] {
  const found: Finding[] = [];
  for (const [tag, label] of Object.entries(PROPERTY_LABELS)) {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    const value = match?.[1]?.trim();
    if (!value) continue;
    const identifying = /creator|lastModifiedBy|Company|Manager|initial-creator/i.test(tag);
    found.push(
      finding(
        `doc:${tag}`,
        label,
        `${source}: ${value.slice(0, 100)}`,
        identifying ? "high" : "medium",
      ),
    );
  }
  return found;
}

export function isZipDocument(name: string, bytes: Uint8Array): boolean {
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  return isZip && /\.(docx|xlsx|pptx|docm|xlsm|pptm|odt|ods|odp|odg)$/i.test(name);
}

export async function stripZipDocument(
  bytes: Uint8Array,
  name: string,
  textOptions: TextOptions | null,
) {
  const zip = await JSZip.loadAsync(bytes);
  const findings: Finding[] = [];
  const isOdf = /\.(odt|ods|odp|odg)$/i.test(name);

  if (isOdf) {
    const meta = zip.file("meta.xml");
    if (meta) {
      findings.push(...readProperties(await meta.async("string"), "meta.xml"));
      zip.file("meta.xml", EMPTY_ODF_META);
    }
    // ODF keeps a rendered preview of the first page, which can reveal content
    // even after the text is redacted.
    if (zip.file(/^Thumbnails\//).length > 0) {
      findings.push(
        finding(
          "doc:thumbnail",
          "Embedded thumbnail",
          "A rendered preview of the first page, stored separately from the content.",
          "medium",
        ),
      );
      zip.remove("Thumbnails");
    }
  } else {
    for (const [path, label] of [
      ["docProps/core.xml", EMPTY_CORE],
      ["docProps/app.xml", EMPTY_APP],
    ] as const) {
      const entry = zip.file(path);
      if (!entry) continue;
      findings.push(...readProperties(await entry.async("string"), path.split("/")[1]));
      zip.file(path, label);
    }
    if (zip.file("docProps/custom.xml")) {
      findings.push(
        finding(
          "doc:custom",
          "Custom document properties",
          "Application-defined fields, often added by document management systems.",
          "medium",
        ),
      );
      zip.remove("docProps/custom.xml");
    }
    if (zip.file("docProps/thumbnail.jpeg") || zip.file("docProps/thumbnail.emf")) {
      findings.push(
        finding("doc:thumbnail", "Embedded thumbnail", "A rendered preview of the first page.", "medium"),
      );
      zip.remove("docProps/thumbnail.jpeg");
      zip.remove("docProps/thumbnail.emf");
    }
  }

  // Optional pass over the document body text.
  if (textOptions) {
    const bodyPaths = isOdf ? ["content.xml"] : ["word/document.xml"];
    for (const path of bodyPaths) {
      const entry = zip.file(path);
      if (!entry) continue;
      const original = await entry.async("string");
      const result = processText(original, textOptions);
      if (result.totalMarks > 0) {
        findings.push(...result.findings);
        zip.file(path, result.text);
      }
    }
  }

  // Normalise every entry date so the archive stops recording your timeline.
  zip.forEach((_, entry) => {
    if (!entry.dir) entry.date = FIXED_DATE;
  });

  const outBlob = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return { bytes: outBlob, findings: mergeFindings(findings), lossless: false };
}
