import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetProfile } from "@workspace/api-client-react";
import { useClerk } from "@clerk/react";
import { Loader2, HeartHandshake, LogOut, Home } from "lucide-react";
import { motion } from "framer-motion";
import { Logo } from "@/components/logo";
import { PortalSwitcher } from "@/components/portal-switcher";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: profile, isLoading } = useGetProfile();
  const { signOut } = useClerk();

  useEffect(() => {
    if (!isLoading && profile) {
      const publicRoutes = new Set(["/", "/notify", "/present", "/pricing", "/caregiver"]);
      if (
        !profile.onboardingComplete &&
        location !== "/onboarding" &&
        location !== "/crisis" &&
        !publicRoutes.has(location)
      ) {
        setLocation("/onboarding");
      }
    }
  }, [profile, isLoading, location, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Hide nav on onboarding
  if (location === "/onboarding") {
    return <>{children}</>;
  }

  const isActive = (path: string) =>
    path === "/app" ? location === "/app" : location.startsWith(path);
  const navLinkCls = (path: string) =>
    `transition-colors ${isActive(path) ? "text-foreground" : "hover:text-foreground"}`;
  const mobileLinkCls = (path: string) =>
    `flex flex-col items-center gap-1 transition-opacity ${
      isActive(path) ? "opacity-100 text-foreground" : "opacity-70 hover:opacity-100"
    }`;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col font-sans text-foreground selection:bg-primary/20">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border/40">
        <div className="container max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/app" aria-label="Return to home" title="Return to home">
            <div className="cursor-pointer opacity-90 hover:opacity-100 transition-opacity">
              <Logo variant="lockup" size={36} />
            </div>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/app" className={navLinkCls("/app")}>Home</Link>
            <Link href="/companion" className={navLinkCls("/companion")}>Companion</Link>
            <Link href="/journal" className={navLinkCls("/journal")}>Journal</Link>
            <Link href="/practices" className={navLinkCls("/practices")}>Practices</Link>
            <Link href="/reflections" className={navLinkCls("/reflections")}>Reflections</Link>
            <Link href="/dashboard" className={navLinkCls("/dashboard")}>Insights</Link>
            <Link href="/loved-one" className={navLinkCls("/loved-one")}>Loved One</Link>
          </nav>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              <PortalSwitcher current="seeker" />
            </div>
            <Link href="/crisis" className="flex items-center gap-1.5 text-xs text-destructive opacity-80 hover:opacity-100 transition-opacity">
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>Crisis Support</span>
            </Link>
            <Link href="/settings" className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center text-secondary-foreground hover:bg-secondary transition-colors cursor-pointer text-xs font-medium">
              {profile?.name ? profile.name.charAt(0).toUpperCase() : "U"}
            </Link>
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              aria-label="Sign out"
              title="Sign out"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border flex items-center justify-around p-3 text-xs text-muted-foreground pb-safe">
        <Link href="/app" className={mobileLinkCls("/app")}>
          <Home className="w-4 h-4" />
          <span className="font-serif">Home</span>
        </Link>
        <Link href="/companion" className={mobileLinkCls("/companion")}><span className="font-serif">Chat</span></Link>
        <Link href="/journal" className={mobileLinkCls("/journal")}><span className="font-serif">Journal</span></Link>
        <Link href="/practices" className={mobileLinkCls("/practices")}><span className="font-serif">Practices</span></Link>
        <Link href="/dashboard" className={mobileLinkCls("/dashboard")}><span className="font-serif">Insights</span></Link>
      </div>

      <main className="flex-1 container max-w-4xl mx-auto px-4 py-8 md:py-12 pb-24 md:pb-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
