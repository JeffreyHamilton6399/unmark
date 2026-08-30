import { describe, expect, test } from "bun:test";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { stripPng, isPng } from "./png";
import { stripJpeg, isJpeg } from "./jpeg";
import { stripWebp, isWebp } from "./webp";
import { stripSvg } from "./svg";
import { stripPdf } from "./pdf";
import { stripZipDocument } from "./documents";
import { cleanFile } from "./index";
import { DEFAULT_FILE_OPTIONS } from "./common";
import { DEFAULT_TEXT_OPTIONS } from "../unicode";

const OPTS = DEFAULT_FILE_OPTIONS;

// --- builders ---------------------------------------------------------------

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  new DataView(out.buffer).setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  return out; // CRC left zero, the stripper copies chunks, it doesn't verify them
}

function buildPng(extra: Uint8Array[]): Uint8Array {
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", new Uint8Array(13)),
    ...extra,
    pngChunk("IDAT", new Uint8Array([1, 2, 3, 4])),
    pngChunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function textChunk(key: string, value: string): Uint8Array {
  const bytes = new TextEncoder().encode(key + "\0" + value);
  return pngChunk("tEXt", bytes);
}

function jpegSegment(marker: number, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + payload.length);
  out[0] = 0xff;
  out[1] = marker;
  out[2] = ((payload.length + 2) >> 8) & 0xff;
  out[3] = (payload.length + 2) & 0xff;
  out.set(payload, 4);
  return out;
}

const enc = (s: string) => new TextEncoder().encode(s);

// --- PNG --------------------------------------------------------------------

describe("png", () => {
  test("removes text chunks and keeps pixel data", () => {
    const png = buildPng([
      textChunk("parameters", "a photo of a cat, steps: 30, seed: 12345"),
      textChunk("Software", "Adobe Photoshop"),
      pngChunk("caBX", enc("c2pa manifest goes here")),
    ]);
    expect(isPng(png)).toBe(true);

    const result = stripPng(png, OPTS);
    const out = result.bytes;

    // IHDR, IDAT and IEND survive; the three metadata chunks do not.
    expect(out.length).toBeLessThan(png.length);
    const asText = new TextDecoder("latin1").decode(out);
    expect(asText).not.toContain("parameters");
    expect(asText).not.toContain("Photoshop");
    expect(asText).not.toContain("c2pa");
    expect(asText).toContain("IDAT");
    expect(asText).toContain("IEND");

    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain("png:text:parameters");
    expect(ids).toContain("png:c2pa");
    // The generation parameters are surfaced as high severity.
    const params = result.findings.find((f) => f.id === "png:text:parameters");
    expect(params?.severity).toBe("high");
    expect(params?.label).toContain("Automatic1111");
  });

  test("keeps the colour profile unless asked otherwise", () => {
    const png = buildPng([pngChunk("iCCP", enc("sRGB\0\0compressed"))]);
    const kept = stripPng(png, { ...OPTS, keepColorProfile: true });
    expect(new TextDecoder("latin1").decode(kept.bytes)).toContain("iCCP");
    expect(kept.findings.find((f) => f.id === "png:iccp")?.removed).toBe(false);

    const dropped = stripPng(png, { ...OPTS, keepColorProfile: false });
    expect(new TextDecoder("latin1").decode(dropped.bytes)).not.toContain("iCCP");
    expect(dropped.findings.find((f) => f.id === "png:iccp")?.removed).toBe(true);
  });

  test("leaves an already-clean png byte-identical", () => {
    const png = buildPng([]);
    const result = stripPng(png, OPTS);
    expect(Array.from(result.bytes)).toEqual(Array.from(png));
    expect(result.findings).toHaveLength(0);
  });

  test("keeps APNG animation chunks", () => {
    const png = buildPng([pngChunk("acTL", new Uint8Array(8)), textChunk("Software", "x")]);
    const out = new TextDecoder("latin1").decode(stripPng(png, OPTS).bytes);
    expect(out).toContain("acTL");
  });
});

// --- JPEG -------------------------------------------------------------------

