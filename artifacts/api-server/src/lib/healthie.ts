import { logger } from "./logger";

/**
 * Healthie GraphQL transport (server-side only).
 *
 * Healthie is the HIPAA system of record for all clinical data. The API key is
 * a privileged credential and MUST stay on the server — the browser never talks
 * to Healthie directly. Every route that needs Healthie data owns a fixed,
 * validated query and calls through here, so the browser can only trigger the
 * specific operations we expose, never arbitrary GraphQL.
 *
 * Logging policy (see docs/PHI-BOUNDARY.md): never log query variables or
 * response bodies — they can carry PHI. Only non-PHI failure metadata (status,
 * error class) is logged.
 */

const DEFAULT_HEALTHIE_URL = "https://staging-api.gethealthie.com/graphql";

export function healthieConfigured(): boolean {
  return !!process.env.HEALTHIE_API_KEY;
}

/** The GraphQL endpoint — sandbox by default, overridable via env. */
export function healthieEndpoint(): string {
  return process.env.HEALTHIE_API_URL?.trim() || DEFAULT_HEALTHIE_URL;
}

/** Thrown when no Healthie API key is configured. Surfaced as a 503. */
export class HealthieNotConfiguredError extends Error {
  constructor() {
    super("Healthie is not configured");
    this.name = "HealthieNotConfiguredError";
  }
}

/** Thrown for transport/GraphQL failures. Message is safe to show inline. */
export class HealthieError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HealthieError";
  }
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

/**
 * Execute a Healthie GraphQL operation with the server-held API key.
 * Auth follows Healthie's API convention: `Authorization: Basic <key>` plus
 * `AuthorizationSource: API`.
 */
export async function healthieGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const key = process.env.HEALTHIE_API_KEY;
  if (!key) {
    throw new HealthieNotConfiguredError();
  }

  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetch(healthieEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${key}`,
        AuthorizationSource: "API",
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "healthie request failed to send",
    );
    throw new HealthieError("Could not reach the scheduling service.");
  }

  if (!res.ok) {
    // Status only — a non-2xx body may echo request data (PHI).
    logger.error({ status: res.status }, "healthie returned a non-2xx status");
    throw new HealthieError("The scheduling service returned an error.");
  }

  let body: GraphQLResponse<T>;
  try {
    body = (await res.json()) as GraphQLResponse<T>;
  } catch {
    throw new HealthieError("The scheduling service returned an invalid response.");
  }

  if (body.errors && body.errors.length > 0) {
    // Count only — GraphQL error text can restate submitted variables (PHI).
    logger.error({ errorCount: body.errors.length }, "healthie graphql errors");
    throw new HealthieError("The scheduling request could not be completed.");
  }

  if (!body.data) {
    throw new HealthieError("The scheduling service returned no data.");
  }

  return body.data;
}
