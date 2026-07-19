import express, { type Express } from "express";
import fs from "fs";
import path from "path";

/**
 * Serve the built web app (copied to dist/public at Docker build time) and
 * fall back to index.html for client-side routes. API and storage routes are
 * mounted before this, so anything reaching the fallback is a page navigation.
 */
export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `Could not find the build directory: ${distPath}; build the client first`,
      );
    }
    console.warn(`[static] ${distPath} not found — skipping static serving (dev mode)`);
    return;
  }

  app.use(express.static(distPath));

  app.use("/{*path}", (req, res, next) => {
    // Never swallow API traffic — unknown /api paths should 404 as JSON.
    if (req.originalUrl.startsWith("/api")) return next();
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
