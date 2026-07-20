---
name: PDF Reader Architecture
description: How PDF visual reading is implemented — rendering, storage, data model, and reader branching.
---

## Approach
Server renders PDF pages to JPEG images using `pdftoppm` (poppler binary, already on PATH at `/nix/store/.../bin/pdftoppm`). Images are stored in App Storage (object storage). The Expo app loads them as plain image URLs — no native PDF modules required, works in Expo Go and web.

## Server (artifacts/api-server)
- `src/routes/pdf.ts` — POST `/api/render-pdf`: accepts multipart PDF, renders pages via `pdftoppm -jpeg -jpegopt quality=75 -r 150`, extracts per-page text via `pdftotext`, uploads each image buffer via `ObjectStorageService.uploadBuffer()`, returns `{ bookId, suggestedTitle, pageCount, pages: [{ pageNumber, imageUrl, width, height, text }] }`.
- `src/routes/storage.ts` — GET `/api/storage/objects/*splat`: serves stored page images by calling `getObjectEntityFile` + `downloadObject`.
- `src/lib/objectStorage.ts` — `uploadBuffer(entityPath, buffer, contentType)` stores at `${PRIVATE_OBJECT_DIR}/${entityPath}` and returns `/objects/${entityPath}`.
- `pdfinfo` used to get page count before rendering.
- `MAX_PAGES = 150` cap (bumped from 80).

**Why pdftoppm:** Already on PATH (poppler-utils from Nix), no npm deps, fast, high-fidelity.

## Data Model (artifacts/readwell/types/index.ts)
- `Book.sourceType?: 'text' | 'pdf'` — controls which reader to use.
- `Book.pages?: PdfPage[]` — only for PDF books. `PdfPage = { pageNumber, imageUrl, width, height, text }`.
- `Segment.pageStart?: number`, `Segment.pageEnd?: number` — inclusive 1-based page range for PDF sections.
- For PDFs, `segment.paragraphs` holds combined page text for quiz generation.

## Client (artifacts/readwell)
- `utils/api.ts` — `renderPdf(file)` calls `/api/render-pdf`. `resolveStorageUrl(objectPath)` prepends `${BASE_URL}/api/storage` to `/objects/...` paths.
- `utils/content.ts` — `buildPdfSegments(pages, pagesPerSegment=3)` groups pages into sections, combining their text into `paragraphs`.
- `app/import.tsx` — when PDF: calls `renderPdf`, stores result in `pdfData` state, hides content textarea + "or paste text" divider, shows PDF summary card instead. Drop zone shows `statusMsg` as extracting label.
- `components/PdfReader.tsx` — page-image reader with ZoomOverlay (pinch/pan/double-tap), section tag, "I've finished reading" → quiz flow. `visiblePage` resets on `segmentIndex` change via useEffect.
- `app/reader/[bookId].tsx` — branches: `book.sourceType === 'pdf' && book.pages` → `<PdfReader>`, else existing text reader.

## Storage URL Flow
1. `uploadBuffer('pdf-pages/{bookId}/{padded}.jpg', buffer)` → stored at `${PRIVATE_OBJECT_DIR}/pdf-pages/{bookId}/{padded}.jpg` → returns `/objects/pdf-pages/{bookId}/{padded}.jpg`
2. `resolveStorageUrl('/objects/pdf-pages/{bookId}/{padded}.jpg')` → `https://<domain>/api/storage/objects/pdf-pages/{bookId}/{padded}.jpg`
3. GET `/api/storage/objects/pdf-pages/{bookId}/{padded}.jpg` → Express `*splat` param → `getObjectEntityFile('/objects/pdf-pages/{bookId}/{padded}.jpg')` → streams from GCS.

## UX Details
- BookCard shows "PDF · N pages" badge in the book's cover color for PDF books.
- Home screen "continue reading" shows "Page X of Y" (using segment.pageStart) for PDF books vs "Section X of Y" for text.
- Import screen hides textarea + divider when pdfData is set; shows "X pages · Y sections · ~Z words" summary card instead.
- Page limit exceeded returns HTTP 413 with clear message: "This PDF has N pages. The maximum supported is 150."
- Fallback: if PDF rendering fails (non-oversized error), falls back silently to text-only import.

**Why not native PDF viewer:** react-native-pdf needs a custom dev build (not Expo Go). Page images work identically on web and native Expo Go.
