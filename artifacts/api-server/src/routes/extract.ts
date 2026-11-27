import { Router } from "express";
import multer from "multer";
import { logger } from "../lib/logger";
import { aiGateway } from "../lib/aiGateway";

const router = Router();

export function renderPageWithParagraphs(pageData: any): Promise<string> {
  return pageData
    .getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
    .then((textContent: any) => {
      let lastY: number | null = null;
      let lastEndX: number | null = null;
      let lastHeight = 12;
      let prevLineStartX: number | null = null;
      let currentLineStartX: number | null = null;
      const items: Array<{ str: string; x: number; y: number; w: number; h: number }> = [];

      for (const item of textContent.items || []) {
        const str = typeof item.str === "string" ? item.str : "";
        if (!str) continue;
        const x = Array.isArray(item.transform) ? Number(item.transform[4]) || 0 : 0;
        const y = Array.isArray(item.transform) ? Number(item.transform[5]) || 0 : 0;
        const w = Number(item.width) || 0;
        const h = Number(item.height) || Math.abs(Number(item.transform?.[3])) || 12;
        items.push({ str, x, y, w, h });
      }

      let pageText = "";
      for (const item of items) {
        if (lastY === null) {
          pageText += item.str;
          currentLineStartX = item.x;
        } else {
          const dy = Math.abs(item.y - lastY);
          const refHeight = Math.max(8, Math.min(24, (lastHeight + item.h) / 2));
          if (dy < 2) {
            // Same line: only insert a space if there is an actual horizontal word gap
            // so kerned glyph fragments of the same word ("Pro" + "positional") stay joined.
            const hasHorizontalWordGap =
              lastEndX !== null && item.x - lastEndX > Math.max(1.5, refHeight * 0.16);
            const needsSpace =
              hasHorizontalWordGap &&
              pageText.length > 0 &&
              !/\s$/.test(pageText) &&
              !/^\s/.test(item.str);
            pageText += (needsSpace ? " " : "") + item.str;
          } else {
            prevLineStartX = currentLineStartX;
            currentLineStartX = item.x;
            const isIndentedNewParagraph =
              prevLineStartX !== null &&
              item.x - prevLineStartX >= 10 &&
              item.x - prevLineStartX <= 60 &&
              /[.!?:"”’)]$/.test(pageText.trimEnd());

            if (dy > refHeight * 1.48 || isIndentedNewParagraph) {
              // Paragraph break (larger vertical gap or indented line after sentence end)
              pageText += "\n\n" + item.str;
            } else {
              // Normal line wrap within a paragraph
              pageText += "\n" + item.str;
            }
          }
        }
        lastY = item.y;
        lastHeight = item.h;
        lastEndX = item.w > 0 ? item.x + item.w : null;
      }
      return pageText + "\n\n";
    });
}

// Keep files in memory (no disk I/O needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter(_req, file, cb) {
    const allowed = ["application/pdf", "text/plain", "text/markdown", "text/html", "image/png", "image/jpeg", "image/jpg", "image/webp"];
    const extOk = /\.(pdf|txt|md|markdown|html|htm|png|jpg|jpeg|webp)$/i.test(file.originalname);
    if (allowed.includes(file.mimetype) || extOk) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

router.post("/extract-text", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const { originalname, mimetype, buffer } = req.file;
  logger.info({ filename: originalname, mimetype, size: buffer.length }, "Extracting text from file");

  try {
    let text = "";

    if (mimetype === "application/pdf" || originalname.toLowerCase().endsWith(".pdf")) {
      // Dynamically import pdf-parse (CJS module, avoids ESM issues)
      const pdfParse = (await import("pdf-parse")).default;

      try {
        const data = await pdfParse(buffer, { pagerender: renderPageWithParagraphs });
        text = data.text;
      } catch {
        const fallbackData = await pdfParse(buffer);
        text = fallbackData.text;
      }
    } else if (mimetype === "text/html" || /\.(html|htm)$/i.test(originalname)) {
      const rawHtml = buffer.toString("utf-8");
      // Strip script and style blocks
      const withoutScripts = rawHtml
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, "");
      // Convert block elements to newlines
      const withBlockSpacing = withoutScripts
        .replace(/<\/(p|div|h[1-6]|li|article|section|blockquote)>/gi, "\n\n")
        .replace(/<br\s*\/?>/gi, "\n");
      // Strip all remaining tags
      const stripped = withBlockSpacing.replace(/<[^>]+>/g, "");
      // Decode basic HTML entities
      text = stripped
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    } else if (mimetype.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(originalname)) {
      const base64Data = buffer.toString("base64");
      const aiResponse = await aiGateway.generate({
        purpose: 'comprehension', // repurposing for general text extraction
        priority: 'standard',
        prompt: 'Extract all the text from this image exactly as it is written. Only return the text, no other comments.',
        systemInstruction: 'You are an OCR expert. Extract the text perfectly from the image.',
        maxOutputTokens: 2048,
        image: {
          mimeType: mimetype,
          data: base64Data
        },
        fallbackFn: () => { throw new Error('Cannot extract text from image without AI'); }
      });
      text = aiResponse.text;
    } else {
      // Plain text / markdown — decode directly
      text = buffer.toString("utf-8");
    }

    // Clean up the extracted text
    text = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]{3,}/g, "  ")  // collapse excessive spaces/tabs
      .replace(/\n{4,}/g, "\n\n\n") // max 3 consecutive newlines
      .trim();

    if (text.length < 30) {
      res.status(422).json({ error: "Could not extract readable text from this file." });
      return;
    }

    // Derive a clean title from the filename (strip extension, replace separators)
    const rawName = originalname.replace(/\.[^.]+$/, "");
    const suggestedTitle = rawName.replace(/[-_]/g, " ").replace(/\s{2,}/g, " ").trim();

    res.json({ text, suggestedTitle, chars: text.length });
  } catch (err) {
    logger.error({ err, filename: originalname }, "Text extraction failed");
    res.status(500).json({ error: "Failed to extract text from file." });
  }
});

export default router;
