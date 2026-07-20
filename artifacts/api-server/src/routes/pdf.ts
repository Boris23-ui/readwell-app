import { Router } from "express";
import multer from "multer";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../lib/logger";
import { ObjectStorageService } from "../lib/objectStorage";

const execFileAsync = promisify(execFile);
const router = Router();
const objectStorage = new ObjectStorageService();

/**
 * Corrects common character-level OCR substitution errors.
 *
 * Only applies corrections where the surrounding context makes the intended
 * character unambiguous (e.g. "|" flanked by lowercase letters is almost
 * certainly a misread "l", not a pipe character). Standalone digits and
 * uppercase-surrounded characters are left untouched to avoid corrupting
 * legitimate numeric content.
 */
export function correctOcrSubstitutions(text: string): string {
  return text
    // "|" → "l" between lowercase letters (pipe misread as lowercase L)
    // e.g. "samp|e" → "sample", "on|y" → "only"
    .replace(/(?<=[a-z])\|(?=[a-z])/g, 'l')
    // "|" → "I" when used as a standalone word token (pipe misread as capital I)
    // Matches "|" surrounded by whitespace or at string/line boundaries,
    // e.g. "| went to" → "I went to", "She and | both" → "She and I both"
    .replace(/(?<!\S)\|(?!\S)/g, 'I')
    // "0" → "o" between lowercase letters (zero misread as letter o)
    // e.g. "c0mputer" → "computer", "w0rd" → "word"
    .replace(/(?<=[a-z])0(?=[a-z])/g, 'o')
    // "1" → "l" at the very start of a word followed by 2+ lowercase letters
    // (digit-one misread as lowercase L at word-start; avoids corrupting
    // meaningful numbers like "100" or mid-word digits like "qu1ck")
    // e.g. "1azy" → "lazy", "1ong" → "long"
    .replace(/\b1(?=[a-z]{2,})/g, 'l');
}

/**
 * Light post-processing for OCR-sourced text.
 * Corrects common character-level substitutions, then removes structural noise
 * without touching normal extracted text.
 */
export function sanitizeOcrText(raw: string): string {
  return correctOcrSubstitutions(
    raw
      .split('\n')
      // Remove lines that are a single character (noise glyphs)
      .filter(line => line.trim().length !== 1)
      // Remove lines that are entirely non-alphanumeric (e.g. "--- ---" or "| |")
      .filter(line => line.trim() === '' || /[a-z0-9]/i.test(line))
      // Collapse runs of 3+ repeated identical characters that are not word chars
      // (e.g. "~~~~", "====", "....") — keep ellipsis ("...") intact
      .map(line => line.replace(/([^\w\s])\1{3,}/g, ''))
      .join('\n')
      // Collapse 3+ consecutive blank lines into two (paragraph break)
      .replace(/\n{3,}/g, '\n\n')
      // Fix broken hyphenation: word-\nnextword → wordnextword
      .replace(/(\w)-\n(\w)/g, '$1$2')
      // Collapse excessive internal whitespace (but not newlines)
      .replace(/[^\S\n]{2,}/g, ' ')
      .trim()
  );
}

const MAX_PAGES = 150;
const RENDER_DPI = 150;

// How often the orphaned-page cleanup may run, in milliseconds.
// Defaults to 10 minutes; override with ORPHAN_CLEANUP_INTERVAL_MS env var.
const ORPHAN_CLEANUP_INTERVAL_MS = process.env.ORPHAN_CLEANUP_INTERVAL_MS
  ? parseInt(process.env.ORPHAN_CLEANUP_INTERVAL_MS, 10)
  : 10 * 60 * 1000; // 10 minutes

// Timestamp of the last time the orphan cleanup was fired on this server instance.
// Uses -Infinity so the first request always triggers a cleanup.
let lastOrphanCleanupAt = -Infinity;

/** Resets the orphan-cleanup rate-limit gate. Exported for use in tests only. */
export function resetOrphanCleanupTimestamp(): void {
  lastOrphanCleanupAt = -Infinity;
}

