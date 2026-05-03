import { useEffect } from "react";
import { useGetPlatformConfig, useGetDeploymentSummary } from "@workspace/api-client-react";
import { Server, Users, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function LiveCounter({ className }: { className?: string }) {
  const cfg = useGetPlatformConfig();
  const summary = useGetDeploymentSummary();

  useEffect(() => {
    const id = setInterval(() => {
      void cfg.refetch();
      void summary.refetch();
    }, 5000);
    return () => clearInterval(id);
  }, [cfg, summary]);

  const total = cfg.data?.slotCount ?? 0;
  const taken = cfg.data?.occupiedSlots ?? 0;
  const free = cfg.data?.availableSlots ?? 0;
  const running = summary.data?.running ?? 0;
  const allTime = summary.data?.total ?? 0;

  const pct = total > 0 ? Math.round((taken / total) * 100) : 0;
  const tone =
    pct >= 90 ? "text-red-400 border-red-400/30 bg-red-400/5"
    : pct >= 60 ? "text-amber-400 border-amber-400/30 bg-amber-400/5"
    : "text-emerald-400 border-emerald-400/30 bg-emerald-400/5";

  if (!cfg.data) return null;

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)} data-testid="live-counter">
      <span
        className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium", tone)}
        data-testid="counter-slots"
        title={`${taken} of ${total} slots in use (${free} free)`}
      >
        <Server className="h-3 w-3" />
        <span className="tabular-nums">{taken}</span>
        <span className="opacity-60">/</span>
        <span className="tabular-nums">{total}</span>
        <span className="opacity-60 hidden sm:inline">slots</span>
      </span>
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-card text-xs font-medium text-foreground"
        data-testid="counter-running"
        title="Bot processes currently running"
      >
        <Activity className="h-3 w-3 text-primary" />
        <span className="tabular-nums">{running}</span>
        <span className="text-muted-foreground hidden sm:inline">running</span>
      </span>
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-card text-xs font-medium text-muted-foreground"
        data-testid="counter-total"
        title="All-time deployment count (running, stopped, failed)"
      >
        <Users className="h-3 w-3" />
        <span className="tabular-nums text-foreground">{allTime}</span>
        <span className="hidden sm:inline">total deploys</span>
      </span>
    </div>
  );
}
