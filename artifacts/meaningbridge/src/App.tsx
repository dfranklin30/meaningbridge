import { useEffect, useRef } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  Show,
  useClerk,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import {
  Switch,
  Route,
  Redirect,
  useLocation,
  Router as WouterRouter,
} from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";

import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";

import Landing from "@/pages/landing";
import NotifyPage from "@/pages/notify";
import PresentPage from "@/pages/present";
import Pricing from "@/pages/pricing";
import Caregiver from "@/pages/caregiver";
import Sandbox from "@/pages/sandbox";
import SelectRole from "@/pages/select-role";

import Home from "@/pages/home";
import Onboarding from "@/pages/onboarding";
import CheckIn from "@/pages/checkin";
import Dashboard from "@/pages/dashboard";
import CompanionList from "@/pages/companion/index";
import CompanionSession from "@/pages/companion/session";
import JournalList from "@/pages/journal/index";
import JournalEditor from "@/pages/journal/editor";
import PracticesList from "@/pages/practices/index";
import PracticePlayer from "@/pages/practices/player";
import PracticeEditor from "@/pages/practices/editor";
import LovedOne from "@/pages/loved-one";
import Therapists from "@/pages/therapists";
import Crisis from "@/pages/crisis";
import Settings from "@/pages/settings";
import CareInvite from "@/pages/care/invite";
import ConnectClinician from "@/pages/care/connect";
import ProviderAccount from "@/pages/care/account";
import ProviderOnboarding from "@/pages/care/onboarding";
import ProviderSecurity from "@/pages/care/security";
import ProviderDirectory from "@/pages/care/directory";
import ProviderReferrals from "@/pages/care/referrals";
import ProviderPatients from "@/pages/care/patients";
import ProviderIntake from "@/pages/care/intake";
import ProviderImport from "@/pages/care/import";
import ProviderIntegrations from "@/pages/care/integrations";
import AdminProviders from "@/pages/admin/providers";
import { ProviderShell, type Me } from "@/pages/care/provider-shell";
import ConsentPage from "@/pages/consent";
import NotFound from "@/pages/not-found";

