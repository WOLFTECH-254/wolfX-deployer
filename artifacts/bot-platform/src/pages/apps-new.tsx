import { useState } from "react";
import { useLocation } from "wouter";
import { useFetchAppJson, useCreateApp, getListAppsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { GitBranch, Search, CheckCircle, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function AppsNew() {
  const [, setLocation] = useLocation();
  const [repoUrl, setRepoUrl] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchAppJson = useFetchAppJson();
  const createApp = useCreateApp();

  const preview = fetchAppJson.data;

  function handleFetch() {
    if (!repoUrl.trim()) return;
    fetchAppJson.mutate({ repoUrl: repoUrl.trim() }, {
      onError: () => {
        toast({ title: "Could not find app.json", description: "Make sure the repo is public and has an app.json at the root.", variant: "destructive" });
      }
    });
  }

  function handleRegister() {
    createApp.mutate({ repoUrl: repoUrl.trim() }, {
      onSuccess: (app) => {
        queryClient.invalidateQueries({ queryKey: getListAppsQueryKey() });
        toast({ title: "App registered", description: `"${app.name}" is now in the registry.` });
        setLocation("/apps");
      },
      onError: () => {
        toast({ title: "Registration failed", description: "This repo may already be registered.", variant: "destructive" });
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground" data-testid="page-title">Register a GitHub App</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Enter a public GitHub repo URL. The platform will read its <code className="text-primary bg-primary/10 px-1 rounded text-xs">app.json</code> to auto-configure the deploy form.
        </p>
      </div>

      {/* URL input */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="repo-url">GitHub Repository URL</Label>
          <div className="flex gap-2">
            <Input
              id="repo-url"
              data-testid="input-repo-url"
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={(e) => {
                setRepoUrl(e.target.value);
                fetchAppJson.reset();
              }}
              onKeyDown={(e) => e.key === "Enter" && handleFetch()}
              className="flex-1"
            />
            <Button
              onClick={handleFetch}
              disabled={!repoUrl.trim() || fetchAppJson.isPending}
              data-testid="btn-fetch-app-json"
              variant="outline"
              className="gap-2 whitespace-nowrap"
            >
              <Search className="h-4 w-4" />
              {fetchAppJson.isPending ? "Fetching..." : "Fetch app.json"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The repository must be public and contain an <code className="text-primary">app.json</code> file at the root.
          </p>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="bg-card border border-emerald-500/20 rounded-lg p-5 space-y-4" data-testid="app-json-preview">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-400">app.json found</span>
          </div>

          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">{preview.name}</p>
            {preview.description && <p className="text-sm text-muted-foreground">{preview.description}</p>}
            {preview.keywords && preview.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {preview.keywords.map((kw) => (
                  <Badge key={kw} variant="secondary" className="text-xs">{kw}</Badge>
                ))}
              </div>
            )}
          </div>

          {preview.env && Object.keys(preview.env).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Environment Variables ({Object.keys(preview.env).length})</p>
              <div className="border border-border rounded-md overflow-hidden">
                {Object.entries(preview.env).map(([key, cfg], idx, arr) => (
                  <div
                    key={key}
                    className={`flex items-start gap-3 px-3 py-2.5 ${idx !== arr.length - 1 ? "border-b border-border" : ""}`}
                    data-testid={`env-var-${key}`}
                  >
                    <code className="text-xs text-primary font-mono mt-0.5 whitespace-nowrap">{key}</code>
                    <div className="flex-1 min-w-0">
                      {cfg.description && <p className="text-xs text-muted-foreground">{cfg.description}</p>}
                      {cfg.value && <p className="text-xs text-foreground/60 mt-0.5">Default: <code className="text-xs">{cfg.value}</code></p>}
                    </div>
                    {cfg.required && (
                      <span className="text-[10px] font-medium text-red-400 bg-red-400/10 border border-red-400/20 px-1.5 py-0.5 rounded flex-shrink-0">required</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleRegister}
              disabled={createApp.isPending}
              data-testid="btn-register-confirm"
              className="gap-2"
            >
              {createApp.isPending ? "Registering..." : "Register App"}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setRepoUrl(""); fetchAppJson.reset(); }}
              data-testid="btn-cancel"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Example repos */}
      {!preview && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Example repositories</p>
          <div className="space-y-1.5">
            {[
              "https://github.com/WhiskeySockets/Baileys",
              "https://github.com/danielgross/whatsapp-gpt",
              "https://github.com/open-wa/wa-automate-nodejs",
            ].map((url) => (
              <button
                key={url}
                onClick={() => setRepoUrl(url)}
                data-testid={`example-repo-${url.split("/").pop()}`}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors w-full text-left px-3 py-2 rounded-md hover:bg-white/5"
              >
                <GitBranch className="h-3 w-3 flex-shrink-0" />
                {url}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
