import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { QRCodeImage } from "@/components/qr-code";

export default function PresentPage() {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const notifyUrl = useMemo(() => (origin ? `${origin}/notify?src=qr` : ""), [origin]);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-8 py-12">
      <div className="text-center space-y-12 max-w-3xl">
        <h1 className="font-serif text-5xl md:text-6xl tracking-tight">MeaningBridge is coming.</h1>
        <p className="text-2xl md:text-3xl text-muted-foreground font-serif">
          Scan to get notified when MeaningBridge launches.
        </p>

        <div className="flex justify-center">
          {notifyUrl && (
            <div className="rounded-2xl bg-card border border-border p-6 md:p-10 shadow-sm">
              <QRCodeImage value={notifyUrl} size={520} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xl text-muted-foreground font-serif">
            Or visit
          </p>
          <p className="text-2xl md:text-3xl text-primary break-all">
            {notifyUrl}
          </p>
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
