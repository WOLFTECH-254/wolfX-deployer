import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import {
  useGetPlatformConfig,
  useListServers,
  useCreateDeployment,
  getListDeploymentsQueryKey,
  getGetServerStatsQueryKey,
  getListServersQueryKey,
  getGetPlatformConfigQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, ChevronRight, Rocket, Server, Bot, ChevronLeft, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const STEPS = ["Configure", "Choose Slot", "Deploy"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0" data-testid="step-indicator">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center">
            <div
              className={cn(
                "flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border transition-all",
                done
                  ? "bg-primary border-primary text-primary-foreground"
                  : active
                    ? "bg-primary/15 border-primary text-primary"
                    : "bg-white/5 border-border text-muted-foreground",
              )}
            >
              {done ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                "hidden sm:block text-xs ml-1.5 transition-colors",
                active ? "text-foreground font-medium" : done ? "text-muted-foreground" : "text-muted-foreground/50",
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-border mx-2 flex-shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

export default function DeploymentsNew() {
  const [step, setStep] = useState(0);
  const [envConfig, setEnvConfig] = useState<Record<string, string>>({});
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [deployedBy, setDeployedBy] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const cfg = useGetPlatformConfig();
  const servers = useListServers();
  const createDeployment = useCreateDeployment();

  const envVars = useMemo(
    () => ((cfg.data?.botAppJson?.env ?? {}) as Record<string, { description?: string; required?: boolean; value?: string }>),
    [cfg.data],
  );
  const slotCount = cfg.data?.slotCount ?? 0;
  const freeServers = useMemo(
    () => (servers.data ?? []).filter((s) => s.status === "available" && s.slotNumber <= slotCount),
    [servers.data, slotCount],
  );

  // Seed defaults from app.json exactly once when config first loads.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !cfg.data) return;
    seededRef.current = true;
    const defaults: Record<string, string> = {};
    Object.entries(envVars).forEach(([key, v]) => {
      if (v.value) defaults[key] = v.value;
    });
    if (Object.keys(defaults).length > 0) setEnvConfig(defaults);
  }, [cfg.data, envVars]);

  function canProceed() {
    if (step === 0) {
      return Object.entries(envVars).every(([key, v]) => !v.required || !!envConfig[key]?.trim());
    }
    return true;
  }

  function handleDeploy() {
    createDeployment.mutate(
      {
        data: {
          serverId: selectedServerId ?? undefined,
          envConfig,
          deployedBy: deployedBy.trim() || undefined,
        },
      },
      {
        onSuccess: (dep) => {
          queryClient.invalidateQueries({ queryKey: getListDeploymentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetServerStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListServersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPlatformConfigQueryKey() });
          toast({ title: "Bot deployed", description: `${cfg.data?.botName ?? "Bot"} is now running on slot ${dep.server?.slotNumber ?? dep.serverId}.` });
          setLocation(`/deployments/${dep.id}`);
        },
        onError: (err) => {
          const e = err as { data?: { error?: string }; status?: number };
          toast({
            title: e.status === 409 ? "SESSION_ID conflict" : "Deployment failed",
            description: e.data?.error ?? "Could not deploy. Try a different slot or check your inputs.",
            variant: "destructive",
          });
        },
      },
    );
  }

  if (cfg.isLoading) {
    return <div className="max-w-2xl mx-auto h-40 bg-card border border-border rounded-lg animate-pulse" />;
  }

  if (cfg.error || !cfg.data) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 border border-dashed border-amber-500/30 rounded-lg">
        <ShieldAlert className="h-10 w-10 text-amber-400 mx-auto mb-3" />
        <p className="text-base font-medium text-foreground">Platform isn't configured yet</p>
        <p className="text-sm text-muted-foreground mt-1">An admin needs to set the bot repo before you can deploy.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground" data-testid="page-title">Add Your Session</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Deploy <span className="text-foreground font-medium">{cfg.data.botName}</span> with your own credentials in 3 quick steps.
        </p>
      </div>

      <StepIndicator current={step} />

      {/* Step 0: Configure env */}
      {step === 0 && (
        <div className="space-y-4" data-testid="step-configure">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Your bot configuration</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Fill in the required variables. Your SESSION_ID will be checked against active deployments to prevent conflicts.</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            {Object.entries(envVars).map(([key, v]) => (
              <div key={key} className="space-y-1.5" data-testid={`env-field-${key}`}>
                <Label htmlFor={`env-${key}`} className="flex items-center gap-2">
                  <code className="text-xs text-primary font-mono">{key}</code>
                  {v.required && (
                    <span className="text-[10px] font-medium text-red-400 bg-red-400/10 border border-red-400/20 px-1.5 py-0.5 rounded">required</span>
                  )}
                </Label>
                {v.description && <p className="text-xs text-muted-foreground">{v.description}</p>}
                <Input
                  id={`env-${key}`}
                  data-testid={`input-env-${key}`}
                  type={key.toLowerCase().includes("password") || key.toLowerCase().includes("secret") || key === "SESSION_ID" ? "password" : "text"}
                  placeholder={v.value ?? `Enter ${key}`}
                  value={envConfig[key] ?? ""}
                  onChange={(e) => setEnvConfig((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
            {Object.keys(envVars).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No env vars required for this bot.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deployed-by">Your name / handle <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              id="deployed-by"
              data-testid="input-deployed-by"
              placeholder="e.g. @yourhandle"
              value={deployedBy}
              onChange={(e) => setDeployedBy(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Step 1: Choose slot */}
      {step === 1 && (
        <div className="space-y-3" data-testid="step-choose-slot">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Choose a free slot</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Leave unselected to auto-assign the next available slot.</p>
          </div>
          {freeServers.length === 0 && (
            <div className="text-center py-8 border border-dashed border-red-500/20 rounded-lg">
              <Server className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-400">No free slots</p>
              <p className="text-xs text-muted-foreground mt-1">All {slotCount} slots are in use. Wait for one to free up, or ask the admin to add more.</p>
            </div>
          )}
          {freeServers.length > 0 && (
            <>
              <button
                onClick={() => setSelectedServerId(null)}
                data-testid="slot-auto"
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all",
                  selectedServerId === null ? "border-primary bg-primary/8" : "border-border bg-card hover:border-primary/30",
                )}
              >
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/15 text-primary flex-shrink-0 text-xs font-bold">★</div>
                <div>
                  <p className="text-sm font-medium text-foreground">Auto-assign (recommended)</p>
                  <p className="text-xs text-muted-foreground">{freeServers.length} of {slotCount} slot{slotCount !== 1 ? "s" : ""} free</p>
                </div>
                {selectedServerId === null && <CheckCircle className="h-4 w-4 text-primary ml-auto flex-shrink-0" />}
              </button>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {freeServers.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedServerId(s.id)}
                    data-testid={`slot-${s.slotNumber}`}
                    className={cn(
                      "flex items-center justify-center gap-1 px-2 py-2.5 rounded-lg border text-left transition-all font-mono text-xs font-bold",
                      selectedServerId === s.id ? "border-emerald-500/50 bg-emerald-400/8 text-emerald-400" : "border-border bg-card text-muted-foreground hover:border-emerald-500/25",
                    )}
                  >
                    #{String(s.slotNumber).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 2: Confirm */}
      {step === 2 && (
        <div className="space-y-4" data-testid="step-confirm">
          <h2 className="text-sm font-semibold text-foreground">Ready to deploy</h2>
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 border border-primary/20">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{cfg.data.botName}</p>
                <p className="text-xs text-muted-foreground">{cfg.data.botRepoOwner}/{cfg.data.botRepoName}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Slot</p>
                <p className="text-sm text-foreground font-medium">
                  {selectedServerId ? `#${servers.data?.find((s) => s.id === selectedServerId)?.slotNumber ?? selectedServerId}` : "Auto-assigned"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deployed by</p>
                <p className="text-sm text-foreground font-medium">{deployedBy || "anonymous"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Env vars</p>
                <p className="text-sm text-foreground font-medium">{Object.keys(envConfig).filter((k) => envConfig[k]).length} configured</p>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 px-4 py-3 bg-emerald-400/5 border border-emerald-400/15 rounded-lg text-sm text-emerald-400">
            <Rocket className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Ready to launch</p>
              <p className="text-xs text-emerald-400/80 mt-0.5">Your SESSION_ID will be checked against active deployments to prevent WhatsApp disconnects.</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} data-testid="btn-prev-step" className="gap-1.5">
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canProceed()} data-testid="btn-next-step" className="gap-1.5">
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleDeploy} disabled={createDeployment.isPending || freeServers.length === 0} data-testid="btn-deploy-confirm" className="gap-2">
            <Rocket className="h-4 w-4" />
            {createDeployment.isPending ? "Deploying..." : "Deploy Bot"}
          </Button>
        )}
      </div>
    </div>
  );
}
