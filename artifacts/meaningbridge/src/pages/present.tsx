import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { QRCodeImage } from "@/components/qr-code";
import { Logo } from "@/components/logo";

export default function PresentPage() {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const notifyUrl = useMemo(() => (origin ? `${origin}/notify?src=qr` : ""), [origin]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-8 py-12 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1200px 700px at 50% -10%, hsl(180 50% 90% / 0.5), transparent 60%), radial-gradient(1000px 600px at 50% 110%, hsl(215 60% 85% / 0.3), transparent 60%), hsl(36 40% 98%)",
        }}
      />

      <div className="text-center space-y-10 max-w-3xl">
        <Logo size={72} className="mx-auto" />

        <h1 className="font-serif text-5xl md:text-6xl tracking-tight">
          MeaningBridge <span className="text-primary">is coming.</span>
        </h1>
        <p className="text-2xl md:text-3xl text-muted-foreground font-serif">
          Scan to get notified when MeaningBridge launches.
        </p>

        <div className="flex justify-center">
          {notifyUrl && (
            <div className="rounded-3xl bg-card border border-border p-8 md:p-12 shadow-[0_30px_80px_-20px_hsl(215_50%_30%/0.2)]">
              <QRCodeImage value={notifyUrl} size={520} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xl text-muted-foreground font-serif">Or visit</p>
          <p className="text-2xl md:text-3xl text-primary break-all">{notifyUrl}</p>
        </div>

        <div className="pt-8 space-y-1 text-muted-foreground">
          <p className="text-base">Brought to you by Dr. Robert Neimeyer.</p>
          <p className="text-sm">
            Portland Institute for Loss and Transition — portlandinstitute.org
          </p>
        </div>
      </div>

      <Link
        href="/"
        className="fixed top-4 right-4 text-xs text-muted-foreground/60 hover:text-muted-foreground"
      >
        Exit present mode
      </Link>
    </div>
  );
}
