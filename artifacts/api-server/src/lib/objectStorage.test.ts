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
