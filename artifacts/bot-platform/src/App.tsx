import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import BotPage from "@/pages/bot";
import AdminPage from "@/pages/admin";
import Servers from "@/pages/servers";
import Deployments from "@/pages/deployments";
import DeploymentsNew from "@/pages/deployments-new";
import DeploymentDetail from "@/pages/deployment-detail";

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
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/bot" component={BotPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/servers" component={Servers} />
        <Route path="/deployments" component={Deployments} />
        <Route path="/deployments/new" component={DeploymentsNew} />
        <Route path="/deployments/:id" component={DeploymentDetail} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
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
