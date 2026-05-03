import { useListApps, useDeleteApp, getListAppsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { GitBranch, PlusCircle, Trash2, ArrowRight, ExternalLink, Rocket } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export default function Apps() {
  const apps = useListApps();
  const deleteApp = useDeleteApp();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  function handleDelete(id: number, name: string) {
    if (!confirm(`Remove "${name}" from the registry? Active deployments will not be affected.`)) return;
    deleteApp.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAppsQueryKey() });
          toast({ title: "App removed", description: `"${name}" has been removed from the registry.` });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to remove the app.", variant: "destructive" });
        },
      }
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground" data-testid="page-title">App Registry</h1>
          <p className="text-sm text-muted-foreground mt-0.5">GitHub repositories registered on this platform</p>
        </div>
        <Link href="/apps/new">
          <Button data-testid="btn-register-app" size="sm" className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Register App
          </Button>
        </Link>
      </div>

      {apps.isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-card border border-border animate-pulse" />
          ))}
        </div>
      )}

      {apps.data && apps.data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-lg">
          <GitBranch className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">No apps registered</p>
          <p className="text-sm text-muted-foreground mt-1">Add a GitHub repo to get started</p>
          <Link href="/apps/new" className="mt-3">
            <Button size="sm" variant="outline" className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Register your first app
            </Button>
          </Link>
        </div>
      )}

      {apps.data && apps.data.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          {apps.data.map((app, idx) => (
            <div
              key={app.id}
              data-testid={`app-card-${app.id}`}
              className={`flex items-center gap-4 px-4 py-3.5 hover:bg-white/3 transition-colors ${idx !== (apps.data?.length ?? 0) - 1 ? "border-b border-border" : ""}`}
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 border border-primary/20 flex-shrink-0">
                <GitBranch className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/apps/${app.id}`}
                    data-testid={`link-app-${app.id}`}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate"
                  >
                    {app.name}
                  </Link>
                  <a
                    href={app.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`link-repo-${app.id}`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {app.repoOwner}/{app.repoName} · {app.deploymentCount} deployment{app.deploymentCount !== 1 ? "s" : ""} · added {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link href={`/deployments/new?appId=${app.id}`} data-testid={`btn-deploy-${app.id}`}>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7">
                    <Rocket className="h-3 w-3" />
                    Deploy
                  </Button>
                </Link>
                <Link href={`/apps/${app.id}`} data-testid={`btn-view-app-${app.id}`}>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                  onClick={() => handleDelete(app.id, app.name)}
                  disabled={deleteApp.isPending}
                  data-testid={`btn-delete-app-${app.id}`}
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
