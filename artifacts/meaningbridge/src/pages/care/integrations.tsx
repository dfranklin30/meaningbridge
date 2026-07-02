import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import {
  Cable,
  FileSpreadsheet,
  Clock,
  Check,
  Loader2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import {
  api,
  ApiError,
  Spinner,
  ErrorBanner,
  PhiNotice,
  useTwoFactorGate,
} from "./provider-shell";

type Kind = "fhir" | "csv_preset" | "vendor_api";

interface ConnectionView {
  id: number;
  system: string;
  kind: string;
  status: "connected" | "disconnected" | "pending";
  scopes: string | null;
  fhirBaseUrl: string | null;
  connectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CatalogSystem {
  id: string;
  label: string;
  kind: Kind;
  fhirConfigured: boolean;
  connection: ConnectionView | null;
}

const RETURN_MESSAGES: Record<string, string> = {
  access_denied: "The connection was cancelled at the EHR. Nothing was changed.",
  invalid_callback: "We could not complete that connection. Please try again.",
  state_expired: "That connection attempt expired. Please start it again.",
  configuration_required: "This EHR is not yet configured for a live connection.",
  discovery_unreachable: "We could not reach the EHR. Please try again shortly.",
  discovery_failed: "The EHR did not return a usable configuration.",
  discovery_incomplete: "The EHR did not return a usable configuration.",
  token_exchange_failed: "The EHR declined the connection. Please try again.",
  connect_failed: "Something went wrong finishing the connection. Please try again.",
};

export default function ProviderIntegrations() {
  const { guard, challengeElement } = useTwoFactorGate();
  const search = useSearch();

  const [loading, setLoading] = useState(true);
  const [phiCode, setPhiCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [systems, setSystems] = useState<CatalogSystem[]>([]);
  const [busySystem, setBusySystem] = useState<string | null>(null);

  const params = new URLSearchParams(search);
  const connectedSystem = params.get("connected");
  const returnError = params.get("error");

  const load = useCallback(async () => {
    setLoading(true);
    setPhiCode(null);
    setError(null);
    try {
      const res = await guard(() =>
        api<{ systems: CatalogSystem[] }>("/professional/integrations/catalog"),
      );
      setSystems(res.systems);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.code) setPhiCode(err.code);
      else if (!(err instanceof ApiError && err.code === "two_factor_challenge_required"))
        setError(err instanceof Error ? err.message : "We could not open integrations.");
    } finally {
      setLoading(false);
    }
  }, [guard]);

  useEffect(() => {
    void load();
  }, [load]);

  async function connectFhir(system: string) {
    setError(null);
    setBusySystem(system);
    try {
      const res = await guard(() =>
        api<{ authorizeUrl: string }>(`/professional/integrations/fhir/${system}/authorize`, {
          method: "POST",
        }),
      );
      // Top-level navigation to the EHR's authorization screen.
      window.location.href = res.authorizeUrl;
    } catch (err) {
      setBusySystem(null);
      if (!(err instanceof ApiError && err.code === "two_factor_challenge_required"))
        setError(err instanceof Error ? err.message : "We could not start that connection.");
    }
  }

  async function requestAccess(system: string) {
    setError(null);
    setBusySystem(system);
    try {
      await guard(() =>
        api(`/professional/integrations/${system}/request-access`, { method: "POST" }),
      );
      await load();
    } catch (err) {
      if (!(err instanceof ApiError && err.code === "two_factor_challenge_required"))
        setError(err instanceof Error ? err.message : "We could not record that request.");
    } finally {
      setBusySystem(null);
    }
  }

  async function disconnect(connectionId: number, system: string) {
    setError(null);
    setBusySystem(system);
    try {
      await guard(() =>
        api(`/professional/integrations/${connectionId}`, { method: "DELETE" }),
      );
      await load();
    } catch (err) {
      if (!(err instanceof ApiError && err.code === "two_factor_challenge_required"))
        setError(err instanceof Error ? err.message : "We could not disconnect that system.");
    } finally {
      setBusySystem(null);
    }
  }

  if (loading) return <Spinner />;
  if (phiCode) return <PhiNotice code={phiCode} onChallenge={() => window.location.reload()} />;

  const fhir = systems.filter((s) => s.kind === "fhir");
  const csv = systems.filter((s) => s.kind === "csv_preset");
  const vendor = systems.filter((s) => s.kind === "vendor_api");

  const connectedLabel = connectedSystem
    ? systems.find((s) => s.id === connectedSystem)?.label ?? connectedSystem
    : null;

  return (
    <div className="space-y-10">
      {challengeElement}

      <div className="space-y-1">
        <h1 className="font-serif text-3xl">Integrations</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Connect the systems where your clients already live. A live connection reads only what is
          needed to begin an intake; nothing is ever written back to your records.
        </p>
      </div>

      {connectedLabel && (
        <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          {connectedLabel} is connected.
        </div>
      )}
      {returnError && <ErrorBanner message={RETURN_MESSAGES[returnError] ?? "That connection did not complete."} />}
      {error && <ErrorBanner message={error} />}

      <Section
        icon={<Cable className="h-4 w-4" />}
        title="Connect an EHR"
        blurb="A live, read-only connection over the healthcare standard (SMART on FHIR). Sign in at your EHR, choose a client, and their details begin a draft intake for your review."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {fhir.map((s) => (
            <FhirCard
              key={s.id}
              system={s}
              busy={busySystem === s.id}
              onConnect={() => void connectFhir(s.id)}
              onDisconnect={(id) => void disconnect(id, s.id)}
            />
          ))}
        </div>
      </Section>

      <Section
        icon={<FileSpreadsheet className="h-4 w-4" />}
        title="Export presets"
        blurb="No live connection needed. Export your client list from one of these systems and we will recognise its columns automatically in bulk enrollment."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {csv.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-border bg-card p-5 flex items-center justify-between gap-3"
            >
              <div>
                <p className="font-medium">{s.label}</p>
                <p className="text-xs text-muted-foreground">Export preset for bulk enrollment</p>
              </div>
              <Link
                href={`/care/import?preset=${s.id}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:border-foreground transition-colors whitespace-nowrap"
              >
                Use preset <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </Section>

      <Section
        icon={<Clock className="h-4 w-4" />}
        title="Partner systems"
        blurb="These systems connect through a partner agreement rather than a self-serve login. Register your interest and we will reach out to enable access."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {vendor.map((s) => {
            const pending = s.connection?.status === "pending";
            return (
              <div
                key={s.id}
                className="rounded-xl border border-border bg-card p-5 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {pending ? "Access requested" : "Partner API"}
                  </p>
                </div>
                {pending ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Check className="h-3.5 w-3.5" /> Requested
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busySystem === s.id}
                    onClick={() => void requestAccess(s.id)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:border-foreground transition-colors whitespace-nowrap disabled:opacity-60"
                  >
                    {busySystem === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Request access
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  blurb,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-primary">
          {icon}
        </div>
        <div className="space-y-1">
          <h2 className="font-serif text-xl">{title}</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">{blurb}</p>
        </div>
      </div>
      <div className="pl-12">{children}</div>
    </section>
  );
}

function FhirCard({
  system,
  busy,
  onConnect,
  onDisconnect,
}: {
  system: CatalogSystem;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: (id: number) => void;
}) {
  const conn = system.connection;
  const connected = conn?.status === "connected";

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{system.label}</p>
          {connected ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Connected
              {conn?.connectedAt
                ? ` · ${new Date(conn.connectedAt).toLocaleDateString()}`
                : ""}
            </p>
          ) : system.fhirConfigured ? (
            <p className="text-xs text-muted-foreground">Live connection available</p>
          ) : (
            <p className="text-xs text-muted-foreground">Configuration required</p>
          )}
        </div>
      </div>

      {connected && conn?.scopes && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Access: {formatScopes(conn.scopes)}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        {system.fhirConfigured ? (
          <button
            type="button"
            disabled={busy}
            onClick={onConnect}
            className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {connected ? "Import a client" : "Connect"}
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">
            An administrator must register MeaningBridge with this EHR to enable a live connection.
          </span>
        )}
        {connected && conn && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onDisconnect(conn.id)}
            className="rounded-md border border-border px-3 py-2 text-sm hover:border-foreground transition-colors disabled:opacity-60"
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}

/** Turn raw OAuth scopes into a short, human phrase. Read-only by design. */
function formatScopes(scopes: string): string {
  const parts: string[] = [];
  if (/patient\/Patient\.(read|rs|\*)/.test(scopes)) parts.push("demographics");
  if (/patient\/Condition\.(read|rs|\*)/.test(scopes)) parts.push("conditions");
  if (/patient\/MedicationRequest\.(read|rs|\*)/.test(scopes)) parts.push("medications");
  return parts.length ? `read-only ${parts.join(", ")}` : "read-only";
}
