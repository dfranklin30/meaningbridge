import type { Request } from "express";

/**
 * Best-effort public origin (scheme + host) for the current request, honoring a
 * single upstream proxy hop. Used to build absolute, user-facing links (e.g. the
 * patient consent invite) that work on both the dev preview and the deployed
 * domain without hard-coding a host.
 */
export function appOrigin(req: Request): string {
  const proto =
    (typeof req.headers["x-forwarded-proto"] === "string"
      ? req.headers["x-forwarded-proto"].split(",")[0]!.trim()
      : undefined) ?? req.protocol;
  const host =
    (typeof req.headers["x-forwarded-host"] === "string"
      ? req.headers["x-forwarded-host"].split(",")[0]!.trim()
      : undefined) ?? req.headers.host;
  return `${proto}://${host}`;
}