// REQUIRED — copy verbatim. Resolves the key from window.location.hostname so the
// same build serves multiple Clerk custom domains.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev, auto-set in prod. Do NOT gate on PROD.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Clerk passes full paths to routerPush/routerReplace, but wouter's setLocation
// prepends the base — strip it to avoid doubling.
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.png`,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "hsl(180 38% 36%)",
    colorForeground: "hsl(215 38% 18%)",
    colorMutedForeground: "hsl(215 14% 42%)",
    colorDanger: "hsl(0 55% 50%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(0 0% 100%)",
    colorInputForeground: "hsl(215 38% 18%)",
    colorNeutral: "hsl(215 38% 18%)",
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-sm border border-border/60",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "font-serif text-2xl tracking-tight text-foreground",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground font-medium",
    formFieldLabel: "text-foreground",
    footerActionLink: "text-primary hover:text-primary/80 font-medium",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    logoBox: "h-10 justify-center",
    logoImage: "h-10 w-auto object-contain",
    formButtonPrimary:
      "bg-primary text-primary-foreground hover:bg-primary/90 normal-case font-medium",
    formFieldInput: "bg-white border-border text-foreground",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function AccountErrorState() {
  const { signOut } = useClerk();
  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center px-4 font-sans text-foreground">
      <div className="max-w-sm text-center space-y-4">
        <p className="font-serif text-xl">We could not reach your account</p>
        <p className="text-sm text-muted-foreground">
          Something interrupted the connection. Please refresh, or sign out and
          back in.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full border border-border px-4 py-2 text-sm hover:border-foreground transition-colors"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => signOut({ redirectUrl: basePath || "/" })}
            className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm hover:bg-primary/90 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// Resolves the correct portal for a signed-in account based on chosen role.
function PortalRedirect() {
  const { data: me, isLoading, isError } = useGetMe();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (isError || !me) {
    return <AccountErrorState />;
  }

  if (!me.role) {
    return <Redirect to="/select-role" />;
  }

  if (me.role === "professional") {
    return <Redirect to="/care/account" />;
  }

  return <Redirect to="/app" />;
}

// "/" — landing for signed-out visitors, portal redirect for signed-in users.
function HomeRedirect() {
  return (
    <>
      <Show when="signed-out">
        <Landing />
      </Show>
      <Show when="signed-in">
        <PortalRedirect />
      </Show>
    </>
  );
}

function AppRoutes() {
  return (
    <Layout>
      <Switch>
        <Route path="/app" component={Home} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/checkin" component={CheckIn} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/companion" component={CompanionList} />
        <Route path="/companion/:sessionId" component={CompanionSession} />
        <Route path="/journal" component={JournalList} />
        <Route path="/journal/new" component={JournalEditor} />
        <Route path="/journal/:id" component={JournalEditor} />
        <Route path="/practices" component={PracticesList} />
        <Route path="/practices/new" component={PracticeEditor} />
        <Route path="/practices/:id/edit" component={PracticeEditor} />
        <Route path="/practices/:id" component={PracticePlayer} />
        <Route path="/loved-one" component={LovedOne} />
        <Route path="/therapists" component={Therapists} />
        <Route path="/care/connect" component={ConnectClinician} />
        <Route path="/crisis" component={Crisis} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

// Guards the seeker app: signed-out -> landing; role unset -> selection;
// professionals -> caregiver portal; seekers -> the app.
function SeekerAppGate() {
  const { data: me, isLoading, isError } = useGetMe();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (isError || !me) {
    return <AccountErrorState />;
  }

  if (!me.role) {
    return <Redirect to="/select-role" />;
  }

  if (me.role === "professional") {
    return <Redirect to="/care/account" />;
  }

  return <AppRoutes />;
}

// Signed-in clinician portal (accounts, verification, 2FA, directory, referrals,
// and the admin verification queue). Renders its own shell + routes.
function ProviderPortalRoutes() {
  const { data: me, isLoading, isError } = useGetMe();

  if (isLoading) {
    return <FullScreenLoader />;
  }
  if (isError || !me) {
    return <AccountErrorState />;
  }
  if (!me.role) {
    return <Redirect to="/select-role" />;
  }
  if (me.role !== "professional" && !me.isAdmin) {
    return <Redirect to="/app" />;
  }

  const shellMe: Me = {
    id: me.id,
    email: me.email ?? null,
    firstName: me.firstName ?? null,
    role: me.role,
    isAdmin: me.isAdmin,
  };

  return (
    <ProviderShell me={shellMe}>
      <Switch>
        <Route path="/care/account" component={ProviderAccount} />
        <Route path="/care/onboarding" component={ProviderOnboarding} />
        <Route path="/care/security" component={ProviderSecurity} />
        <Route path="/care/directory" component={ProviderDirectory} />
        <Route path="/care/referrals">{() => <ProviderReferrals me={shellMe} />}</Route>
        <Route path="/care/patients" component={ProviderPatients} />
        <Route path="/care/integrations" component={ProviderIntegrations} />
        <Route path="/care/import" component={ProviderImport} />
        <Route path="/care/intake" component={ProviderIntake} />
        <Route path="/care/intake/:id" component={ProviderIntake} />
        <Route path="/admin/providers" component={AdminProviders} />
        <Route path="/care/crisis" component={Crisis} />
        <Route>
          <Redirect to="/care/account" />
        </Route>
      </Switch>
    </ProviderShell>
  );
}

function ProfessionalPortalGate() {
  return (
    <>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
      <Show when="signed-in">
        <ProviderPortalRoutes />
      </Show>
    </>
  );
}

function AppGate() {
  return (
    <>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
      <Show when="signed-in">
        <SeekerAppGate />
      </Show>
    </>
  );
}

function SelectRoleGate() {
  return (
    <>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
      <Show when="signed-in">
        <SelectRole />
      </Show>
    </>
  );
}

// Invalidates the query cache when the signed-in user changes.
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function AppRouterSwitch() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/notify" component={NotifyPage} />
      <Route path="/present" component={PresentPage} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/caregiver" component={Caregiver} />
      <Route path="/consent/:token" component={ConsentPage} />
      <Route path="/sandbox" component={Sandbox} />
      <Route path="/care/invite" component={CareInvite} />
      <Route path="/care/account" component={ProfessionalPortalGate} />
      <Route path="/care/onboarding" component={ProfessionalPortalGate} />
      <Route path="/care/security" component={ProfessionalPortalGate} />
      <Route path="/care/directory" component={ProfessionalPortalGate} />
      <Route path="/care/referrals" component={ProfessionalPortalGate} />
      <Route path="/care/patients" component={ProfessionalPortalGate} />
      <Route path="/care/integrations" component={ProfessionalPortalGate} />
      <Route path="/care/import" component={ProfessionalPortalGate} />
      <Route path="/care/intake" component={ProfessionalPortalGate} />
      <Route path="/care/intake/:id" component={ProfessionalPortalGate} />
      <Route path="/care/crisis" component={ProfessionalPortalGate} />
      <Route path="/admin/providers" component={ProfessionalPortalGate} />
      <Route path="/select-role" component={SelectRoleGate} />
      <Route component={AppGate} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to return to your space",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "A private space to remember and reflect",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <AppRouterSwitch />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
