import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";

import Landing from "@/pages/landing";
import NotifyPage from "@/pages/notify";
import PresentPage from "@/pages/present";
import Pricing from "@/pages/pricing";
import Caregiver from "@/pages/caregiver";

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
import LovedOne from "@/pages/loved-one";
import Therapists from "@/pages/therapists";
import Crisis from "@/pages/crisis";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

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
        <Route path="/practices/:id" component={PracticePlayer} />
        <Route path="/loved-one" component={LovedOne} />
        <Route path="/therapists" component={Therapists} />
        <Route path="/crisis" component={Crisis} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/notify" component={NotifyPage} />
      <Route path="/present" component={PresentPage} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/caregiver" component={Caregiver} />
      <Route component={AppRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
