/**
 * Unit tests for ObjectStorageService.deletePdfPages
 *
 * The GCS client is fully mocked so these tests run without real credentials.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted() lets us declare variables that are available when vi.mock()
// factories are hoisted to the top of the file.
// ---------------------------------------------------------------------------
const { mockDelete, mockGetFiles, mockBucketInstance } = vi.hoisted(() => {
  const mockDelete = vi.fn().mockResolvedValue(undefined);
  const mockGetFiles = vi.fn();
  const mockBucketInstance = {
    getFiles: mockGetFiles,
    file: vi.fn((name: string) => ({ name, delete: mockDelete })),
  };
  return { mockDelete, mockGetFiles, mockBucketInstance };
});

// ---------------------------------------------------------------------------
// Mock @google-cloud/storage BEFORE importing the module under test.
// ---------------------------------------------------------------------------
vi.mock("@google-cloud/storage", () => {
  class Storage {
    bucket(_name: string) {
      return mockBucketInstance;
    }
  }
  return { Storage, File: class {} };
});

// Stub out the ACL module that objectStorage.ts imports
vi.mock("./objectAcl", () => ({
  canAccessObject: vi.fn(),
  getObjectAclPolicy: vi.fn(),
  setObjectAclPolicy: vi.fn(),
  ObjectPermission: { READ: "read" },
}));

// ---------------------------------------------------------------------------
// Import the module under test (after mocks are registered)
// ---------------------------------------------------------------------------
import { ObjectStorageService } from "./objectStorage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const FAKE_PRIVATE_DIR = "/my-bucket/private";
const FAKE_BOOK_ID = "11111111-2222-3333-4444-555555555555";
const EXPECTED_PREFIX = `private/pdf-pages/${FAKE_BOOK_ID}/`;

function makeService(): ObjectStorageService {
  vi.stubEnv("PRIVATE_OBJECT_DIR", FAKE_PRIVATE_DIR);
  return new ObjectStorageService();
}

function makeFileMock(name: string) {
  return { name, delete: mockDelete };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("ObjectStorageService.deletePdfPages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore mockDelete to resolve by default after clearAllMocks
    mockDelete.mockResolvedValue(undefined);
  });

  it("lists files under the correct prefix and deletes all of them", async () => {
    const files = [
      makeFileMock("private/pdf-pages/11111111-2222-3333-4444-555555555555/001.jpg"),
      makeFileMock("private/pdf-pages/11111111-2222-3333-4444-555555555555/002.jpg"),
      makeFileMock("private/pdf-pages/11111111-2222-3333-4444-555555555555/003.jpg"),
    ];
    mockGetFiles.mockResolvedValueOnce([files]);

    const svc = makeService();
    await svc.deletePdfPages(FAKE_BOOK_ID);

    // getFiles must be called with the exact prefix derived from PRIVATE_OBJECT_DIR
    expect(mockGetFiles).toHaveBeenCalledOnce();
    expect(mockGetFiles).toHaveBeenCalledWith({ prefix: EXPECTED_PREFIX });

    // Every listed file must be deleted with ignoreNotFound so missing files don't throw
    expect(mockDelete).toHaveBeenCalledTimes(3);
    expect(mockDelete).toHaveBeenCalledWith({ ignoreNotFound: true });
  });

  it("does nothing (no delete calls) when there are no files under the prefix", async () => {
    mockGetFiles.mockResolvedValueOnce([[]]); // empty list

    const svc = makeService();
    await svc.deletePdfPages(FAKE_BOOK_ID);

    expect(mockGetFiles).toHaveBeenCalledOnce();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("uses the correct prefix even when PRIVATE_OBJECT_DIR has a trailing slash", async () => {
    vi.stubEnv("PRIVATE_OBJECT_DIR", "/my-bucket/private/"); // trailing slash variant
    mockGetFiles.mockResolvedValueOnce([[makeFileMock("private/pdf-pages/any/001.jpg")]]);

    const svc = new ObjectStorageService();
    await svc.deletePdfPages(FAKE_BOOK_ID);

    expect(mockGetFiles).toHaveBeenCalledWith({ prefix: EXPECTED_PREFIX });
  });

  it("passes ignoreNotFound:true so a race-deleted file does not surface as an error", async () => {
    const f = makeFileMock("private/pdf-pages/11111111-2222-3333-4444-555555555555/001.jpg");
    mockGetFiles.mockResolvedValueOnce([[f]]);

    const svc = makeService();
    await svc.deletePdfPages(FAKE_BOOK_ID);

    expect(f.delete).toHaveBeenCalledWith({ ignoreNotFound: true });
  });
});

// ---------------------------------------------------------------------------
// deleteOrphanedPdfPageFolders
// ---------------------------------------------------------------------------

const BOOK_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const BOOK_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

/** Creates a fake GCS file object with a metadata.timeCreated field. */
function makeTimedFile(name: string, timeCreated: Date) {
  return {
    name,
    metadata: { timeCreated: timeCreated.toISOString() },
    delete: mockDelete,
  };
}

function makeIncompleteMetadataFile(name: string) {
  return {
    name,
    metadata: {},
    delete: mockDelete,
  };
}

