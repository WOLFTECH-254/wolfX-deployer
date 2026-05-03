import {
  useGetDeploymentSummary,
  useGetServerStats,
  useGetRecentDeployments,
  useGetPlatformConfig,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Server, Rocket, Bot, CheckCircle, XCircle, Clock, Settings, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cfg.className}`} data-testid={`status-${status}`}>
      {cfg.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  color,
}: {
  label: string;
  value: number | undefined;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-start gap-3" data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className={`flex items-center justify-center w-9 h-9 rounded-md ${color} flex-shrink-0 mt-0.5`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value ?? "—"}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const summary = useGetDeploymentSummary();
  const stats = useGetServerStats();
  const recent = useGetRecentDeployments();
  const platform = useGetPlatformConfig();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground" data-testid="page-title">
          {platform.data ? `Hosting ${platform.data.botName}` : "Platform Dashboard"}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {platform.data
            ? `${platform.data.availableSlots} of ${platform.data.slotCount} slots free — community members can add their session anytime.`
            : "Open source WhatsApp bot hosting — self-hostable"}
        </p>
      </div>

      {!platform.data && !platform.isLoading && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-400/5 border border-amber-400/20">
          <Settings className="h-4 w-4 text-amber-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-200">Platform not configured</p>
            <p className="text-xs text-amber-300/80">Open admin settings to choose which bot to host.</p>
          </div>
          <Link href="/admin" className="text-xs text-primary hover:underline">Go to Admin →</Link>
        </div>
      )}

      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Deployments</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Running" value={summary.data?.running} icon={CheckCircle} color="bg-emerald-400/10 text-emerald-400" />
          <StatCard label="Stopped" value={summary.data?.stopped} icon={Clock} color="bg-white/5 text-muted-foreground" />
          <StatCard label="Failed" value={summary.data?.failed} icon={XCircle} color="bg-red-400/10 text-red-400" />
          <StatCard label="Total" value={summary.data?.total} icon={Rocket} color="bg-primary/10 text-primary" />
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Slot Pool</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="Available" value={stats.data?.available} icon={Server} color="bg-emerald-400/10 text-emerald-400" />
          <StatCard label="In Use" value={stats.data?.occupied} icon={Server} color="bg-primary/10 text-primary" />
          <StatCard label="Total" value={platform.data?.slotCount ?? stats.data?.total} icon={Server} color="bg-white/5 text-muted-foreground" />
        </div>
        {stats.data && stats.data.available > 0 && (
          <div className="mt-3 flex items-center justify-between px-4 py-3 rounded-lg bg-emerald-400/5 border border-emerald-400/15">
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              <span>{stats.data.available} slot{stats.data.available !== 1 ? "s" : ""} free for new sessions</span>
            </div>
            <Link href="/deployments/new" data-testid="quick-deploy-link" className="text-xs text-primary hover:underline flex items-center gap-1">
              Add session <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Recent Deployments</h2>
          <Link href="/deployments" data-testid="link-all-deployments" className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recent.isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-card border border-border animate-pulse" />
            ))}
          </div>
        )}

        {recent.data && recent.data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-lg">
            <Rocket className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No deployments yet</p>
            <Link href="/deployments/new" className="mt-2 text-xs text-primary hover:underline">
              Add the first session
            </Link>
          </div>
        )}

        {recent.data && recent.data.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            {recent.data.map((dep, idx) => (
              <Link
                key={dep.id}
                href={`/deployments/${dep.id}`}
                data-testid={`recent-deployment-${dep.id}`}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors ${idx !== (recent.data?.length ?? 0) - 1 ? "border-b border-border" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">Slot #{dep.server?.slotNumber ?? dep.serverId}</p>
                  <p className="text-xs text-muted-foreground">
                    {dep.deployedBy ?? "anonymous"} · {formatDistanceToNow(new Date(dep.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <StatusBadge status={dep.status} />
                <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: "/bot", icon: Bot, label: "View Bot Info", desc: "See what session vars are required" },
            { href: "/deployments/new", icon: Rocket, label: "Add Your Session", desc: "Deploy onto a free slot" },
            { href: "/admin", icon: Settings, label: "Admin Settings", desc: "Change bot or slot count" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`quick-action-${item.href.replace(/\//g, "-")}`}
              className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-all group"
            >
              <item.icon className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <ArrowRight className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
