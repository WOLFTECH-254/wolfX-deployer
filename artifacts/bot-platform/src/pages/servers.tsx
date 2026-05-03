import { useListServers, useGetServerStats } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Server, CheckCircle, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

function SlotCard({ server }: { server: { id: number; slotNumber: number; label: string; status: string; region: string; currentDeployment?: { id: number; status: string; app?: { name: string } | null } | null } }) {
  const isAvailable = server.status === "available";
  const isOccupied = server.status === "occupied";
  const isMaintenance = server.status === "maintenance";

  return (
    <div
      data-testid={`server-slot-${server.slotNumber}`}
      className={`relative rounded-lg border p-3.5 transition-all ${
        isAvailable
          ? "border-emerald-500/20 bg-emerald-400/3 hover:border-emerald-500/40"
          : isOccupied
          ? "border-primary/20 bg-primary/3"
          : "border-border bg-card opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold font-mono flex-shrink-0 ${
            isAvailable ? "bg-emerald-400/15 text-emerald-400" :
            isOccupied ? "bg-primary/15 text-primary" :
            "bg-white/5 text-muted-foreground"
          }`}>
            {String(server.slotNumber).padStart(2, "0")}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{server.label}</p>
            <p className="text-[10px] text-muted-foreground">{server.region}</p>
          </div>
        </div>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border flex-shrink-0 ${
          isAvailable ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" :
          isOccupied ? "text-primary bg-primary/10 border-primary/20" :
          "text-muted-foreground bg-white/5 border-white/10"
        }`}>
          {server.status}
        </span>
      </div>

      {isOccupied && server.currentDeployment && (
        <Link href={`/deployments/${server.currentDeployment.id}`} className="mt-2.5 block group" data-testid={`link-deployment-${server.currentDeployment.id}`}>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/5 border border-white/8 hover:border-primary/20 transition-colors">
            <Rocket className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
            <span className="text-xs text-foreground truncate">{server.currentDeployment.app?.name ?? `Deployment #${server.currentDeployment.id}`}</span>
          </div>
        </Link>
      )}

      {isAvailable && (
        <Link href="/deployments/new" className="mt-2.5 block" data-testid={`deploy-to-slot-${server.slotNumber}`}>
          <div className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border border-dashed border-emerald-500/25 text-emerald-400/60 hover:border-emerald-500/50 hover:text-emerald-400 transition-colors text-xs">
            <Rocket className="h-3 w-3" />
            Deploy here
          </div>
        </Link>
      )}
    </div>
  );
}

export default function Servers() {
  const servers = useListServers();
  const stats = useGetServerStats();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground" data-testid="page-title">Server Pool</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Shared infrastructure slots for running WhatsApp bots</p>
        </div>
        <Link href="/deployments/new">
          <Button size="sm" className="gap-2" data-testid="btn-deploy-new">
            <Rocket className="h-4 w-4" />
            Deploy Bot
          </Button>
        </Link>
      </div>

      {/* Stats bar */}
      {stats.data && (
        <div className="grid grid-cols-4 gap-3" data-testid="server-stats">
          {[
            { label: "Total", value: stats.data.total, color: "text-foreground" },
            { label: "Available", value: stats.data.available, color: "text-emerald-400" },
            { label: "Occupied", value: stats.data.occupied, color: "text-primary" },
            { label: "Maintenance", value: stats.data.maintenance, color: "text-amber-400" },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-lg p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Availability bar */}
      {stats.data && stats.data.total > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Pool utilization</span>
            <span>{Math.round((stats.data.occupied / stats.data.total) * 100)}% used</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(stats.data.occupied / stats.data.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Slot grid */}
      {servers.isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      )}

      {servers.data && (
        <div>
          <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400/20 border border-emerald-400/30 inline-block" /> Available</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary/20 border border-primary/30 inline-block" /> Occupied</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-white/5 border border-white/10 inline-block" /> Maintenance</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {servers.data.map((server) => (
              <SlotCard key={server.id} server={server as Parameters<typeof SlotCard>[0]["server"]} />
            ))}
          </div>
        </div>
      )}

      {servers.data && servers.data.length === 0 && (
        <div className="flex flex-col items-center py-16 border border-dashed border-border rounded-lg">
          <Server className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No server slots configured</p>
        </div>
      )}
    </div>
  );
}
