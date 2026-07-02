import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Search, MapPin, Video, Loader2 } from "lucide-react";
import { api, ErrorBanner, PhiNotice, ApiError, useTwoFactorGate, type DirectoryEntry } from "./provider-shell";

export default function ProviderDirectory() {
  const { guard, challengeElement } = useTwoFactorGate();
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [state, setState] = useState("");
  const [telehealth, setTelehealth] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gateCode, setGateCode] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    setGateCode(null);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (specialty.trim()) params.set("specialty", specialty.trim());
    if (state.trim()) params.set("state", state.trim());
    if (telehealth) params.set("telehealth", "true");
    if (accepting) params.set("accepting", "true");
    try {
      setEntries(await guard(() => api<DirectoryEntry[]>(`/professional/directory?${params.toString()}`)));
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setGateCode(e.code);
      } else {
        setError(e instanceof Error ? e.message : "Could not load the directory");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (gateCode) {
    return (
      <>
        {challengeElement}
        <PhiNotice code={gateCode} onChallenge={() => load()} />
      </>
    );
  }

  return (
    <div className="space-y-8">
      {challengeElement}
      <div className="space-y-2">
        <h1 className="font-serif text-3xl">Colleague directory</h1>
        <p className="text-muted-foreground">Verified grief-care professionals who have chosen to be listed.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="rounded-xl border border-border bg-card p-5 space-y-4"
      >
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, practice, or focus"
            className="input pl-9"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Specialty" className="input" />
          <input
            value={state}
            onChange={(e) => setState(e.target.value.toUpperCase())}
            placeholder="State (e.g. TN)"
            maxLength={2}
            className="input"
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={telehealth} onChange={(e) => setTelehealth(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
            Offers telehealth
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={accepting} onChange={(e) => setAccepting(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
            Accepting referrals
          </label>
          <button type="submit" className="btn-primary ml-auto">
            Search
          </button>
        </div>
      </form>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No colleagues match your search yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {entries.map((e) => (
            <div key={e.userId} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-serif text-lg">{e.fullName || "Grief-care professional"}</p>
                  {e.credential && <p className="text-sm text-muted-foreground">{e.credential}</p>}
                </div>
                {e.acceptingReferrals && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary whitespace-nowrap">
                    Accepting
                  </span>
                )}
              </div>
              {e.practiceName && <p className="text-sm text-foreground/80">{e.practiceName}</p>}
              {e.bio && <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{e.bio}</p>}
              <div className="flex flex-wrap gap-1.5">
                {e.specialtyTags.map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {e.statesLicensed.length > 0 && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {e.statesLicensed.join(", ")}
                  </span>
                )}
                {e.telehealth && (
                  <span className="flex items-center gap-1">
                    <Video className="w-3.5 h-3.5" /> Telehealth
                  </span>
                )}
              </div>
              <Link href={`/care/referrals?to=${e.userId}`} className="text-sm text-primary hover:underline">
                Refer a client
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
