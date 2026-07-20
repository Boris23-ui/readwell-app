import { Router } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router = Router();
const objectStorage = new ObjectStorageService();

// Serve stored objects (PDF page images) publicly. These are non-sensitive
// rendered page images referenced by stable URLs, so no auth/ACL gate is applied.
router.get("/storage/objects/*splat", async (req, res) => {
  const splat = (req.params as any).splat;
  const rest = Array.isArray(splat) ? splat.join("/") : splat;
  const objectPath = `/objects/${rest}`;
  try {
    const file = await objectStorage.getObjectEntityFile(objectPath);
    const response = await objectStorage.downloadObject(file, 31536000);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const reader = response.body.getReader();
      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(Buffer.from(value));
        await pump();
      };
      await pump();
    } else {
      res.end();
    }
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    logger.error({ err, objectPath }, "Failed to serve object");
    if (!res.headersSent) res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
