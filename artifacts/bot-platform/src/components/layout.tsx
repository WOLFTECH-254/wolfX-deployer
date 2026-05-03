import { Link, useLocation } from "wouter";
import { LayoutDashboard, Bot, Server, Rocket, PlusCircle, Menu, X, Terminal, Settings } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { LiveCounter } from "./live-counter";
import { useIsAdmin } from "@/lib/admin-auth";

const baseNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bot", label: "Bot", icon: Bot },
  { href: "/servers", label: "Slots", icon: Server },
  { href: "/deployments", label: "Deployments", icon: Rocket },
];
const adminNavItem = { href: "/admin", label: "Admin", icon: Settings };

function NavLink({ href, label, icon: Icon, onClick }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; onClick?: () => void }) {
  const [location] = useLocation();
  const isActive = href === "/dashboard" ? location === "/dashboard" : location.startsWith(href);
  return (
    <Link
      href={href}
      onClick={onClick}
      data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all",
        isActive
          ? "bg-primary/15 text-primary border border-primary/20"
          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = useIsAdmin();
  const navItems = isAdmin ? [...baseNavItems, adminNavItem] : baseNavItems;

  return (
    <div className="min-h-screen flex bg-background">
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-60 bg-card border-r border-border flex flex-col z-30 transition-transform duration-200",
          "md:translate-x-0 md:static md:z-auto",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
          <Link href="/" data-testid="sidebar-home" className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/15 border border-primary/30">
              <Terminal className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-display font-extrabold text-foreground tracking-tight">
                <span>WaBot</span><span className="text-primary text-glow-green">Deploy</span>
              </span>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Open source</p>
            </div>
          </Link>
          <button onClick={() => setMobileOpen(false)} className="ml-auto md:hidden text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} onClick={() => setMobileOpen(false)} />
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <Link
            href="/deployments/new"
            data-testid="nav-deploy-btn"
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Add Your Session
          </Link>
        </div>

        <div className="px-4 py-3 border-t border-border">
          <p className="text-[11px] text-muted-foreground">Open source — self-hostable</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card sticky top-0 z-10">
          <button onClick={() => setMobileOpen(true)} className="text-muted-foreground hover:text-foreground md:hidden" data-testid="mobile-menu-btn">
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-bold text-foreground md:hidden">WaBotDeploy</span>
          <div className="ml-auto">
            <LiveCounter />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
