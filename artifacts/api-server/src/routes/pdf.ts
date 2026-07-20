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
 * Light post-processing for OCR-sourced text.
 * Removes common noise without touching normal extracted text.
 */
export function sanitizeOcrText(raw: string): string {
  return raw
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
    .trim();
}

const MAX_PAGES = 150;
const RENDER_DPI = 150;

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
}

router.post("/render-pdf", upload.single("file"), async (req, res) => {
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
      });
    }

    const rawName = originalname.replace(/\.[^.]+$/, "");
    const suggestedTitle = rawName.replace(/[-_]/g, " ").replace(/\s{2,}/g, " ").trim();

    // expiresAt gives clients a hint for when orphaned page images may be
    // lazily cleaned up (2 h after upload). Pages should be promoted to a
    // saved book before this time, or explicitly deleted by the client.
    const PDF_PAGES_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
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
