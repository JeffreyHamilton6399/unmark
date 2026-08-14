# Unmark

**Find and remove hidden marks in text and files — 100% in your browser. No uploads. No sign-up. Free.**

Text you paste and files you drop can carry things you can't see: invisible Unicode characters that survive copy and paste, bidirectional controls that make text render differently from how it's stored, and metadata blocks recording who made a file, with what, and when. Unmark shows you all of it, then takes it out.

## The privacy promise

- **No uploads.** Every byte is parsed locally. There are zero network requests for your content.
- **No tracking or analytics.** Zero third-party scripts.
- **No sign-up.** No accounts, no cookies.
- **localStorage only** for your theme preference and terms acceptance.
- **Nothing is retained.** Everything lives in the current tab. Close or refresh and it's gone.

## What it finds

### In text

| Category | What it is |
| --- | --- |
| **Tag characters** | An invisible copy of ASCII at U+E0000. Carries an arbitrary hidden message that renders as nothing. |
| **Variation selectors** | Invisible modifiers. The supplement block smuggles one byte per character. |
| **Zero-width characters** | ZWSP, ZWNJ, ZWJ, word joiner, BOM. A common carrier for per-recipient fingerprints. |
| **Bidirectional controls** | Reorder how text renders without changing its bytes — the basis of Trojan Source attacks. |
| **Non-standard spaces** | NBSP, en/em/thin/hair spaces, ideographic space. Normalised to a plain space rather than deleted. |
| **Soft hyphens** | Invisible unless a line happens to break there. |
| **Look-alike letters** | Cyrillic or Greek letters posing as ASCII, plus mathematical and fullwidth Latin. |
| **Stray controls** | C0/C1 control characters other than tab, newline and carriage return. |

Runs of tag characters and variation selectors are **decoded**, not just deleted — if someone hid a message in your text, Unmark shows you what it said.

### In files

| Format | Handling |
| --- | --- |
| **PNG** | Drops `tEXt`/`zTXt`/`iTXt`, `eXIf`, `caBX` (C2PA), `tIME`, `dSIG`. Names the generator when it recognises one — Automatic1111, ComfyUI, InvokeAI and NovelAI all leave the full prompt behind. |
| **JPEG** | Drops EXIF, XMP, IPTC/Photoshop, APP11 JUMBF (C2PA) and comments. Keeps JFIF and the APP14 Adobe colour transform. |
| **WebP** | Drops `EXIF`/`XMP ` chunks and rewrites the VP8X feature flags to match. |
| **SVG** | Removes `<metadata>` (RDF, Dublin Core, C2PA), generator comments and editor-private namespaces. |
| **PDF** | Clears the Info dictionary, the XMP packet and the trailer `/ID` that links copies back to one original. |
| **DOCX / XLSX / PPTX** | Clears `docProps/core.xml` and `app.xml`, removes custom properties and the embedded thumbnail. |
| **ODT / ODS / ODP** | Clears `meta.xml` and removes the rendered page preview. |
| **TXT / MD / HTML / CSV / JSON / SRT / VTT** | Runs the text layer. HTML also loses its generator meta tag and comments. |

PNG, JPEG and WebP are edited **at the container level** — the compressed image data is copied through byte-for-byte, so nothing is re-encoded and no quality is lost. PDFs and Office documents are rebuilt, so their bytes change even though the content doesn't; the UI says so when that happens.

## What it deliberately doesn't do

Being clear about the boundary matters more than sounding thorough:

- **It does not defeat statistical text watermarks.** Schemes like SynthID-Text bias which tokens a model picks, so the signal is spread across word choices rather than stored in any one character. Removing it means rewriting the prose heavily, which flattens tone and voice. Unmark doesn't rewrite your text, so it doesn't touch these.
- **It does not touch pixel-domain watermarks.** SynthID for images, StegaStamp and Tree-Ring live in the pixels themselves, not the metadata. Stripping a `caBX` chunk removes the *signed manifest*, not a watermark encoded in the image content.
- **It cannot certify that any detector will fail.** It reports exactly what it found and exactly what it removed. What a third party can still infer is outside what this tool can measure.
- **Smart typography is not a watermark.** Curly quotes and em dashes correlate with machine-written prose but carry no signal. That toggle exists, it's off by default, and it's labelled cosmetic.

## Correctness guards

Aggressive removal breaks real text, so three cases are protected:

1. **Emoji sequences.** `👨‍👩‍👧` is three pictographs joined by U+200D. That ZWJ stays.
2. **Arabic and Indic orthography.** ZWNJ and ZWJ next to those scripts are required spelling, not fingerprints — Persian `می‌خواهم` comes through intact.
3. **Genuine non-Latin prose.** A Cyrillic `а` is only treated as a homoglyph when the word around it already contains ASCII letters. `pаypal` is corrected; `привет мир` is left completely alone.

These are covered by tests, along with every format above.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router) + TypeScript
- Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com/) (New York)
- Hand-written PNG / JPEG / WebP container parsers — no image library, no re-encoding
- [`pdf-lib`](https://pdf-lib.js.org/) for PDF, [`jszip`](https://stuk.github.io/jszip/) for Office documents and batch downloads
- `next-themes` for dark mode, `lucide-react` for icons

## Run locally

```bash
bun install
bun run dev
```

Then open http://localhost:3000.

```bash
bun test          # 35 tests across the text and file layers
bunx tsc --noEmit # type check
```

## Deploy to Vercel

Push to GitHub and import the repo at [vercel.com/new](https://vercel.com/new). No environment variables are needed.

## Responsible use

Unmark is for content you own or are authorised to process — stripping location data before you post a photo, clearing a client's name out of a document you're sending on, checking whether text someone sent you carries a hidden identifier. Removing provenance from someone else's work, or stripping records you're required to keep, is on you.
