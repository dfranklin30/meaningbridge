import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetProfile } from "@workspace/api-client-react";
import { Loader2, HeartHandshake } from "lucide-react";
import { motion } from "framer-motion";
import { Logo } from "@/components/logo";

export function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: profile, isLoading } = useGetProfile();

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

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col font-sans text-foreground selection:bg-primary/20">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border/40">
        <div className="container max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/app">
            <div className="cursor-pointer opacity-90 hover:opacity-100 transition-opacity">
              <Logo variant="lockup" size={36} />
            </div>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/companion" className="hover:text-foreground transition-colors">Companion</Link>
            <Link href="/journal" className="hover:text-foreground transition-colors">Journal</Link>
            <Link href="/practices" className="hover:text-foreground transition-colors">Practices</Link>
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Insights</Link>
            <Link href="/loved-one" className="hover:text-foreground transition-colors">Loved One</Link>
          </nav>
          
          <div className="flex items-center gap-4">
            <Link href="/crisis" className="flex items-center gap-1.5 text-xs text-destructive opacity-80 hover:opacity-100 transition-opacity">
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>Crisis Support</span>
            </Link>
            <Link href="/settings" className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center text-secondary-foreground hover:bg-secondary transition-colors cursor-pointer text-xs font-medium">
              {profile?.name ? profile.name.charAt(0).toUpperCase() : "U"}
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border flex items-center justify-around p-3 text-xs text-muted-foreground pb-safe">
        <Link href="/companion" className="flex flex-col items-center gap-1 opacity-70 hover:opacity-100"><span className="font-serif">Chat</span></Link>
        <Link href="/journal" className="flex flex-col items-center gap-1 opacity-70 hover:opacity-100"><span className="font-serif">Journal</span></Link>
        <Link href="/practices" className="flex flex-col items-center gap-1 opacity-70 hover:opacity-100"><span className="font-serif">Practices</span></Link>
        <Link href="/dashboard" className="flex flex-col items-center gap-1 opacity-70 hover:opacity-100"><span className="font-serif">Insights</span></Link>
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
