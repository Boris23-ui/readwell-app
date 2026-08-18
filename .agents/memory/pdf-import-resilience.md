---
name: PDF import resilience
description: Durable constraints for cancelable PDF imports, cleanup queues, and offline page reading.
---

## Rule

PDF imports must remain cancelable from the client and cancellation must be
recognized by the server before and during page uploads. Any page images
created before cancellation or failure need best-effort deletion, while the
client's pending cleanup record must remain until deletion is confirmed.
Rendered pages should use disk-backed image caching so an already-loaded book
can continue during short offline periods.

**Why:** PDF rendering can outlive the screen that started it, and clearing a
cleanup record before a network deletion succeeds leaks storage. Page images
are also remote objects, so relying only on a live connection makes saved PDF
books brittle offline.

**How to apply:** Preserve `AbortSignal` support through multipart upload
helpers, use the server request-aborted signal to stop storing more pages and
clean the partial prefix, keep deletion retries persistent, and use Expo
Image's disk cache for the reader.