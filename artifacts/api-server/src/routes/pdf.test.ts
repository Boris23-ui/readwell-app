/**
 * Route integration tests for the PDF routes.
 *
 * ObjectStorageService is mocked so no real GCS calls are made.
 *
 * Covers DELETE /api/pdf/pages/:bookId:
 *  - happy path: valid UUID → 204, deletePdfPages called once
 *  - bookId not found (no files): still 204 quietly
 *  - invalid bookId format: 400 before reaching storage
 *  - storage error: 500
 *
 * Covers POST /api/render-pdf — partial-import cleanup:
 *  - when uploadBuffer throws after uploading some pages, deletePdfPages is
 *    called for that bookId so no files are stranded in storage
 *  - deleteOrphanedPdfPageFolders is rate-limited (at most once per interval)
 *  - failures in deleteOrphanedPdfPageFolders never block or fail the response
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// ---------------------------------------------------------------------------
// vi.hoisted() lets us declare mock fns that are accessible inside the
// vi.mock() factory even after it is hoisted to the top of the file.
// ---------------------------------------------------------------------------
const { mockDeletePdfPages, mockUploadBuffer, mockDeleteOrphanedPdfPageFolders } = vi.hoisted(() => {
  return {
    mockDeletePdfPages: vi.fn(),
    mockUploadBuffer: vi.fn(),
    mockDeleteOrphanedPdfPageFolders: vi.fn(),
  };
});

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

// ---------------------------------------------------------------------------
// Mock child_process so render-pdf tests don't invoke real system tools.
// execFile is promisified in pdf.ts, so the mock must accept a node-style
// callback as the last argument.
// ---------------------------------------------------------------------------
vi.mock("child_process", () => {
  const execFile = vi.fn((
    _cmd: string,
    args: string[],
    _optsOrCb: unknown,
    maybeCb?: (err: null, result: { stdout: string; stderr: string }) => void,
  ) => {
    // promisify passes options then callback; without options it passes callback as 3rd arg
    const cb: ((err: null, result: { stdout: string; stderr: string }) => void) | undefined =
      typeof maybeCb === "function" ? maybeCb : (typeof _optsOrCb === "function" ? (_optsOrCb as any) : undefined);
    if (!cb) return;
    if (args.includes("-f") || Array.isArray(args) && args[0]?.endsWith(".pdf") && args.includes("stdout")) {
      // tesseract
      cb(null, { stdout: "some ocr text that is long enough to exceed the minimum", stderr: "" });
    } else if (Array.isArray(args) && args.some(a => typeof a === "string" && a.includes("input.pdf"))) {
      // pdfinfo
      cb(null, { stdout: "Pages:          1\n", stderr: "" });
    } else {
      // pdftotext and pdftoppm — return success
      cb(null, { stdout: "A".repeat(150), stderr: "" });
    }
  });
  return { execFile };
});

// ---------------------------------------------------------------------------
// Mock fs.promises so render-pdf tests don't touch the real file system.
// ---------------------------------------------------------------------------
vi.mock("fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("fs")>();
  // Minimal JPEG buffer: SOI + short body — readJpegSize returns null (0×0), which is fine
  const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  return {
    ...original,
    promises: {
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue(fakeJpeg),
      access: vi.fn().mockResolvedValue(undefined),
      rm: vi.fn().mockResolvedValue(undefined),
    },
  };
});

// ---------------------------------------------------------------------------
// Import the Express app AFTER the mocks are registered
// ---------------------------------------------------------------------------
import app from "../app";
import { resetOrphanCleanupTimestamp } from "./pdf";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_UUID = "aabbccdd-1122-3344-5566-778899aabbcc";
const VALID_UUID_2 = "00000000-0000-4000-8000-000000000000";

// A minimal payload that multer accepts as a PDF (mime type drives acceptance,
// not file content — and pdfinfo is mocked).
const FAKE_PDF = Buffer.from("%PDF-1.4 fake");

// ---------------------------------------------------------------------------
// Tests — DELETE /api/pdf/pages/:bookId
// ---------------------------------------------------------------------------
describe("DELETE /api/pdf/pages/:bookId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── happy path ─────────────────────────────────────────────────────────────

  it("returns 204 and calls deletePdfPages with the correct bookId", async () => {
    mockDeletePdfPages.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .delete(`/api/pdf/pages/${VALID_UUID}`)
      .expect(204);

    expect(res.body).toEqual({});
    expect(mockDeletePdfPages).toHaveBeenCalledOnce();
    expect(mockDeletePdfPages).toHaveBeenCalledWith(VALID_UUID);
  });

  // ── bookId not found — should 204, not 404 ─────────────────────────────────

  it("returns 204 even when there are no files for the bookId (empty prefix case)", async () => {
    mockDeletePdfPages.mockResolvedValueOnce(undefined);

    await request(app)
      .delete(`/api/pdf/pages/${VALID_UUID_2}`)
      .expect(204);

    expect(mockDeletePdfPages).toHaveBeenCalledOnce();
    expect(mockDeletePdfPages).toHaveBeenCalledWith(VALID_UUID_2);
  });

  // ── invalid bookId format — must 400 before reaching storage ──────────────

  it("returns 400 for a bookId that is not a UUID", async () => {
    const res = await request(app)
      .delete("/api/pdf/pages/not-a-uuid")
      .expect(400);

    expect(res.body).toHaveProperty("error");
    expect(mockDeletePdfPages).not.toHaveBeenCalled();
  });

  it("returns 400 for a short numeric bookId", async () => {
    const res = await request(app)
      .delete("/api/pdf/pages/12345")
      .expect(400);

    expect(res.body).toHaveProperty("error");
    expect(mockDeletePdfPages).not.toHaveBeenCalled();
  });

  it("returns 400 for a bookId with SQL-injection characters", async () => {
    // URL-encoded: "1' OR 1=1"
    const res = await request(app)
      .delete("/api/pdf/pages/1%27%20OR%201%3D1")
      .expect(400);

    expect(res.body).toHaveProperty("error");
    expect(mockDeletePdfPages).not.toHaveBeenCalled();
  });

  // ── storage error ────────────────────────────────────────────────────────────

  it("returns 500 when deletePdfPages throws", async () => {
    mockDeletePdfPages.mockRejectedValueOnce(new Error("GCS unavailable"));

    const res = await request(app)
      .delete(`/api/pdf/pages/${VALID_UUID}`)
      .expect(500);

    expect(res.body).toHaveProperty("error");
  });
});

// ---------------------------------------------------------------------------
// Tests — POST /api/render-pdf — partial-import cleanup
// ---------------------------------------------------------------------------
describe("POST /api/render-pdf — partial-import cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // deletePdfPages must succeed so cleanup doesn't throw in the catch handler
    mockDeletePdfPages.mockResolvedValue(undefined);
    // Orphan cleanup runs fire-and-forget on every request — resolve by default
    mockDeleteOrphanedPdfPageFolders.mockResolvedValue(undefined);
  });

  it("calls deletePdfPages to clean up stranded pages when uploadBuffer throws mid-import", async () => {
    // Simulate uploadBuffer failing on the first call (page 1 upload throws).
    // Any pages that had already been queued before the error must be cleaned up.
    mockUploadBuffer.mockRejectedValueOnce(new Error("GCS write failed"));

    const res = await request(app)
      .post("/api/render-pdf")
      .attach("file", FAKE_PDF, { filename: "test.pdf", contentType: "application/pdf" })
      .expect(500);

    expect(res.body).toHaveProperty("error");

    // The route must attempt to clean up the partially-uploaded prefix,
    // even though the upload failed on the very first page.
    expect(mockDeletePdfPages).toHaveBeenCalledOnce();
    // bookId is a UUID generated inside the handler — just validate the shape.
    const [calledBookId] = mockDeletePdfPages.mock.calls[0];
    expect(calledBookId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("does NOT call deletePdfPages when all uploads succeed (happy path)", async () => {
    // uploadBuffer resolves for every page → full success
    mockUploadBuffer.mockResolvedValue("/objects/pdf-pages/some-id/001.jpg");

    await request(app)
      .post("/api/render-pdf")
      .attach("file", FAKE_PDF, { filename: "test.pdf", contentType: "application/pdf" })
      .expect(200);

    // deletePdfPages should only be triggered on failure, never on success
    expect(mockDeletePdfPages).not.toHaveBeenCalled();
  });

  it("includes a boolean lowConfidence field on every page in a successful response", async () => {
    mockUploadBuffer.mockResolvedValue("/objects/pdf-pages/some-id/001.jpg");

    const res = await request(app)
      .post("/api/render-pdf")
      .attach("file", FAKE_PDF, { filename: "test.pdf", contentType: "application/pdf" })
      .expect(200);

    expect(Array.isArray(res.body.pages)).toBe(true);
    expect(res.body.pages.length).toBeGreaterThan(0);
    for (const page of res.body.pages) {
      expect(typeof page.lowConfidence).toBe("boolean");
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — POST /api/render-pdf — server-side orphan cleanup (rate-limited)
// ---------------------------------------------------------------------------
describe("POST /api/render-pdf — server-side orphan cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    // Reset the rate-limit gate so each test starts fresh
    resetOrphanCleanupTimestamp();
    mockDeletePdfPages.mockResolvedValue(undefined);
    mockDeleteOrphanedPdfPageFolders.mockResolvedValue(undefined);
  });

  it("invokes deleteOrphanedPdfPageFolders on the first render-pdf request", async () => {
    mockUploadBuffer.mockResolvedValue("/objects/pdf-pages/some-id/001.jpg");

    await request(app)
      .post("/api/render-pdf")
      .attach("file", FAKE_PDF, { filename: "test.pdf", contentType: "application/pdf" })
      .expect(200);

    expect(mockDeleteOrphanedPdfPageFolders).toHaveBeenCalledOnce();
    // TTL should be a positive number (2 hours in ms)
    const [ttlMs] = mockDeleteOrphanedPdfPageFolders.mock.calls[0];
    expect(typeof ttlMs).toBe("number");
    expect(ttlMs).toBeGreaterThan(0);
  });

  it("does not invoke deleteOrphanedPdfPageFolders again on a second request within the interval", async () => {
    mockUploadBuffer.mockResolvedValue("/objects/pdf-pages/some-id/001.jpg");

    // First request — fires cleanup and records the timestamp
    await request(app)
      .post("/api/render-pdf")
      .attach("file", FAKE_PDF, { filename: "test.pdf", contentType: "application/pdf" })
      .expect(200);

    vi.clearAllMocks();
    mockDeletePdfPages.mockResolvedValue(undefined);
    mockDeleteOrphanedPdfPageFolders.mockResolvedValue(undefined);
    mockUploadBuffer.mockResolvedValue("/objects/pdf-pages/some-id/001.jpg");

    // Second request immediately after — must not fire cleanup again
    await request(app)
      .post("/api/render-pdf")
      .attach("file", FAKE_PDF, { filename: "test.pdf", contentType: "application/pdf" })
      .expect(200);

    expect(mockDeleteOrphanedPdfPageFolders).not.toHaveBeenCalled();
  });

  it("invokes deleteOrphanedPdfPageFolders again after the interval has elapsed", async () => {
    mockUploadBuffer.mockResolvedValue("/objects/pdf-pages/some-id/001.jpg");

    const BASE_TIME = 1_000_000_000_000;
    const INTERVAL_MS = process.env.ORPHAN_CLEANUP_INTERVAL_MS
      ? parseInt(process.env.ORPHAN_CLEANUP_INTERVAL_MS, 10)
      : 10 * 60 * 1000;

    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(BASE_TIME);

    // First request — fires cleanup at BASE_TIME
    await request(app)
      .post("/api/render-pdf")
      .attach("file", FAKE_PDF, { filename: "test.pdf", contentType: "application/pdf" })
      .expect(200);

    expect(mockDeleteOrphanedPdfPageFolders).toHaveBeenCalledOnce();
    vi.clearAllMocks();
    mockDeletePdfPages.mockResolvedValue(undefined);
    mockDeleteOrphanedPdfPageFolders.mockResolvedValue(undefined);
    mockUploadBuffer.mockResolvedValue("/objects/pdf-pages/some-id/001.jpg");

    // Advance time past the interval
    dateSpy.mockReturnValue(BASE_TIME + INTERVAL_MS);

    // Third request — must fire cleanup again
    await request(app)
      .post("/api/render-pdf")
      .attach("file", FAKE_PDF, { filename: "test.pdf", contentType: "application/pdf" })
      .expect(200);

    expect(mockDeleteOrphanedPdfPageFolders).toHaveBeenCalledOnce();
  });

  it("does not fail the response when deleteOrphanedPdfPageFolders rejects", async () => {
    // Orphan cleanup failure must be swallowed — the render-pdf response
    // should still succeed (200) even when cleanup throws.
    mockDeleteOrphanedPdfPageFolders.mockRejectedValue(new Error("GCS scan failed"));
    mockUploadBuffer.mockResolvedValue("/objects/pdf-pages/some-id/001.jpg");

    const res = await request(app)
      .post("/api/render-pdf")
      .attach("file", FAKE_PDF, { filename: "test.pdf", contentType: "application/pdf" })
      .expect(200);

    expect(res.body).toHaveProperty("bookId");
  });

  it("does not fail the response when deleteOrphanedPdfPageFolders rejects and upload also fails", async () => {
    // Both cleanup and upload fail — the route should still return 500 with
    // an error body (cleanup failure must not mask the real error).
    mockDeleteOrphanedPdfPageFolders.mockRejectedValue(new Error("GCS scan failed"));
    mockUploadBuffer.mockRejectedValueOnce(new Error("GCS write failed"));

    const res = await request(app)
      .post("/api/render-pdf")
      .attach("file", FAKE_PDF, { filename: "test.pdf", contentType: "application/pdf" })
      .expect(500);

    expect(res.body).toHaveProperty("error");
  });
});
