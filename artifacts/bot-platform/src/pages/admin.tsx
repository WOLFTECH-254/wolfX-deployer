import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPlatformConfig,
  getGetPlatformConfigQueryKey,
  getListServersQueryKey,
  getGetServerStatsQueryKey,
} from "@workspace/api-client-react";
import { Settings, Lock, Save, AlertTriangle, CheckCircle, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  getAdminPassword,
  setAdminPassword as storeAdminPassword,
  clearAdminPassword,
  adminAuthHeaders,
} from "@/lib/admin-auth";

const API_BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+/g, "/");

export default function AdminPage() {
  const cfg = useGetPlatformConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(!!getAdminPassword());
  const [loggingIn, setLoggingIn] = useState(false);

  const [botRepoUrl, setBotRepoUrl] = useState("");
  const [slotCount, setSlotCount] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Pre-fill form from current config
  const formRepoUrl = botRepoUrl || cfg.data?.botRepoUrl || "";
  const formSlotCount = slotCount !== "" ? slotCount : String(cfg.data?.slotCount ?? 30);

  async function handleLogin() {
    setLoggingIn(true);
    try {
      const res = await fetch(`${API_BASE}/platform/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Login failed", description: body.error ?? "Wrong password", variant: "destructive" });
        return;
      }
      storeAdminPassword(password);
      setAuthed(true);
      setPassword("");
      toast({ title: "Logged in" });
    } catch (e) {
      toast({ title: "Login error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoggingIn(false);
    }
  }

  function handleLogout() {
    clearAdminPassword();
    setAuthed(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (botRepoUrl && botRepoUrl !== cfg.data?.botRepoUrl) body.botRepoUrl = botRepoUrl;
      const sc = Number(formSlotCount);
      if (!Number.isNaN(sc) && sc !== cfg.data?.slotCount) body.slotCount = sc;
      if (Object.keys(body).length === 0) {
        toast({ title: "Nothing changed" });
        return;
      }
      const res = await fetch(`${API_BASE}/platform/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          handleLogout();
          toast({ title: "Session expired", description: "Please log in again.", variant: "destructive" });
          return;
        }
        toast({ title: "Save failed", description: data.error ?? `HTTP ${res.status}`, variant: "destructive" });
        return;
      }
      toast({ title: "Settings saved", description: data.message ?? "Platform updated" });
      setBotRepoUrl("");
      setSlotCount("");
      await queryClient.invalidateQueries({ queryKey: getGetPlatformConfigQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getListServersQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetServerStatsQueryKey() });
    } catch (e) {
      toast({ title: "Network error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (!authed) {
    return (
      <div className="max-w-md mx-auto space-y-6 mt-12">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 mb-3">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground" data-testid="admin-login-title">Admin Login</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter the admin password to manage the bot and slot count.
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-password">Admin password</Label>
            <Input
              id="admin-password"
              type="password"
              data-testid="input-admin-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && password && handleLogin()}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Set via the <code className="text-primary">ADMIN_PASSWORD</code> environment variable when deploying the platform.
            </p>
          </div>
          <Button onClick={handleLogin} disabled={!password || loggingIn} className="w-full gap-2" data-testid="btn-login">
            <Lock className="h-4 w-4" />
            {loggingIn ? "Verifying..." : "Login"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2" data-testid="admin-title">
            <Settings className="h-5 w-5" />
            Platform Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Change which bot is hosted and how many slots are available.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={handleLogout} className="gap-1.5" data-testid="btn-logout">
          <LogOut className="h-3.5 w-3.5" />
          Logout
        </Button>
      </div>

      {cfg.data?.adminPasswordIsDefault && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-amber-400/5 border border-amber-400/20 text-sm text-amber-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-200">You're using the default admin password</p>
            <p className="text-xs mt-0.5">Set <code className="text-xs">ADMIN_PASSWORD</code> in your environment to secure this page in production.</p>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-5 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="bot-repo">Bot GitHub repository</Label>
          <Input
            id="bot-repo"
            data-testid="input-bot-repo"
            placeholder="https://github.com/owner/repo"
            value={formRepoUrl}
            onChange={(e) => setBotRepoUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            The platform will fetch this repo's <code className="text-primary">app.json</code> to determine what env vars users need to provide.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="slot-count">Number of slots</Label>
          <Input
            id="slot-count"
            data-testid="input-slot-count"
            type="number"
            min={1}
            max={500}
            placeholder="30"
            value={formSlotCount}
            onChange={(e) => setSlotCount(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Each slot hosts one user's bot session. You can increase this any time. To shrink, all higher-numbered slots must be empty first.
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-muted-foreground">
            Current: <span className="text-foreground font-medium">{cfg.data?.botName ?? "—"}</span>
            {" · "}
            <span className="text-foreground font-medium">{cfg.data?.slotCount ?? 0}</span> slots
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2" data-testid="btn-save-settings">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 text-sm">
        <p className="font-medium text-foreground flex items-center gap-1.5">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          Configure via <code className="text-primary">app.json</code> (Heroku-style)
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          When deploying this platform itself, set these environment variables in your <code className="text-primary">app.json</code>:
        </p>
        <pre className="text-xs bg-black/40 border border-border rounded p-3 mt-2 overflow-x-auto"><code>{`{
  "env": {
    "ADMIN_PASSWORD": { "required": true, "generator": "secret" },
    "BOT_REPO_URL":   { "value": "https://github.com/WOLFTECH-254/silentwolf" },
    "SLOT_COUNT":     { "value": "30" }
  }
}`}</code></pre>
        <p className="text-xs text-muted-foreground mt-2">
          On first boot the platform reads these and pre-fills the settings above. You can change them later from this page without redeploying.
        </p>
      </div>
    </div>
  );
}