describe("jpeg", () => {
  function buildJpeg(segments: Uint8Array[]): Uint8Array {
    const scan = new Uint8Array([0xff, 0xda, 0x00, 0x08, 1, 2, 3, 4, 5, 6, 0xff, 0xd9]);
    const parts = [new Uint8Array([0xff, 0xd8]), ...segments, scan];
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  }

  test("removes EXIF, XMP, IPTC and C2PA but keeps JFIF and the scan", () => {
    const jpeg = buildJpeg([
      jpegSegment(0xe0, enc("JFIF\0")),
      jpegSegment(0xe1, enc("Exif\0\0secret gps data")),
      jpegSegment(0xe1, enc("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>c2pa</x:xmpmeta>")),
      jpegSegment(0xed, enc("Photoshop 3.0\0iptc caption")),
      jpegSegment(0xeb, enc("JP  c2pa manifest")),
      jpegSegment(0xfe, enc("a leftover comment")),
    ]);
    expect(isJpeg(jpeg)).toBe(true);

    const result = stripJpeg(jpeg, OPTS);
    const out = new TextDecoder("latin1").decode(result.bytes);

    expect(out).toContain("JFIF");
    expect(out).not.toContain("secret gps data");
    expect(out).not.toContain("xmpmeta");
    expect(out).not.toContain("iptc caption");
    expect(out).not.toContain("c2pa manifest");
    expect(out).not.toContain("leftover comment");

    const ids = result.findings.map((f) => f.id);
    expect(ids).toEqual(
      expect.arrayContaining(["jpeg:exif", "jpeg:xmp", "jpeg:iptc", "jpeg:c2pa", "jpeg:com"]),
    );
    // Scan data survives byte-for-byte.
    expect(Array.from(result.bytes.slice(-12))).toEqual([
      0xff, 0xda, 0x00, 0x08, 1, 2, 3, 4, 5, 6, 0xff, 0xd9,
    ]);
  });

  test("keeps the APP14 Adobe colour-transform marker", () => {
    const jpeg = buildJpeg([jpegSegment(0xee, enc("Adobe\0\0\0\0\0"))]);
    const out = new TextDecoder("latin1").decode(stripJpeg(jpeg, OPTS).bytes);
    expect(out).toContain("Adobe");
  });

  test("honours the colour profile setting", () => {
    const jpeg = buildJpeg([jpegSegment(0xe2, enc("ICC_PROFILE\0profile bytes"))]);
    expect(new TextDecoder("latin1").decode(stripJpeg(jpeg, OPTS).bytes)).toContain("ICC_PROFILE");
    const dropped = stripJpeg(jpeg, { ...OPTS, keepColorProfile: false });
    expect(new TextDecoder("latin1").decode(dropped.bytes)).not.toContain("ICC_PROFILE");
  });
});

// --- WebP -------------------------------------------------------------------

describe("webp", () => {
  function riffChunk(fourcc: string, payload: Uint8Array): Uint8Array {
    const padded = payload.length + (payload.length % 2);
    const out = new Uint8Array(8 + padded);
    for (let i = 0; i < 4; i++) out[i] = fourcc.charCodeAt(i);
    new DataView(out.buffer).setUint32(4, payload.length, true);
    out.set(payload, 8);
    return out;
  }

  test("removes EXIF/XMP chunks and clears the VP8X flag bits", () => {
    const vp8x = new Uint8Array(10);
    vp8x[0] = 0x08 | 0x04 | 0x20; // EXIF + XMP + ICC advertised
    const parts = [
      riffChunk("VP8X", vp8x),
      riffChunk("VP8 ", new Uint8Array([9, 9, 9, 9])),
      riffChunk("EXIF", enc("gps data")),
      riffChunk("XMP ", enc("<x:xmpmeta>contentauth</x:xmpmeta>")),
    ];
    const body = parts.reduce<number[]>((acc, p) => acc.concat(Array.from(p)), []);
    const webp = new Uint8Array(12 + body.length);
    webp.set(enc("RIFF"), 0);
    new DataView(webp.buffer).setUint32(4, body.length + 4, true);
    webp.set(enc("WEBP"), 8);
    webp.set(body, 12);

    expect(isWebp(webp)).toBe(true);
    const result = stripWebp(webp, OPTS);
    const out = new TextDecoder("latin1").decode(result.bytes);

    expect(out).not.toContain("gps data");
    expect(out).not.toContain("xmpmeta");
    expect(out).toContain("VP8X");

    // Flags byte sits at 12 (header) + 8 (chunk header) = 20.
    const flags = result.bytes[20];
    expect(flags & 0x08).toBe(0); // EXIF bit cleared
    expect(flags & 0x04).toBe(0); // XMP bit cleared
    expect(flags & 0x20).toBe(0x20); // ICC bit untouched

    // RIFF size field agrees with the new length.
    const declared = new DataView(result.bytes.buffer, result.bytes.byteOffset).getUint32(4, true);
    expect(declared).toBe(result.bytes.length - 8);
  });
});

// --- SVG --------------------------------------------------------------------

