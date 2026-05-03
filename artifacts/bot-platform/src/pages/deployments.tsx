import { useListDeployments, useDeleteDeployment, useRestartDeployment, useStopDeployment, getListDeploymentsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Rocket, PlusCircle, Trash2, RefreshCw, Square, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

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
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cfg.className}`} data-testid={`badge-${status}`}>
      {cfg.label}
    </span>
  );
}

const STATUS_FILTERS = ["all", "running", "stopped", "failed", "pending"];

export default function Deployments() {
  const [filter, setFilter] = useState("all");
  const deps = useListDeployments();
  const deleteDeployment = useDeleteDeployment();
  const restartDeployment = useRestartDeployment();
  const stopDeployment = useStopDeployment();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const filtered = deps.data?.filter((d) => filter === "all" || d.status === filter) ?? [];

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListDeploymentsQueryKey() });
  }

  function handleDelete(id: number) {
    if (!confirm("Remove this deployment? The server slot will be freed.")) return;
    deleteDeployment.mutate({ id }, {
      onSuccess: () => { invalidate(); toast({ title: "Deployment removed" }); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  function handleRestart(id: number) {
    restartDeployment.mutate({ id }, {
      onSuccess: () => { invalidate(); toast({ title: "Deployment restarted" }); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  function handleStop(id: number) {
    stopDeployment.mutate({ id }, {
      onSuccess: () => { invalidate(); toast({ title: "Deployment stopped" }); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground" data-testid="page-title">Deployments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All bots deployed on this platform</p>
        </div>
        <Link href="/deployments/new">
          <Button size="sm" className="gap-2" data-testid="btn-new-deployment">
            <PlusCircle className="h-4 w-4" />
            Deploy Bot
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 flex-wrap" data-testid="status-filters">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            data-testid={`filter-${s}`}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
              filter === s
                ? "bg-primary/15 text-primary border border-primary/25"
                : "text-muted-foreground border border-transparent hover:bg-white/5 hover:text-foreground"
            }`}
          >
            {s}
            {s !== "all" && deps.data && (
              <span className="ml-1.5 opacity-60">{deps.data.filter((d) => d.status === s).length}</span>
            )}
          </button>
        ))}
      </div>

      {deps.isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-card border border-border animate-pulse" />)}
        </div>
      )}

      {deps.data && filtered.length === 0 && (
        <div className="flex flex-col items-center py-16 border border-dashed border-border rounded-lg">
          <Rocket className="h-9 w-9 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {filter === "all" ? "No deployments yet" : `No ${filter} deployments`}
          </p>
          {filter === "all" && (
            <Link href="/deployments/new" className="mt-2 text-xs text-primary hover:underline">
              Deploy your first bot
            </Link>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          {filtered.map((dep, idx) => (
            <div
              key={dep.id}
              data-testid={`deployment-row-${dep.id}`}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors ${idx !== filtered.length - 1 ? "border-b border-border" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/deployments/${dep.id}`}
                    data-testid={`link-deployment-${dep.id}`}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate"
                  >
                    {dep.app?.name ?? `App #${dep.appId}`}
                  </Link>
                  <StatusBadge status={dep.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Slot {dep.server?.slotNumber ?? dep.serverId} · {dep.deployedBy ?? "anonymous"} · {formatDistanceToNow(new Date(dep.createdAt), { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {dep.status !== "running" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-400"
                    onClick={() => handleRestart(dep.id)}
                    disabled={restartDeployment.isPending}
                    data-testid={`btn-restart-${dep.id}`}
                    title="Restart"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                )}
                {dep.status === "running" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-400"
                    onClick={() => handleStop(dep.id)}
                    disabled={stopDeployment.isPending}
                    data-testid={`btn-stop-${dep.id}`}
                    title="Stop"
                  >
                    <Square className="h-3 w-3" />
                  </Button>
                )}
                <Link href={`/deployments/${dep.id}`} data-testid={`btn-view-${dep.id}`}>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                  onClick={() => handleDelete(dep.id)}
                  disabled={deleteDeployment.isPending}
                  data-testid={`btn-delete-${dep.id}`}
                  title="Remove"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
