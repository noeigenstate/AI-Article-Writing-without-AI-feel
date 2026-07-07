import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import multer from "multer";
import healthRoutes from "./routes/health.routes.js";
import scoreRoutes from "./routes/score.routes.js";
import stylesRoutes from "./routes/styles.routes.js";
import articleRoutes from "./routes/article.routes.js";
import rewriteRoutes from "./routes/rewrite.routes.js";

/**
 * Build the Express application: middleware plus all feature routers.
 *
 * Kept separate from {@link ./index.ts} so it can be imported in tests without
 * binding a port.
 *
 * @returns A configured (but not yet listening) Express app.
 */
export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  app.use(healthRoutes);
  app.use(scoreRoutes);
  app.use(stylesRoutes);
  app.use(articleRoutes);
  app.use(rewriteRoutes);
  app.use(apiErrorHandler);

  return app;
}

function apiErrorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Uploaded file is too large. Each file must be 10 MB or smaller."
        : err.message;
    res.status(400).json({ error: message });
    return;
  }

  next(err);
}
