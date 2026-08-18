/**
 * Real-tool integration coverage for scanned PDF confidence.
 *
 * Unlike pdf.test.ts, this file intentionally does not mock fs or child_process.
 * It builds a two-page, image-only PDF from the SVG fixtures and sends it
 * through the actual render-pdf route. This exercises pdfinfo, pdftoppm, the
 * Tesseract fallback, OCR sanitisation, and computePageConfidence together.
 *
 * ImageMagick is used only to assemble the fixture PDF at test time. The
 * route's production dependencies (Poppler and Tesseract) do the actual
 * rendering and OCR work being verified here.
 */
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";

const execFileAsync = promisify(execFile);

const { mockDeletePdfPages, mockUploadBuffer, mockDeleteOrphanedPdfPageFolders } = vi.hoisted(() => ({
  mockDeletePdfPages: vi.fn(),
  mockUploadBuffer: vi.fn(),
  mockDeleteOrphanedPdfPageFolders: vi.fn(),
}));

vi.mock("../lib/objectStorage", () => {
  class ObjectStorageService {
    deletePdfPages = mockDeletePdfPages;
    uploadBuffer = mockUploadBuffer;
    deleteOrphanedPdfPageFolders = mockDeleteOrphanedPdfPageFolders;
    getObjectEntityFile = vi.fn();
    downloadObject = vi.fn();
    searchPublicObject = vi.fn();
    getObjectEntityUploadURL = vi.fn();
    normalizeObjectEntityPath = vi.fn();
    trySetObjectEntityAclPolicy = vi.fn();
    canAccessObjectEntity = vi.fn();
  }
  return { ObjectStorageService };
});

import app from "../app";

const fixtureDir = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../test-fixtures",
);

let temporaryDirectories: string[] = [];

async function createFixturePdf(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "readwell-scan-"));
  temporaryDirectories.push(tempDir);

  const readableSvg = await fs.readFile(path.join(fixtureDir, "readable-scan.svg"));
  const blurrySvg = await fs.readFile(path.join(fixtureDir, "blurry-scan.svg"));
  const readablePath = path.join(tempDir, "readable.svg");
  const blurryPath = path.join(tempDir, "blurry.svg");
  const pdfPath = path.join(tempDir, "scanned-book.pdf");

  await Promise.all([
    fs.writeFile(readablePath, readableSvg),
    fs.writeFile(blurryPath, blurrySvg),
  ]);
  await execFileAsync("magick", [readablePath, blurryPath, pdfPath]);
  return pdfPath;
}

describe("POST /api/render-pdf — real scanned-page confidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeletePdfPages.mockResolvedValue(undefined);
    mockUploadBuffer.mockResolvedValue("/objects/pdf-pages/fixture/page.jpg");
    mockDeleteOrphanedPdfPageFolders.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.map(directory => fs.rm(directory, { recursive: true, force: true })),
    );
    temporaryDirectories = [];
  });

  it("flags a genuinely blurry scan while leaving a readable scan unflagged", async () => {
    const pdfPath = await createFixturePdf();
    const pdfBuffer = await fs.readFile(pdfPath);

    const response = await request(app)
      .post("/api/render-pdf")
      .attach("file", pdfBuffer, {
        filename: "synthetic-scanned-book.pdf",
        contentType: "application/pdf",
      })
      .expect(200);

    expect(response.body.pageCount).toBe(2);
    expect(response.body.ocrUsed).toBe(true);
    expect(response.body.pages).toHaveLength(2);

    const [readablePage, blurryPage] = response.body.pages;
    expect(readablePage.ocrUsed).toBe(true);
    expect(readablePage.text.split(/\s+/).length).toBeGreaterThanOrEqual(20);
    expect(readablePage.lowConfidence).toBe(false);

    // Tesseract is attempted, but the route only marks OCR as used when it
    // recovers text. A truly illegible scan therefore remains empty while
    // still receiving the low-confidence warning.
    expect(blurryPage.ocrUsed).toBe(false);
    expect(blurryPage.text).toBe("");
    expect(blurryPage.lowConfidence).toBe(true);
  });
});