describe("svg", () => {
  test("removes metadata, generator comments and editor attributes", () => {
    const svg = `<?xml version="1.0"?>
<!-- Generator: Adobe Illustrator 27.0, SVG Export Plug-In -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="10" height="10">
  <metadata><rdf:RDF>c2pa claim</rdf:RDF></metadata>
  <g inkscape:label="Layer 1" inkscape:groupmode="layer"><rect width="5" height="5"/></g>
</svg>`;
    const result = stripSvg(svg, DEFAULT_TEXT_OPTIONS);

    expect(result.text).not.toContain("Illustrator");
    expect(result.text).not.toContain("c2pa");
    expect(result.text).not.toContain("inkscape:label");
    expect(result.text).not.toContain("xmlns:inkscape");
    // The drawing itself survives.
    expect(result.text).toContain("<rect width=\"5\" height=\"5\"/>");

    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain("svg:metadata");
    expect(ids).toContain("svg:comments");
    expect(ids).toContain("svg:editor-attrs");
    expect(result.findings.find((f) => f.id === "svg:metadata")?.label).toContain("C2PA");
  });
});

// --- PDF --------------------------------------------------------------------

describe("pdf", () => {
  test("clears the Info dictionary and reports what was there", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    doc.setTitle("Quarterly numbers");
    doc.setAuthor("Jane Doe");
    doc.setProducer("SomeApp 4.2");
    doc.setCreator("SomeApp");
    const original = await doc.save();

    const result = await stripPdf(original);
    const reloaded = await PDFDocument.load(result.bytes, { updateMetadata: false });

    expect(reloaded.getTitle()).toBeUndefined();
    expect(reloaded.getAuthor()).toBeUndefined();
    expect(reloaded.getProducer()).toBeUndefined();
    expect(reloaded.getPageCount()).toBe(1); // content survived

    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain("pdf:info:Author");
    expect(ids).toContain("pdf:info:Producer");
    expect(result.findings.find((f) => f.id === "pdf:info:Author")?.severity).toBe("high");
  });
});

// --- Office documents -------------------------------------------------------

describe("office documents", () => {
  test("clears docProps and keeps the document body", async () => {
    const zip = new JSZip();
    zip.file(
      "docProps/core.xml",
      `<?xml version="1.0"?><cp:coreProperties xmlns:cp="x" xmlns:dc="y"><dc:creator>Jane Doe</dc:creator><cp:lastModifiedBy>Bob</cp:lastModifiedBy><cp:revision>7</cp:revision></cp:coreProperties>`,
    );
    zip.file(
      "docProps/app.xml",
      `<?xml version="1.0"?><Properties><Application>Microsoft Word</Application><Company>Acme Ltd</Company></Properties>`,
    );
    zip.file("word/document.xml", "<w:document><w:t>Hello​world</w:t></w:document>");
    const bytes = await zip.generateAsync({ type: "uint8array" });

    const result = await stripZipDocument(bytes, "report.docx", DEFAULT_TEXT_OPTIONS);
    const out = await JSZip.loadAsync(result.bytes);

    const core = await out.file("docProps/core.xml")!.async("string");
    expect(core).not.toContain("Jane Doe");
    expect(core).not.toContain("Bob");

    const body = await out.file("word/document.xml")!.async("string");
    expect(body).toContain("Hello");
    expect(body).not.toContain("​"); // zero-width stripped from the body too

    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain("doc:dc:creator");
    expect(ids).toContain("doc:Company");
    expect(result.findings.find((f) => f.id === "doc:dc:creator")?.detail).toContain("Jane Doe");
  });
});

// --- dispatch ---------------------------------------------------------------

describe("cleanFile dispatch", () => {
  test("routes by magic number, not extension", async () => {
    const png = buildPng([textChunk("Software", "Photoshop")]);
    // Deliberately mislabelled.
    const file = new File([png as unknown as BlobPart], "actually-a-png.txt");
    const result = await cleanFile(file);
    expect(result.error).toBeUndefined();
    expect(result.findings.map((f) => f.id)).toContain("png:text:Software");
    expect(result.lossless).toBe(true);
  });

  test("cleans markdown through the text layer", async () => {
    const file = new File([enc("# Title\n\nSome​text.") as unknown as BlobPart], "notes.md");
    const result = await cleanFile(file);
    expect(await result.blob.text()).toBe("# Title\n\nSometext.");
    expect(result.findings.map((f) => f.id)).toContain("zero-width");
  });

  test("strips the generator tag from html", async () => {
    const html = `<html><head><meta name="generator" content="SomeBuilder 2.0"></head><body>hi</body></html>`;
    const file = new File([enc(html) as unknown as BlobPart], "page.html");
    const result = await cleanFile(file);
    const text = await result.blob.text();
    expect(text).not.toContain("SomeBuilder");
    expect(text).toContain("<body>hi</body>");
  });

  test("reports unsupported formats instead of silently passing them through", async () => {
    const file = new File([new Uint8Array([1, 2, 3]) as unknown as BlobPart], "clip.mp4");
    const result = await cleanFile(file);
    expect(result.error).toContain("Unsupported");
    expect(result.changed).toBe(false);
  });
});
