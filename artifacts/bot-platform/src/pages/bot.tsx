import { Link } from "wouter";
import { useGetPlatformConfig } from "@workspace/api-client-react";
import { Bot, ExternalLink, Rocket, Server, Settings, GitBranch, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function BotPage() {
  const cfg = useGetPlatformConfig();

  if (cfg.isLoading) {
    return <div className="max-w-3xl mx-auto h-40 bg-card border border-border rounded-lg animate-pulse" />;
  }

  if (cfg.error || !cfg.data) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex flex-col items-center text-center py-16 border border-dashed border-amber-500/30 rounded-lg">
          <AlertTriangle className="h-10 w-10 text-amber-400 mb-3" />
          <p className="text-base font-medium text-foreground">Platform not configured yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            The admin needs to set the bot repository before users can deploy.
          </p>
          <Link href="/admin" className="mt-4">
            <Button size="sm" className="gap-2">
              <Settings className="h-4 w-4" />
              Open Admin Settings
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { data } = cfg;
  const envVars = (data.botAppJson?.env ?? {}) as Record<string, { description?: string; required?: boolean; value?: string }>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start gap-4">
        {data.botLogo ? (
          <img src={data.botLogo} alt={data.botName} className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-primary/10 border border-primary/20" />
        ) : (
          <div className="flex items-center justify-center w-14 h-14 rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0">
            <Bot className="h-6 w-6 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground" data-testid="bot-name">{data.botName}</h1>
            <a href={data.botRepoUrl} target="_blank" rel="noopener noreferrer" data-testid="link-bot-repo" className="text-muted-foreground hover:text-primary">
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          {data.botDescription && <p className="text-sm text-muted-foreground mt-1">{data.botDescription}</p>}
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
            <GitBranch className="h-3 w-3" />
            {data.botRepoOwner}/{data.botRepoName}
          </p>
        </div>
        <Link href="/deployments/new">
          <Button size="sm" className="gap-2" data-testid="btn-add-session">
            <Rocket className="h-4 w-4" />
            Add Your Session
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total slots</p>
          <p className="text-2xl font-bold text-foreground mt-0.5">{data.slotCount}</p>
        </div>
        <div className="bg-card border border-emerald-500/20 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Available</p>
          <p className="text-2xl font-bold text-emerald-400 mt-0.5" data-testid="slots-available">{data.availableSlots}</p>
        </div>
        <div className="bg-card border border-primary/20 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">In use</p>
          <p className="text-2xl font-bold text-primary mt-0.5" data-testid="slots-occupied">{data.occupiedSlots}</p>
        </div>
      </div>

      {data.adminPasswordIsDefault && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-amber-400/5 border border-amber-400/20 text-sm text-amber-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-200">Default admin password in use</p>
            <p className="text-xs mt-0.5">Set <code className="text-xs">ADMIN_PASSWORD</code> in your environment to lock down the admin page.</p>
          </div>
        </div>
      )}

      {Object.keys(envVars).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">What users need to provide</h2>
          <div className="border border-border rounded-lg overflow-hidden">
            {Object.entries(envVars).map(([key, cfgVar], idx, arr) => (
              <div
                key={key}
                data-testid={`env-row-${key}`}
                className={`flex items-start gap-4 px-4 py-3 ${idx !== arr.length - 1 ? "border-b border-border" : ""}`}
              >
                <code className="text-sm text-primary font-mono mt-0.5 min-w-[140px] flex-shrink-0">{key}</code>
                <div className="flex-1 min-w-0">
                  {cfgVar.description && <p className="text-sm text-muted-foreground">{cfgVar.description}</p>}
                  {cfgVar.value && <p className="text-xs text-muted-foreground/60 mt-0.5">Default: <code className="text-xs">{cfgVar.value}</code></p>}
                </div>
                {cfgVar.required && (
                  <Badge variant="destructive" className="text-[10px] flex-shrink-0">required</Badge>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            <Server className="h-3 w-3 inline mr-1" />
            Each user fills these in their own deployment slot. SESSION_IDs must be unique across active deployments.
          </p>
        </section>
      )}
    </div>
  );
}
