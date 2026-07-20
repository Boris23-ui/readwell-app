/**
 * Standalone, testable orphan-cleanup logic extracted from AppContext.
 *
 * This module contains no React, no AsyncStorage reads/writes, and no
 * side-effects beyond calling the supplied `deletePdfPagesFn`.  That makes it
 * straightforward to unit-test in a plain Node/vitest environment.
 */

export interface PendingPdfImport {
  /** The server-side bookId used in storage paths (pdf-pages/<bookId>/). */
  serverBookId: string;
  /** ISO timestamp of when the render completed (used to apply a grace period). */
  registeredAt: string;
}

/**
 * How old a pending import must be before we consider it orphaned and safe to
 * delete.  Exported so tests can reference the same constant.
 */
export const PENDING_PDF_GRACE_MS = 60 * 60 * 1000; // 1 hour

export interface SavedBook {
  sourceType?: string;
  pages?: { imageUrl: string }[];
}

export interface OrphanCleanupResult {
  /** Entries that were kept (too recent, or still in a saved book). */
  stillPending: PendingPdfImport[];
  /**
   * Server book IDs whose page images were dispatched for deletion.
   * Each call to `deletePdfPagesFn` is awaited (via Promise.allSettled) so
   * failures don't abort the rest of the cleanup; the caller decides whether
   * to surface errors.
   */
  deletedIds: string[];
}

/**
 * Examine `pending` entries against `savedBooks` and `now`, then:
 * - drop entries whose serverBookId already appears in a saved book's image URLs
 * - keep entries that are younger than `PENDING_PDF_GRACE_MS`
 * - call `deletePdfPagesFn` for entries that are old enough and not saved
 *
 * Returns which entries remain pending and which IDs were targeted for deletion.
 */
export async function runOrphanCleanup(
  pending: PendingPdfImport[],
  savedBooks: SavedBook[],
  now: number,
  deletePdfPagesFn: (bookId: string) => Promise<void>,
): Promise<OrphanCleanupResult> {
  // Collect every server bookId that has made it into a saved book
  const savedServerBookIds = new Set<string>();
  for (const book of savedBooks) {
    if (book.sourceType === 'pdf' && book.pages && book.pages.length > 0) {
      const match = book.pages[0].imageUrl.match(/\/objects\/pdf-pages\/([^/]+)\//);
      if (match) savedServerBookIds.add(match[1]);
    }
  }

  const stillPending: PendingPdfImport[] = [];
  const toDelete: string[] = [];

  for (const entry of pending) {
    const age = now - new Date(entry.registeredAt).getTime();

    if (savedServerBookIds.has(entry.serverBookId)) {
      // Already saved — drop it silently (no storage deletion needed)
      continue;
    }

    if (age < PENDING_PDF_GRACE_MS) {
      // Too recent — might still be in-progress on this device; keep it
      stillPending.push(entry);
      continue;
    }

    // Orphaned — schedule the page images for deletion
    toDelete.push(entry.serverBookId);
  }

  // Fire all deletions concurrently; failures are swallowed so one bad delete
  // doesn't block the others.
  await Promise.allSettled(toDelete.map(id => deletePdfPagesFn(id)));

  return { stillPending, deletedIds: toDelete };
}
