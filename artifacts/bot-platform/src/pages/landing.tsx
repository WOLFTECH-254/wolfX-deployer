import { Link } from "wouter";
import { useGetPlatformConfig, useGetDeploymentSummary } from "@workspace/api-client-react";
import { Github, ArrowRight, Terminal, Zap, ChevronRight, AlertTriangle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/lib/admin-auth";

function LivePill({ available }: { available: number }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 backdrop-blur-sm">
      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary live-dot" />
      <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-primary">
        {available > 0 ? "All systems live" : "All slots full"}
        <span className="text-muted-foreground"> · </span>
        <span className="text-foreground">{available > 0 ? "Slots open" : "Wait list"}</span>
      </span>
    </div>
  );
}

function StatPill({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex flex-col" data-testid={`hero-stat-${label.toLowerCase()}`}>
      <span className="text-3xl font-display font-extrabold text-foreground tabular-nums">{value}</span>
      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mt-1">{label}</span>
    </div>
  );
}

function TerminalMock({ botName }: { botName: string }) {
  const slug = botName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="rounded-lg border border-primary/20 bg-card/60 backdrop-blur-md ring-glow-green overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background/40">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-2 text-[11px] font-mono text-muted-foreground">deploy.sh — slot #1</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary live-dot" />
          live
        </span>
      </div>
      {/* Body */}
      <div className="p-4 font-mono text-xs leading-relaxed space-y-1.5">
        <div>
          <span className="text-primary">$</span>{" "}
          <span className="text-foreground">deploy</span>{" "}
          <span className="text-muted-foreground">--bot</span>{" "}
          <span className="text-primary/90">{slug || "bot"}</span>{" "}
          <span className="text-muted-foreground">--session</span>{" "}
          <span className="text-foreground/70">$SESSION_ID</span>
        </div>
        <div className="text-muted-foreground">→ cloning repository… <span className="text-emerald-400">ok</span></div>
        <div className="text-muted-foreground">→ npm install (cached)… <span className="text-emerald-400">ok</span></div>
        <div className="text-muted-foreground">→ allocating slot #1 of 30… <span className="text-emerald-400">ok</span></div>
        <div className="text-muted-foreground">→ spawning child process… <span className="text-emerald-400">ok</span></div>
        <div className="pt-1">
          <span className="text-primary text-glow-green">{">"}</span>{" "}
          <span className="text-foreground">connected</span>{" "}
          <span className="text-muted-foreground">in 2.3s · streaming logs…</span>
        </div>
        <div className="pt-2 grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded border border-border bg-background/40 px-2 py-1">
            <span className="text-muted-foreground">status </span>
            <span className="text-emerald-400">running</span>
          </div>
          <div className="rounded border border-border bg-background/40 px-2 py-1">
            <span className="text-muted-foreground">uptime </span>
            <span className="text-foreground">99.7%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const cfg = useGetPlatformConfig();
  const summary = useGetDeploymentSummary();
  const isAdmin = useIsAdmin();

  // Empty / unconfigured fallback
  if (!cfg.isLoading && (!cfg.data || !cfg.data.botName)) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4 p-8 rounded-lg border border-amber-400/20 bg-amber-400/5">
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
          <h1 className="text-xl font-display font-bold text-foreground">Platform not configured</h1>
          <p className="text-sm text-muted-foreground">An admin needs to set the bot repo before this site can accept deployments.</p>
          <Link href="/admin">
            <Button size="sm" className="gap-2">
              <Settings className="h-4 w-4" /> Open admin
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const data = cfg.data;
  const botName = data?.botName ?? "BOT";
  // Split the bot name so the second half glows neon (echoes the WOLFAPIs split)
  const split = (() => {
    const upper = botName.toUpperCase().replace(/\s+/g, "");
    if (upper.length <= 3) return { head: "", tail: upper };
    const cut = Math.max(3, Math.floor(upper.length / 2));
    return { head: upper.slice(0, cut), tail: upper.slice(cut) };
  })();

  const envVars = (data?.botAppJson?.env ?? {}) as Record<string, { description?: string; required?: boolean }>;
  const tagPills = Object.keys(envVars).slice(0, 6);

  const free = data?.availableSlots ?? 0;
  const taken = data?.occupiedSlots ?? 0;
  const total = data?.slotCount ?? 0;
  const running = summary.data?.running ?? 0;
  const allTime = summary.data?.total ?? 0;

  return (
    <div className="min-h-screen relative">
      {/* Top nav strip */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5">
        <div className="flex items-center gap-2.5">
          {data?.botLogo ? (
            <img src={data.botLogo} alt="" className="h-8 w-8 rounded-md object-cover border border-primary/20" />
          ) : (
            <div className="flex items-center justify-center h-8 w-8 rounded-md border border-primary/30 bg-primary/10">
              <Terminal className="h-4 w-4 text-primary" />
            </div>
          )}
          <span className="font-display font-extrabold text-base tracking-tight text-foreground" data-testid="brand">
            <span>WaBot</span><span className="text-primary text-glow-green">Deploy</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {data?.botRepoUrl && (
            <a
              href={data.botRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="nav-github"
              className="text-muted-foreground hover:text-primary transition-colors p-2"
              aria-label="GitHub repo"
            >
              <Github className="h-4 w-4" />
            </a>
          )}
          <Link
            href="/dashboard"
            data-testid="nav-dashboard"
            className="hidden sm:inline-flex text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
          >
            Dashboard
          </Link>
          <Link href="/deployments/new">
            <Button size="sm" data-testid="nav-deploy" className="font-mono uppercase tracking-wider text-xs gap-1.5 btn-glow-green">
              Deploy now
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 px-6 md:px-12 pt-8 md:pt-16 pb-20">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center max-w-7xl mx-auto">
          {/* Left column */}
          <div className="space-y-6">
            <LivePill available={free} />

            {data?.botLogo && (
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-lg border border-primary/20 bg-card/60 backdrop-blur-sm">
                <img src={data.botLogo} alt="" className="h-9 w-9 rounded object-cover" />
              </div>
            )}

            <h1
              data-testid="hero-title"
              className="font-display font-black text-foreground text-6xl sm:text-7xl lg:text-8xl leading-[0.9] tracking-tighter"
            >
              {split.head && <span>{split.head}</span>}
              <span className="text-primary text-glow-green">{split.tail}</span>
            </h1>

            <p className="text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground">
              The hosted deploy platform
            </p>

            <p className="text-base text-muted-foreground max-w-xl leading-relaxed" data-testid="hero-description">
              {data?.botDescription
                ? data.botDescription
                : `${total} slots ready. Drop in your session, get your own running instance in seconds. No build setup, no devops, just deploy.`}
            </p>

            <div className="flex items-center gap-3 pt-2">
              <Link href="/deployments/new">
                <Button size="lg" data-testid="cta-deploy" className="font-mono uppercase tracking-wider text-xs gap-2 btn-glow-green h-11 px-6">
                  <ChevronRight className="h-4 w-4" />
                  Deploy now
                </Button>
              </Link>
              {data?.botRepoUrl && (
                <a href={data.botRepoUrl} target="_blank" rel="noopener noreferrer" data-testid="cta-github">
                  <Button size="lg" variant="outline" className="font-mono uppercase tracking-wider text-xs gap-2 h-11 px-6 border-primary/20 hover:border-primary/40 hover:bg-primary/5">
                    <Github className="h-4 w-4" />
                    Source
                  </Button>
                </a>
              )}
            </div>

            {/* Stat row */}
            <div className="flex items-end gap-10 pt-6">
              <StatPill value={`${free}/${total}`} label="Slots open" />
              <StatPill value={running} label="Running" />
              <StatPill value={allTime} label="Deploys" />
            </div>

            {/* Tag pills */}
            {tagPills.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-4" data-testid="env-pills">
                {tagPills.map((k) => (
                  <span
                    key={k}
                    className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest rounded-md border border-border bg-card/60 text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
                  >
                    {k}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right column — terminal mockup */}
          <div className="relative">
            <div className="absolute -inset-12 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
            <div className="relative">
              <TerminalMock botName={botName} />
              <div className="mt-4 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-primary" />
                  Live preview · auto-updating
                </span>
                <Link href="/deployments" className="hover:text-primary transition-colors" data-testid="link-explore">
                  Explore deployments →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom strip — quick navigation back into the app */}
        <div className="max-w-7xl mx-auto mt-20 pt-10 border-t border-border/60 flex flex-wrap items-center justify-between gap-4">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Hosted on Replit · Open source · Self-hostable
          </p>
          <div className="flex items-center gap-4 text-[11px] font-mono uppercase tracking-wider">
            <Link href="/bot" className="text-muted-foreground hover:text-primary transition-colors">Bot info</Link>
            <Link href="/deployments" className="text-muted-foreground hover:text-primary transition-colors">Deployments</Link>
            <Link href="/dashboard" className="text-muted-foreground hover:text-primary transition-colors">Dashboard</Link>
            {isAdmin && (
              <Link href="/admin" className="text-muted-foreground hover:text-primary transition-colors">Admin</Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