describe("ObjectStorageService.deleteOrphanedPdfPageFolders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDelete.mockResolvedValue(undefined);
  });

  it("deletes a folder whose newest file is older than the TTL", async () => {
    const oldTime = new Date(Date.now() - TTL_MS - 10_000); // just past the cutoff
    const f = makeTimedFile(`private/pdf-pages/${BOOK_A}/001.jpg`, oldTime);

    // First call: list all pdf-pages/ files
    // Second call (via deletePdfPages): list files under BOOK_A's prefix
    mockGetFiles
      .mockResolvedValueOnce([[f]])
      .mockResolvedValueOnce([[f]]);

    const svc = makeService();
    await svc.deleteOrphanedPdfPageFolders(TTL_MS);

    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith({ ignoreNotFound: true });
  });

  it("leaves a folder whose newest file is within the TTL intact", async () => {
    const recentTime = new Date(Date.now() - TTL_MS + 30_000); // safely within TTL
    const f = makeTimedFile(`private/pdf-pages/${BOOK_A}/001.jpg`, recentTime);

    mockGetFiles.mockResolvedValueOnce([[f]]);

    const svc = makeService();
    await svc.deleteOrphanedPdfPageFolders(TTL_MS);

    // Only the initial listing call should have been made — no deletions
    expect(mockGetFiles).toHaveBeenCalledOnce();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("deletes old folders and leaves recent ones intact when both are present", async () => {
    const now = Date.now();
    const oldTime = new Date(now - TTL_MS - 60_000);
    const recentTime = new Date(now - 5_000);

    const oldFile = makeTimedFile(`private/pdf-pages/${BOOK_A}/001.jpg`, oldTime);
    const recentFile = makeTimedFile(`private/pdf-pages/${BOOK_B}/001.jpg`, recentTime);

    // List all → then deletePdfPages for BOOK_A only (Map inserts BOOK_A first)
    mockGetFiles
      .mockResolvedValueOnce([[oldFile, recentFile]])
      .mockResolvedValueOnce([[oldFile]]);

    const svc = makeService();
    await svc.deleteOrphanedPdfPageFolders(TTL_MS);

    // Only the old folder's file is deleted
    expect(mockDelete).toHaveBeenCalledOnce();
  });

  it("uses the most recent file's timestamp to decide — keeps a folder with any recent file", async () => {
    const now = Date.now();
    const oldFile = makeTimedFile(
      `private/pdf-pages/${BOOK_A}/001.jpg`,
      new Date(now - TTL_MS - 60_000),
    );
    const recentFile = makeTimedFile(
      `private/pdf-pages/${BOOK_A}/002.jpg`,
      new Date(now - 5_000),
    );

    // Both files belong to the same book; the newer file makes the folder active
    mockGetFiles.mockResolvedValueOnce([[oldFile, recentFile]]);

    const svc = makeService();
    await svc.deleteOrphanedPdfPageFolders(TTL_MS);

    // Folder should NOT be deleted because its newest file is within TTL
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("keeps a folder when any file is missing timeCreated metadata", async () => {
    const oldFile = makeTimedFile(
      `private/pdf-pages/${BOOK_A}/001.jpg`,
      new Date(Date.now() - TTL_MS - 60_000),
    );
    const incompleteFile = makeIncompleteMetadataFile(
      `private/pdf-pages/${BOOK_A}/002.jpg`,
    );

    mockGetFiles.mockResolvedValueOnce([[oldFile, incompleteFile]]);

    const svc = makeService();
    await svc.deleteOrphanedPdfPageFolders(TTL_MS);

    // Missing metadata is fail-closed rather than interpreted as epoch time.
    expect(mockGetFiles).toHaveBeenCalledOnce();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("skips only the incomplete folder while still deleting valid old siblings", async () => {
    const incompleteFile = makeIncompleteMetadataFile(
      `private/pdf-pages/${BOOK_A}/001.jpg`,
    );
    const oldFile = makeTimedFile(
      `private/pdf-pages/${BOOK_B}/001.jpg`,
      new Date(Date.now() - TTL_MS - 60_000),
    );

    mockGetFiles
      .mockResolvedValueOnce([[incompleteFile, oldFile]])
      .mockResolvedValueOnce([[oldFile]]);

    const svc = makeService();
    await svc.deleteOrphanedPdfPageFolders(TTL_MS);

    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith({ ignoreNotFound: true });
  });

  it("swallows a per-folder error so sibling folders are still deleted", async () => {
    const oldTime = new Date(Date.now() - TTL_MS - 60_000);
    const fileA = makeTimedFile(`private/pdf-pages/${BOOK_A}/001.jpg`, oldTime);
    const fileB = makeTimedFile(`private/pdf-pages/${BOOK_B}/001.jpg`, oldTime);

    // List all folders (BOOK_A is inserted into the Map first)
    mockGetFiles.mockResolvedValueOnce([[fileA, fileB]]);
    // deletePdfPages for BOOK_A: getFiles throws
    mockGetFiles.mockRejectedValueOnce(new Error("GCS unavailable"));
    // deletePdfPages for BOOK_B: succeeds and returns a deletable file
    mockGetFiles.mockResolvedValueOnce([[fileB]]);

    const svc = makeService();
    // Must resolve (not throw) even though one folder's deletion fails
    await expect(svc.deleteOrphanedPdfPageFolders(TTL_MS)).resolves.toBeUndefined();

    // BOOK_B's file must still be deleted despite BOOK_A's failure
    expect(mockDelete).toHaveBeenCalledOnce();
  });

  it("does nothing when there are no files under pdf-pages/", async () => {
    mockGetFiles.mockResolvedValueOnce([[]]); // empty listing

    const svc = makeService();
    await svc.deleteOrphanedPdfPageFolders(TTL_MS);

    expect(mockGetFiles).toHaveBeenCalledOnce();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
