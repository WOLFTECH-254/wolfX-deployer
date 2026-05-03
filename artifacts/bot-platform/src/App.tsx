import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { ThemeProvider } from "@/components/theme-provider";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import BotPage from "@/pages/bot";
import AdminPage from "@/pages/admin";
import Servers from "@/pages/servers";
import Deployments from "@/pages/deployments";
import DeploymentsNew from "@/pages/deployments-new";
import DeploymentDetail from "@/pages/deployment-detail";
import Apps from "@/pages/apps";
import AppsNew from "@/pages/apps-new";
import AppDetail from "@/pages/app-detail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Switch>
      {/* Public landing page lives outside the sidebar layout */}
      <Route path="/" component={Landing} />
      {/* Everything else uses the app layout */}
      <Route>
        <Layout>
          <Switch>
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/bot" component={BotPage} />
            <Route path="/admin" component={AdminPage} />
            <Route path="/servers" component={Servers} />
            <Route path="/deployments" component={Deployments} />
            <Route path="/deployments/new" component={DeploymentsNew} />
            <Route path="/deployments/:id" component={DeploymentDetail} />
            {/* Legacy multi-app registry routes; unlinked from sidebar but kept reachable */}
            <Route path="/apps" component={Apps} />
            <Route path="/apps/new" component={AppsNew} />
            <Route path="/apps/:id" component={AppDetail} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