/**
 * Computes a low-confidence flag for a rendered page based on the word count
 * of its post-sanitisation text.
 *
 * Very few real words after sanitisation is a strong signal that the page
 * image was too blurry for OCR to recover meaningful content, making it
 * unlikely that the quiz generator can produce useful questions from it.
 *
 * Threshold chosen so that a mostly-blank or illegible page (< 20 words)
 * is flagged while a lightly-scanned page with a paragraph or two is not.
 */
const LOW_CONFIDENCE_WORD_THRESHOLD = 20;

export function computePageConfidence(sanitisedText: string): boolean {
  const wordCount = sanitisedText
    .split(/\s+/)
    .filter(w => /[a-z]{2,}/i.test(w)).length;
  return wordCount < LOW_CONFIDENCE_WORD_THRESHOLD;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter(_req, file, cb) {
    const extOk = /\.pdf$/i.test(file.originalname);
    if (file.mimetype === "application/pdf" || extOk) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

// Read width/height from a JPEG buffer by scanning for the SOF marker.
function readJpegSize(buf: Buffer): { width: number; height: number } | null {
  let offset = 2; // skip SOI
  while (offset < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buf[offset + 1];
    // SOF0..SOF15 (excluding DHT/JPG/DAC markers) carry dimensions
    if (
      (marker >= 0xc0 && marker <= 0xcf) &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }
    const segLen = buf.readUInt16BE(offset + 2);
    offset += 2 + segLen;
  }
  return null;
}

async function getPageCount(pdfPath: string): Promise<number> {
  const { stdout } = await execFileAsync("pdfinfo", [pdfPath]);
  const match = stdout.match(/^Pages:\s+(\d+)/m);
  return match ? parseInt(match[1], 10) : 0;
}

interface RenderedPage {
  pageNumber: number;
  imageUrl: string;
  width: number;
  height: number;
  text: string;
  ocrUsed: boolean;
  /** True when the page has too few recoverable words for reliable quiz generation. */
  lowConfidence: boolean;
}

// expiresAt gives clients a hint for when orphaned page images may be
// lazily cleaned up (2 h after upload). Pages should be promoted to a
// saved book before this time, or explicitly deleted by the client.
const PDF_PAGES_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

router.post("/render-pdf", upload.single("file"), async (req, res) => {
  // Fire-and-forget: lazily clean up orphaned pdf-pages folders older than
  // the TTL. Rate-limited to at most once per ORPHAN_CLEANUP_INTERVAL_MS so
  // that concurrent imports don't hammer storage with simultaneous scans.
  const now = Date.now();
  if (now - lastOrphanCleanupAt >= ORPHAN_CLEANUP_INTERVAL_MS) {
    lastOrphanCleanupAt = now;
    objectStorage.deleteOrphanedPdfPageFolders(PDF_PAGES_TTL_MS).catch((err) => {
      logger.warn({ err }, "Orphaned PDF pages cleanup failed");
    });
  }

  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const { originalname, buffer } = req.file;
  const workDir = path.join(os.tmpdir(), `pdf-${randomUUID()}`);
  const bookId = randomUUID();

  logger.info({ filename: originalname, size: buffer.length }, "Rendering PDF pages");

  try {
    await fs.mkdir(workDir, { recursive: true });
    const pdfPath = path.join(workDir, "input.pdf");
    await fs.writeFile(pdfPath, buffer);

    const pageCount = await getPageCount(pdfPath);
    if (pageCount === 0) {
      res.status(422).json({ error: "Could not read this PDF." });
      return;
    }
    if (pageCount > MAX_PAGES) {
      res.status(413).json({
        error: `This PDF has ${pageCount} pages. The maximum supported is ${MAX_PAGES} pages. Please split it into smaller documents.`,
      });
      return;
    }

    // Render all pages to JPEGs: <workDir>/page-1.jpg, page-2.jpg, ...
    const prefix = path.join(workDir, "page");
    await execFileAsync(
      "pdftoppm",
      [
        "-jpeg",
        "-jpegopt",
        "quality=75",
        "-r",
        String(RENDER_DPI),
        pdfPath,
        prefix,
      ],
      { maxBuffer: 1024 * 1024 * 64 },
    );

    const pages: RenderedPage[] = [];
    let anyOcrUsed = false;

    for (let p = 1; p <= pageCount; p++) {
      // pdftoppm zero-pads the page number to the width of the total count
      const padWidth = String(pageCount).length;
      const padded = String(p).padStart(padWidth, "0");
      let imgPath = `${prefix}-${padded}.jpg`;
      try {
        await fs.access(imgPath);
      } catch {
        // Fallback: some poppler builds do not zero-pad
        imgPath = `${prefix}-${p}.jpg`;
      }

      const imgBuffer = await fs.readFile(imgPath);
      const size = readJpegSize(imgBuffer) ?? { width: 0, height: 0 };

      // Extract text for this page
      let text = "";
      try {
        const { stdout } = await execFileAsync("pdftotext", [
          "-f",
          String(p),
          "-l",
          String(p),
          "-enc",
          "UTF-8",
          pdfPath,
          "-",
        ]);
        text = stdout.replace(/\r/g, "").trim();
      } catch (e) {
        logger.warn({ err: e, page: p }, "Per-page text extraction failed");
      }

      // If the page has little or no text, it is likely a scanned image —
      // run Tesseract OCR on the rendered JPEG to recover the text.
      const MIN_TEXT_CHARS = 100;
      let pageOcrUsed = false;
      if (text.length < MIN_TEXT_CHARS) {
        try {
          const { stdout: ocrOut } = await execFileAsync(
            "tesseract",
            [imgPath, "stdout", "-l", "eng", "--psm", "1"],
            { maxBuffer: 1024 * 1024 * 8 },
          );
          const ocrText = sanitizeOcrText(ocrOut.replace(/\r/g, "").trim());
          if (ocrText.length > text.length) {
            logger.info({ page: p, chars: ocrText.length }, "OCR text used for page");
            text = ocrText;
            pageOcrUsed = true;
            anyOcrUsed = true;
          }
        } catch (e) {
          logger.warn({ err: e, page: p }, "OCR fallback failed");
        }
      }

      const objectPath = await objectStorage.uploadBuffer(
        `pdf-pages/${bookId}/${padded}.jpg`,
        imgBuffer,
        "image/jpeg",
      );

      pages.push({
        pageNumber: p,
        imageUrl: objectPath,
        width: size.width,
        height: size.height,
        text,
        ocrUsed: pageOcrUsed,
        lowConfidence: computePageConfidence(text),
      });
    }

    const rawName = originalname.replace(/\.[^.]+$/, "");
    const suggestedTitle = rawName.replace(/[-_]/g, " ").replace(/\s{2,}/g, " ").trim();

    const expiresAt = new Date(Date.now() + PDF_PAGES_TTL_MS).toISOString();

    res.json({ bookId, suggestedTitle, pageCount, pages, ocrUsed: anyOcrUsed, expiresAt });
  } catch (err) {
    logger.error({ err, filename: originalname }, "PDF render failed");
    // Best-effort cleanup: delete any page images that were already uploaded
    // before the error occurred so they do not linger in storage indefinitely.
    objectStorage.deletePdfPages(bookId).catch((cleanupErr) => {
      logger.warn({ err: cleanupErr, bookId }, "Partial-import cleanup failed");
    });
    res.status(500).json({ error: "Failed to render PDF pages." });
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
});

// DELETE /pdf/pages/:bookId — remove all rendered page images for a book
router.delete("/pdf/pages/:bookId", async (req, res) => {
  const { bookId } = req.params;
  // Validate: must be a UUID (36 chars, hex + dashes)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookId)) {
    res.status(400).json({ error: "Invalid bookId" });
    return;
  }
  try {
    await objectStorage.deletePdfPages(bookId);
    logger.info({ bookId }, "Deleted PDF page images");
    res.status(204).end();
  } catch (err) {
    logger.error({ err, bookId }, "Failed to delete PDF page images");
    res.status(500).json({ error: "Failed to delete PDF page images." });
  }
});

export default router;
