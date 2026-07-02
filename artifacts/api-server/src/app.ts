import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        // Strip the query string, then scrub identifiers that ride in the path
        // so no bearer token or patient identifier ever lands in logs: consent /
        // withdrawal tokens are redacted, and numeric patient-scoped ids in the
        // professional and care paths are replaced with a placeholder.
        const path = (req.url?.split("?")[0] ?? "")
          .replace(/(\/api\/consent\/withdraw\/)[^/]+/, "$1[redacted]")
          .replace(/(\/api\/consent\/)[^/]+/, "$1[redacted]")
          .replace(/(\/api\/appointments\/)[^/]+/, "$1[redacted]")
          .replace(/(\/api\/professional\/(?:patients|intakes|referrals)\/)\d+/, "$1[id]")
          .replace(/(\/api\/care\/connections\/)\d+/, "$1[id]");
        return {
          id: req.id,
          method: req.method,
          url: path,
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Resolve the publishable key from the incoming request host so the same
// server can serve multiple Clerk custom domains. Falls back to
// CLERK_PUBLISHABLE_KEY when the host doesn't map to a custom domain.
//
// getClerkProxyHost is shared with clerkProxyMiddleware so that both
// halves of the auth setup agree on which hostname is canonical.
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

// Centralized error handler. Express 5 forwards rejected promises from async
// route handlers here. Without this, thrown errors return an opaque 500 with no
// log detail, making failures (e.g. a failed journal save) invisible.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const e = err as { name?: string; message?: string; issues?: unknown };
  req.log.error({ err }, "unhandled route error");
  if (res.headersSent) {
    return;
  }
  if (e?.name === "ZodError") {
    res.status(400).json({ error: "Invalid request", issues: e.issues });
    return;
  }
  res.status(500).json({ error: "Something went wrong" });
});

export default app;
