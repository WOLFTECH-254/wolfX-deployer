import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useListApps, useListServers, useCreateDeployment, getListDeploymentsQueryKey, getGetServerStatsQueryKey, getListServersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, ChevronRight, Rocket, Server, GitBranch, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const STEPS = ["Select App", "Configure", "Choose Slot", "Deploy"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0" data-testid="step-indicator">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center">
            <div className={cn(
              "flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border transition-all",
              done ? "bg-primary border-primary text-primary-foreground" :
              active ? "bg-primary/15 border-primary text-primary" :
              "bg-white/5 border-border text-muted-foreground"
            )}>
              {done ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={cn(
              "hidden sm:block text-xs ml-1.5 transition-colors",
              active ? "text-foreground font-medium" : done ? "text-muted-foreground" : "text-muted-foreground/50"
            )}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-border mx-2 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DeploymentsNew() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preselectedAppId = params.get("appId") ? Number(params.get("appId")) : null;

  const [step, setStep] = useState(preselectedAppId ? 1 : 0);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(preselectedAppId);
  const [envConfig, setEnvConfig] = useState<Record<string, string>>({});
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [deployedBy, setDeployedBy] = useState("");

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const apps = useListApps();
  const servers = useListServers();
  const createDeployment = useCreateDeployment();

  const selectedApp = apps.data?.find((a) => a.id === selectedAppId);
  const envVars = (selectedApp?.appJson?.env ?? {}) as Record<string, { description?: string; required?: boolean; value?: string }>;
  const freeServers = servers.data?.filter((s) => s.status === "available") ?? [];

  useEffect(() => {
    if (selectedApp) {
      const defaults: Record<string, string> = {};
      Object.entries(envVars).forEach(([key, cfg]) => {
        if (cfg.value) defaults[key] = cfg.value;
      });
      setEnvConfig(defaults);
    }
  }, [selectedAppId]);

  function canProceed() {
    if (step === 0) return !!selectedAppId;
    if (step === 1) {
      return Object.entries(envVars).every(([key, cfg]) => !cfg.required || !!envConfig[key]?.trim());
    }
    return true;
  }

  function handleDeploy() {
    createDeployment.mutate(
      {
        appId: selectedAppId!,
        serverId: selectedServerId ?? undefined,
        envConfig,
        deployedBy: deployedBy.trim() || undefined,
      },
      {
        onSuccess: (dep) => {
          queryClient.invalidateQueries({ queryKey: getListDeploymentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetServerStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListServersQueryKey() });
          toast({ title: "Bot deployed", description: `"${selectedApp?.name}" is now running.` });
          setLocation(`/deployments/${dep.id}`);
        },
        onError: () => {
          toast({ title: "Deployment failed", description: "No available server slots or invalid config.", variant: "destructive" });
        },
      }
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground" data-testid="page-title">Deploy a Bot</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Follow the steps to launch a WhatsApp bot onto the platform.</p>
      </div>

      <StepIndicator current={step} />

      {/* Step 0: Select App */}
      {step === 0 && (
        <div className="space-y-3" data-testid="step-select-app">
          <h2 className="text-sm font-semibold text-foreground">Select a registered app</h2>
          {apps.isLoading && <div className="h-20 bg-card border border-border rounded-lg animate-pulse" />}
          {apps.data && apps.data.length === 0 && (
            <div className="text-center py-10 border border-dashed border-border rounded-lg">
              <GitBranch className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No apps registered yet.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setLocation("/apps/new")}>Register an App</Button>
            </div>
          )}
          <div className="space-y-2">
            {apps.data?.map((app) => (
              <button
                key={app.id}
                onClick={() => setSelectedAppId(app.id)}
                data-testid={`select-app-${app.id}`}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3.5 rounded-lg border text-left transition-all",
                  selectedAppId === app.id
                    ? "border-primary bg-primary/8"
                    : "border-border bg-card hover:border-primary/30 hover:bg-primary/3"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0 transition-colors",
                  selectedAppId === app.id ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground"
                )}>
                  <GitBranch className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{app.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{app.repoOwner}/{app.repoName}</p>
                </div>
                {selectedAppId === app.id && <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Configure env vars */}
      {step === 1 && selectedApp && (
        <div className="space-y-4" data-testid="step-configure">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Configure environment</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Fill in the required variables for <span className="text-foreground">{selectedApp.name}</span></p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            {Object.entries(envVars).map(([key, cfg]) => (
              <div key={key} className="space-y-1.5" data-testid={`env-field-${key}`}>
                <Label htmlFor={`env-${key}`} className="flex items-center gap-2">
                  <code className="text-xs text-primary font-mono">{key}</code>
                  {cfg.required && (
                    <span className="text-[10px] font-medium text-red-400 bg-red-400/10 border border-red-400/20 px-1.5 py-0.5 rounded">required</span>
                  )}
                </Label>
                {cfg.description && <p className="text-xs text-muted-foreground">{cfg.description}</p>}
                <Input
                  id={`env-${key}`}
                  data-testid={`input-env-${key}`}
                  placeholder={cfg.value ?? `Enter ${key}`}
                  value={envConfig[key] ?? ""}
                  onChange={(e) => setEnvConfig((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
            {Object.keys(envVars).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No environment variables required.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deployed-by">Your name / handle <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="deployed-by"
              data-testid="input-deployed-by"
              placeholder="e.g. community-user"
              value={deployedBy}
              onChange={(e) => setDeployedBy(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Step 2: Choose slot */}
      {step === 2 && (
        <div className="space-y-3" data-testid="step-choose-slot">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Choose a server slot</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Leave unselected to auto-assign the next available slot.</p>
          </div>
          {freeServers.length === 0 && (
            <div className="text-center py-8 border border-dashed border-red-500/20 rounded-lg">
              <Server className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-400">No available server slots</p>
              <p className="text-xs text-muted-foreground mt-1">All slots are currently occupied. Wait for a deployment to be stopped.</p>
            </div>
          )}
          {freeServers.length > 0 && (
            <>
              <button
                onClick={() => setSelectedServerId(null)}
                data-testid="slot-auto"
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all",
                  selectedServerId === null
                    ? "border-primary bg-primary/8"
                    : "border-border bg-card hover:border-primary/30"
                )}
              >
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/15 text-primary flex-shrink-0 text-xs font-bold">
                  ★
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Auto-assign (recommended)</p>
                  <p className="text-xs text-muted-foreground">{freeServers.length} slot{freeServers.length !== 1 ? "s" : ""} available — picks the lowest numbered free slot</p>
                </div>
                {selectedServerId === null && <CheckCircle className="h-4 w-4 text-primary ml-auto flex-shrink-0" />}
              </button>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {freeServers.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedServerId(s.id)}
                    data-testid={`slot-${s.slotNumber}`}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-all",
                      selectedServerId === s.id
                        ? "border-emerald-500/50 bg-emerald-400/8"
                        : "border-border bg-card hover:border-emerald-500/25"
                    )}
                  >
                    <code className={cn(
                      "text-xs font-bold font-mono w-7 h-7 flex items-center justify-center rounded",
                      selectedServerId === s.id ? "text-emerald-400 bg-emerald-400/15" : "text-muted-foreground bg-white/5"
                    )}>
                      {String(s.slotNumber).padStart(2, "0")}
                    </code>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{s.label}</p>
                      <p className="text-[10px] text-muted-foreground">{s.region}</p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && selectedApp && (
        <div className="space-y-4" data-testid="step-confirm">
          <h2 className="text-sm font-semibold text-foreground">Confirm deployment</h2>
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 border border-primary/20">
                <GitBranch className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{selectedApp.name}</p>
                <p className="text-xs text-muted-foreground">{selectedApp.repoOwner}/{selectedApp.repoName}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Server slot</p>
                <p className="text-sm text-foreground font-medium">
                  {selectedServerId ? servers.data?.find((s) => s.id === selectedServerId)?.label ?? `Slot #${selectedServerId}` : "Auto-assigned"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deployed by</p>
                <p className="text-sm text-foreground font-medium">{deployedBy || "anonymous"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Environment vars</p>
                <p className="text-sm text-foreground font-medium">{Object.keys(envConfig).filter((k) => envConfig[k]).length} configured</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-3 bg-emerald-400/5 border border-emerald-400/15 rounded-lg text-sm text-emerald-400">
            <Rocket className="h-4 w-4 flex-shrink-0" />
            Ready to deploy — click the button below to launch.
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Button
          variant="ghost"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          data-testid="btn-prev-step"
          className="gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            data-testid="btn-next-step"
            className="gap-1.5"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleDeploy}
            disabled={createDeployment.isPending || freeServers.length === 0}
            data-testid="btn-deploy-confirm"
            className="gap-2"
          >
            <Rocket className="h-4 w-4" />
            {createDeployment.isPending ? "Deploying..." : "Deploy Bot"}
          </Button>
        )}
      </div>
    </div>
  );
}
