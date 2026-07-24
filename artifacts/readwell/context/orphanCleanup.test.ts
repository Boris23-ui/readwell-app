import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runOrphanCleanup,
  PENDING_PDF_GRACE_MS,
  type PendingPdfImport,
  type SavedBook,
} from './orphanCleanup';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTimestamp(msAgo: number): string {
  return new Date(Date.now() - msAgo).toISOString();
}

function makePdfBook(serverBookId: string): SavedBook {
  return {
    sourceType: 'pdf',
    pages: [
      {
        imageUrl: `/objects/pdf-pages/${serverBookId}/page-1.jpg`,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runOrphanCleanup', () => {
  let deletePdfPagesMock: ReturnType<typeof vi.fn<(bookId: string) => Promise<void>>>;
  const NOW = Date.now();

  beforeEach(() => {
    deletePdfPagesMock = vi.fn<(bookId: string) => Promise<void>>().mockResolvedValue(undefined);
  });

  // ── Case (a): old orphan ──────────────────────────────────────────────────

  it('calls deletePdfPages for a pending entry older than the grace period that has no matching saved book', async () => {
    const pending: PendingPdfImport[] = [
      {
        serverBookId: 'orphan-old',
        // 2 hours ago — well past the 1-hour grace period
        registeredAt: new Date(NOW - PENDING_PDF_GRACE_MS * 2).toISOString(),
      },
    ];
    const savedBooks: SavedBook[] = [];

    const result = await runOrphanCleanup(pending, savedBooks, NOW, deletePdfPagesMock);

    expect(deletePdfPagesMock).toHaveBeenCalledOnce();
    expect(deletePdfPagesMock).toHaveBeenCalledWith('orphan-old');
    expect(result.deletedIds).toEqual(['orphan-old']);
    expect(result.stillPending).toHaveLength(0);
  });

  it('removes the orphaned entry from stillPending after scheduling deletion', async () => {
    const pending: PendingPdfImport[] = [
      {
        serverBookId: 'orphan-old',
        registeredAt: new Date(NOW - PENDING_PDF_GRACE_MS * 3).toISOString(),
      },
    ];

    const result = await runOrphanCleanup(pending, [], NOW, deletePdfPagesMock);

    expect(result.stillPending).toHaveLength(0);
  });

  // ── Case (b): recent pending entry ───────────────────────────────────────

  it('keeps a recent pending entry without calling deletePdfPages', async () => {
    const pending: PendingPdfImport[] = [
      {
        serverBookId: 'import-in-progress',
        // 5 minutes ago — within the grace period
        registeredAt: new Date(NOW - 5 * 60 * 1000).toISOString(),
      },
    ];

    const result = await runOrphanCleanup(pending, [], NOW, deletePdfPagesMock);

    expect(deletePdfPagesMock).not.toHaveBeenCalled();
    expect(result.stillPending).toHaveLength(1);
    expect(result.stillPending[0].serverBookId).toBe('import-in-progress');
    expect(result.deletedIds).toHaveLength(0);
  });

  it('keeps an entry that is exactly at the grace-period boundary (not yet expired)', async () => {
    // age = grace - 1 ms → still within the window
    const pending: PendingPdfImport[] = [
      {
        serverBookId: 'just-under',
        registeredAt: new Date(NOW - (PENDING_PDF_GRACE_MS - 1)).toISOString(),
      },
    ];

    const result = await runOrphanCleanup(pending, [], NOW, deletePdfPagesMock);

    expect(deletePdfPagesMock).not.toHaveBeenCalled();
    expect(result.stillPending).toHaveLength(1);
  });

  // ── Case (c): entry whose bookId appears in a saved book ─────────────────

  it('silently drops an entry whose serverBookId appears in a saved book page URL without calling deletePdfPages', async () => {
    const serverBookId = 'already-saved';
    const pending: PendingPdfImport[] = [
      {
        serverBookId,
        // Old enough that it would otherwise be deleted
        registeredAt: new Date(NOW - PENDING_PDF_GRACE_MS * 2).toISOString(),
      },
    ];
    const savedBooks: SavedBook[] = [makePdfBook(serverBookId)];

    const result = await runOrphanCleanup(pending, savedBooks, NOW, deletePdfPagesMock);

    expect(deletePdfPagesMock).not.toHaveBeenCalled();
    // Neither kept pending nor scheduled for deletion
    expect(result.stillPending).toHaveLength(0);
    expect(result.deletedIds).toHaveLength(0);
  });

  it('also silently drops a recent entry whose serverBookId appears in a saved book', async () => {
    const serverBookId = 'recently-saved';
    const pending: PendingPdfImport[] = [
      {
        serverBookId,
        registeredAt: new Date(NOW - 2 * 60 * 1000).toISOString(), // 2 minutes ago
      },
    ];
    const savedBooks: SavedBook[] = [makePdfBook(serverBookId)];

    const result = await runOrphanCleanup(pending, savedBooks, NOW, deletePdfPagesMock);

    expect(deletePdfPagesMock).not.toHaveBeenCalled();
    expect(result.stillPending).toHaveLength(0);
    expect(result.deletedIds).toHaveLength(0);
  });

  // ── Mixed entries ────────────────────────────────────────────────────────

  it('handles a mix of old orphans, recent entries, and saved-book entries correctly', async () => {
    const pending: PendingPdfImport[] = [
      {
        serverBookId: 'orphan-a',
        registeredAt: new Date(NOW - PENDING_PDF_GRACE_MS * 2).toISOString(),
      },
      {
        serverBookId: 'orphan-b',
        registeredAt: new Date(NOW - PENDING_PDF_GRACE_MS * 5).toISOString(),
      },
      {
        serverBookId: 'recent',
        registeredAt: new Date(NOW - 10 * 60 * 1000).toISOString(), // 10 min
      },
      {
        serverBookId: 'in-saved-book',
        registeredAt: new Date(NOW - PENDING_PDF_GRACE_MS * 3).toISOString(),
      },
    ];
    const savedBooks: SavedBook[] = [makePdfBook('in-saved-book')];

    const result = await runOrphanCleanup(pending, savedBooks, NOW, deletePdfPagesMock);

    // Orphans A and B should be deleted
    expect(deletePdfPagesMock).toHaveBeenCalledTimes(2);
    expect(deletePdfPagesMock).toHaveBeenCalledWith('orphan-a');
    expect(deletePdfPagesMock).toHaveBeenCalledWith('orphan-b');

    // Recent entry is kept
    expect(result.stillPending).toHaveLength(1);
    expect(result.stillPending[0].serverBookId).toBe('recent');

    // Deleted IDs list matches the orphans
    expect(result.deletedIds).toEqual(expect.arrayContaining(['orphan-a', 'orphan-b']));
    expect(result.deletedIds).toHaveLength(2);
  });

  // ── Empty inputs ─────────────────────────────────────────────────────────

  it('handles an empty pending list without errors', async () => {
    const result = await runOrphanCleanup([], [], NOW, deletePdfPagesMock);

    expect(deletePdfPagesMock).not.toHaveBeenCalled();
    expect(result.stillPending).toHaveLength(0);
    expect(result.deletedIds).toHaveLength(0);
  });

  // ── Non-PDF saved books are ignored ──────────────────────────────────────

  it('does not match a pending serverBookId against non-PDF saved books', async () => {
    const serverBookId = 'some-id';
    const pending: PendingPdfImport[] = [
      {
        serverBookId,
        registeredAt: new Date(NOW - PENDING_PDF_GRACE_MS * 2).toISOString(),
      },
    ];
    // A book with the same ID pattern but not a PDF source type
    const savedBooks: SavedBook[] = [
      { sourceType: 'text', pages: [{ imageUrl: `/objects/pdf-pages/${serverBookId}/page-1.jpg` }] },
    ];

    const result = await runOrphanCleanup(pending, savedBooks, NOW, deletePdfPagesMock);

    // Non-PDF book should not protect the pending entry
    expect(deletePdfPagesMock).toHaveBeenCalledWith(serverBookId);
    expect(result.deletedIds).toContain(serverBookId);
  });

  // ── deletePdfPages failure is swallowed ───────────────────────────────────

  it('does not throw when deletePdfPages rejects, and still reports the ID as deleted', async () => {
    deletePdfPagesMock.mockRejectedValue(new Error('network error'));

    const pending: PendingPdfImport[] = [
      {
        serverBookId: 'failing-delete',
        registeredAt: new Date(NOW - PENDING_PDF_GRACE_MS * 2).toISOString(),
      },
    ];

    // Should not throw even though deletePdfPages rejects
    await expect(runOrphanCleanup(pending, [], NOW, deletePdfPagesMock)).resolves.toBeDefined();

    const result = await runOrphanCleanup(pending, [], NOW, deletePdfPagesMock);
    expect(result.deletedIds).toContain('failing-delete');
    expect(result.stillPending).toHaveLength(0);
  });
});
