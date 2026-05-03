import { useParams, Link } from "wouter";
import { useGetApp, useDeleteApp, useListDeployments, getListAppsQueryKey, getGetAppQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { GitBranch, ExternalLink, Trash2, Rocket, ArrowLeft, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    running: { label: "Running", className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
    stopped: { label: "Stopped", className: "text-muted-foreground bg-white/5 border-white/10" },
    pending: { label: "Pending", className: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
    failed: { label: "Failed", className: "text-red-400 bg-red-400/10 border-red-400/20" },
    restarting: { label: "Restarting", className: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  };
  const cfg = map[status] ?? map.stopped;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

export default function AppDetail() {
  const { id } = useParams<{ id: string }>();
  const numId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const app = useGetApp(numId, { query: { enabled: !!numId, queryKey: getGetAppQueryKey(numId) } });
  const allDeployments = useListDeployments();
  const deleteApp = useDeleteApp();

  const deployments = allDeployments.data?.filter((d) => d.appId === numId) ?? [];

  function handleDelete() {
    if (!app.data) return;
    if (!confirm(`Remove "${app.data.name}" from the registry?`)) return;
    deleteApp.mutate(
      { id: numId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAppsQueryKey() });
          toast({ title: "App removed" });
          setLocation("/apps");
        },
        onError: () => toast({ title: "Error", description: "Failed to remove app.", variant: "destructive" }),
      }
    );
  }

  if (app.isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-card border border-border rounded animate-pulse" />
        <div className="h-40 bg-card border border-border rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!app.data) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <p className="text-muted-foreground">App not found.</p>
        <Link href="/apps" className="mt-2 text-sm text-primary hover:underline block">Back to Apps</Link>
      </div>
    );
  }

  const { data } = app;
  const envVars = (data.appJson?.env ?? {}) as Record<string, { description?: string; required?: boolean; value?: string }>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/apps" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit" data-testid="link-back-apps">
        <ArrowLeft className="h-3.5 w-3.5" />
        All Apps
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0">
          <GitBranch className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-foreground" data-testid="app-name">{data.name}</h1>
            <a href={data.repoUrl} target="_blank" rel="noopener noreferrer" data-testid="link-github" className="text-muted-foreground hover:text-primary">
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          {data.description && <p className="text-sm text-muted-foreground mt-0.5">{data.description}</p>}
          <p className="text-xs text-muted-foreground mt-1">
            {data.repoOwner}/{data.repoName} · {data.deploymentCount} deployment{data.deploymentCount !== 1 ? "s" : ""} · registered {formatDistanceToNow(new Date(data.createdAt), { addSuffix: true })}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link href={`/deployments/new?appId=${data.id}`}>
            <Button size="sm" className="gap-1.5" data-testid="btn-deploy">
              <Rocket className="h-3.5 w-3.5" />
              Deploy
            </Button>
          </Link>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400" onClick={handleDelete} data-testid="btn-delete">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Environment variables */}
      {Object.keys(envVars).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Environment Variables</h2>
          <div className="border border-border rounded-lg overflow-hidden">
            {Object.entries(envVars).map(([key, cfg], idx, arr) => (
              <div
                key={key}
                data-testid={`env-row-${key}`}
                className={`flex items-start gap-4 px-4 py-3 ${idx !== arr.length - 1 ? "border-b border-border" : ""}`}
              >
                <code className="text-sm text-primary font-mono mt-0.5 min-w-[140px] flex-shrink-0">{key}</code>
                <div className="flex-1">
                  {cfg.description && <p className="text-sm text-muted-foreground">{cfg.description}</p>}
                  {cfg.value && <p className="text-xs text-muted-foreground/60 mt-0.5">Default: <code className="text-xs">{cfg.value}</code></p>}
                </div>
                {cfg.required && (
                  <Badge variant="destructive" className="text-[10px] flex-shrink-0">required</Badge>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Scripts */}
      {data.appJson?.scripts && Object.keys(data.appJson.scripts).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Scripts</h2>
          <div className="border border-border rounded-lg overflow-hidden">
            {Object.entries(data.appJson.scripts as Record<string, string>).map(([key, cmd], idx, arr) => (
              <div key={key} className={`flex items-center gap-4 px-4 py-2.5 ${idx !== arr.length - 1 ? "border-b border-border" : ""}`}>
                <code className="text-xs text-muted-foreground font-mono min-w-[80px]">{key}</code>
                <code className="text-xs text-foreground font-mono flex-1">{cmd}</code>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Deployments */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Deployments ({deployments.length})</h2>
        {deployments.length === 0 ? (
          <div className="flex flex-col items-center py-8 border border-dashed border-border rounded-lg">
            <Rocket className="h-7 w-7 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No deployments yet</p>
            <Link href={`/deployments/new?appId=${data.id}`} className="mt-2 text-xs text-primary hover:underline">
              Deploy this app
            </Link>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            {deployments.map((dep, idx) => (
              <Link
                key={dep.id}
                href={`/deployments/${dep.id}`}
                data-testid={`dep-row-${dep.id}`}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors ${idx !== deployments.length - 1 ? "border-b border-border" : ""}`}
              >
                <div className="flex-1">
                  <p className="text-sm text-foreground">Slot {dep.server?.slotNumber ?? dep.serverId}</p>
                  <p className="text-xs text-muted-foreground">
                    {dep.deployedBy ?? "anonymous"} · {formatDistanceToNow(new Date(dep.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <StatusBadge status={dep.status} />
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
