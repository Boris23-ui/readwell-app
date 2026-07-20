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

const MAX_PAGES = 80;
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
      });
    }

    const rawName = originalname.replace(/\.[^.]+$/, "");
    const suggestedTitle = rawName.replace(/[-_]/g, " ").replace(/\s{2,}/g, " ").trim();

    res.json({ bookId, suggestedTitle, pageCount, pages });
  } catch (err) {
    logger.error({ err, filename: originalname }, "PDF render failed");
    res.status(500).json({ error: "Failed to render PDF pages." });
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
});

export default router;
