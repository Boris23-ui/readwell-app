/**
 * Route integration tests for DELETE /api/pdf/pages/:bookId
 *
 * ObjectStorageService is mocked so no real GCS calls are made.
 *
 * Covers:
 *  - happy path: valid UUID → 204, deletePdfPages called once
 *  - bookId not found (no files): still 204 quietly
 *  - invalid bookId format: 400 before reaching storage
 *  - storage error: 500
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// ---------------------------------------------------------------------------
// vi.hoisted() lets us declare mock fns that are accessible inside the
// vi.mock() factory even after it is hoisted to the top of the file.
// ---------------------------------------------------------------------------
const { mockDeletePdfPages } = vi.hoisted(() => {
  return { mockDeletePdfPages: vi.fn() };
});

vi.mock("../lib/objectStorage", () => {
  class ObjectStorageService {
    deletePdfPages = mockDeletePdfPages;
    uploadBuffer = vi.fn();
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
// Import the Express app AFTER the mock is registered
// ---------------------------------------------------------------------------
import app from "../app";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_UUID = "aabbccdd-1122-3344-5566-778899aabbcc";
const VALID_UUID_2 = "00000000-0000-4000-8000-000000000000";

// ---------------------------------------------------------------------------
// Tests
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
