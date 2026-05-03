import { useParams, Link } from "wouter";
import { useGetDeployment, useGetDeploymentLogs, useRestartDeployment, useStopDeployment, useDeleteDeployment, getListDeploymentsQueryKey, getGetDeploymentQueryKey, getGetDeploymentLogsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, Square, Trash2, Server, GitBranch, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
    <span className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-medium border ${cfg.className}`} data-testid="deployment-status">
      {cfg.label}
    </span>
  );
}

export default function DeploymentDetail() {
  const { id } = useParams<{ id: string }>();
  const numId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showEnvValues, setShowEnvValues] = useState(false);

  const dep = useGetDeployment(numId, { query: { enabled: !!numId, queryKey: getGetDeploymentQueryKey(numId) } });
  const logs = useGetDeploymentLogs(numId, { query: { enabled: !!numId, queryKey: getGetDeploymentLogsQueryKey(numId) } });
  const restartDeployment = useRestartDeployment();
  const stopDeployment = useStopDeployment();
  const deleteDeployment = useDeleteDeployment();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getGetDeploymentQueryKey(numId) });
    queryClient.invalidateQueries({ queryKey: getListDeploymentsQueryKey() });
  }

  function handleRestart() {
    restartDeployment.mutate({ id: numId } as { id: number }, {
      onSuccess: () => { invalidate(); toast({ title: "Deployment restarted" }); },
      onError: () => toast({ title: "Error", description: "Failed to restart.", variant: "destructive" }),
    });
  }

  function handleStop() {
    stopDeployment.mutate({ id: numId }, {
      onSuccess: () => { invalidate(); toast({ title: "Deployment stopped" }); },
      onError: () => toast({ title: "Error", description: "Failed to stop.", variant: "destructive" }),
    });
  }

  function handleDelete() {
    if (!confirm("Remove this deployment? The server slot will be freed.")) return;
    deleteDeployment.mutate({ id: numId }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListDeploymentsQueryKey() }); setLocation("/deployments"); toast({ title: "Deployment removed" }); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  if (dep.isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-8 w-32 bg-card border border-border rounded animate-pulse" />
        <div className="h-32 bg-card border border-border rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!dep.data) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <p className="text-muted-foreground">Deployment not found.</p>
        <Link href="/deployments" className="mt-2 text-sm text-primary hover:underline block">Back to Deployments</Link>
      </div>
    );
  }

  const { data } = dep;
  const envConfig = (data.envConfig ?? {}) as Record<string, string>;
  const appJson = data.app?.appJson as { env?: Record<string, { description?: string; required?: boolean }> } | undefined;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/deployments" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit" data-testid="link-back">
        <ArrowLeft className="h-3.5 w-3.5" />
        All Deployments
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-foreground" data-testid="deployment-title">
              {data.app?.name ?? `Deployment #${data.id}`}
            </h1>
            <StatusBadge status={data.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Deployed {formatDistanceToNow(new Date(data.createdAt), { addSuffix: true })}
            {data.deployedBy ? ` by ${data.deployedBy}` : ""}
            {" · "}Updated {formatDistanceToNow(new Date(data.updatedAt), { addSuffix: true })}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {data.status === "running" ? (
            <Button size="sm" variant="outline" onClick={handleStop} disabled={stopDeployment.isPending} className="gap-1.5" data-testid="btn-stop">
              <Square className="h-3.5 w-3.5" />
              {stopDeployment.isPending ? "Stopping..." : "Stop"}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleRestart} disabled={restartDeployment.isPending} className="gap-1.5" data-testid="btn-restart">
              <RefreshCw className="h-3.5 w-3.5" />
              {restartDeployment.isPending ? "Restarting..." : "Restart"}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400" onClick={handleDelete} data-testid="btn-delete">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-lg p-3.5 space-y-1" data-testid="card-app">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitBranch className="h-3 w-3" />
            App
          </div>
          <Link href={`/apps/${data.appId}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors block truncate">
            {data.app?.name ?? `App #${data.appId}`}
          </Link>
          {data.app && <p className="text-xs text-muted-foreground">{data.app.repoOwner}/{data.app.repoName}</p>}
        </div>
        <div className="bg-card border border-border rounded-lg p-3.5 space-y-1" data-testid="card-server">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Server className="h-3 w-3" />
            Server
          </div>
          <p className="text-sm font-medium text-foreground">{data.server?.label ?? `Server #${data.serverId}`}</p>
          <p className="text-xs text-muted-foreground">Slot {data.server?.slotNumber ?? "—"} · {data.server?.region ?? "—"}</p>
        </div>
      </div>

      {/* Environment config */}
      {Object.keys(envConfig).length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Environment Config</h2>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setShowEnvValues(!showEnvValues)}
              data-testid="btn-toggle-env-values"
            >
              {showEnvValues ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showEnvValues ? "Hide values" : "Reveal values"}
            </Button>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            {Object.entries(envConfig).map(([key, val], idx, arr) => {
              const meta = appJson?.env?.[key];
              return (
                <div key={key} data-testid={`env-config-${key}`} className={`flex items-start gap-4 px-4 py-3 ${idx !== arr.length - 1 ? "border-b border-border" : ""}`}>
                  <div className="min-w-[140px] flex-shrink-0">
                    <code className="text-xs text-primary font-mono">{key}</code>
                    {meta?.description && <p className="text-[10px] text-muted-foreground mt-0.5">{meta.description}</p>}
                  </div>
                  <code className="text-xs text-foreground/80 font-mono flex-1 break-all">
                    {showEnvValues ? val : "•".repeat(Math.min(val.length, 12))}
                  </code>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Logs */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Logs</h2>
        <div
          className="rounded-lg border border-border bg-black/80 p-4 font-mono text-xs space-y-1 min-h-[200px] max-h-[400px] overflow-y-auto"
          data-testid="log-output"
          style={{ fontFamily: "Menlo, Monaco, 'Courier New', monospace" }}
        >
          {logs.isLoading && (
            <div className="text-muted-foreground animate-pulse">Fetching logs...</div>
          )}
          {logs.data?.logs && logs.data.logs.length === 0 && (
            <div className="text-muted-foreground">No logs available.</div>
          )}
          {logs.data?.logs && logs.data.logs.map((entry, i) => (
            <div key={i} className="flex gap-3" data-testid={`log-entry-${i}`}>
              <span className="text-muted-foreground flex-shrink-0">
                {format(new Date(entry.timestamp), "HH:mm:ss")}
              </span>
              <span className={`flex-shrink-0 w-10 ${entry.level === "error" ? "text-red-400" : entry.level === "warn" ? "text-amber-400" : "text-emerald-500/60"}`}>
                [{entry.level.toUpperCase().padEnd(4)}]
              </span>
              <span className={entry.level === "error" ? "text-red-300" : entry.level === "warn" ? "text-amber-300" : "text-foreground/70"}>
                {entry.message}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
