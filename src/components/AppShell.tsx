import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, ScanLine, Package, Menu as MenuIcon, ListChecks, User as UserIcon, Users, LogOut } from "lucide-react";
import { useAuth, type Role } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { ContactBanner } from "@/components/ContactBanner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";
import { InstallPrompt } from "@/components/InstallPrompt";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
}

function navForRole(role: Role): NavItem[] {
  if (role === "rider") {
    return [
      { to: "/rider", label: "Home", icon: Home },
      { to: "/rider/scan", label: "Scan", icon: ScanLine },
      { to: "/rider/list", label: "My List", icon: ListChecks },
      { to: "/rider/profile", label: "Profile", icon: UserIcon },
    ];
  }
  const base = role === "super_admin" ? "/admin" : "/office";
  return [
    { to: base, label: "Home", icon: Home },
    { to: `${base}/scan`, label: "Scan", icon: ScanLine },
    { to: `${base}/parcels`, label: "Parcels", icon: Package },
    { to: `${base}/menu`, label: "Menu", icon: MenuIcon },
  ];
}

export function AppShell({ children, role }: { children: ReactNode; role: Role }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = navForRole(role);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950 text-zinc-50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Logo size="sm" />
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <MenuIcon className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col bg-card overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{profile?.full_name || "Account"}</SheetTitle>
              </SheetHeader>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                {profile?.staff_code && (
                  <div className="font-mono text-primary">{profile.staff_code}</div>
                )}
                <div>{profile?.email} · <span className="capitalize text-primary">{role.replace("_", " ")}</span></div>
              </div>
              <nav className="mt-6 space-y-1">
                {items.map((it) => (
                  <Link
                    key={it.to}
                    to={it.to}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-accent"
                  >
                    <it.icon className="h-4 w-4 text-primary" /> {it.label}
                  </Link>
                ))}
                {role === "rider" && (
                  <>
                    <Link to="/rider/waybill" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-accent">
                      <Package className="h-4 w-4 text-primary" /> Submit Pickup Waybill
                    </Link>
                    <Link to="/rider/pickups" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-accent">
                      <ListChecks className="h-4 w-4 text-primary" /> My Pickups
                    </Link>
                  </>
                )}
                {(role === "office" || role === "super_admin") && (
                  <>
                    <Link to="/office/bags" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-accent">
                      <Package className="h-4 w-4 text-primary" /> Bags
                    </Link>
                    <Link to="/office/pending" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-accent">
                      <ListChecks className="h-4 w-4 text-primary" /> Pending Waybills
                    </Link>
                    <Link to="/office/cod" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-accent">
                      <ListChecks className="h-4 w-4 text-primary" /> COD Reconciliation
                    </Link>
                  </>
                )}
                {role === "super_admin" && (
                  <>
                    <Link to="/admin/users" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-accent">
                      <Users className="h-4 w-4 text-primary" /> User Management
                    </Link>
                    <Link to="/admin/sites" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-accent">
                      <Package className="h-4 w-4 text-primary" /> Sites
                    </Link>
                    <Link to="/admin/audit" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-accent">
                      <ListChecks className="h-4 w-4 text-primary" /> Audit Log
                    </Link>
                    <Link to="/admin/reports" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-accent">
                      <ListChecks className="h-4 w-4 text-primary" /> Reports
                    </Link>
                  </>
                )}
                <Link to="/track" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-accent">
                  <Package className="h-4 w-4 text-primary" /> Track a parcel
                </Link>
                <button
                  onClick={handleSignOut}
                  className="mt-4 flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4">{children}</main>

      <ContactBanner />

      {role !== "rider" && <InstallPrompt />}

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-950 text-zinc-100">
        <div className="mx-auto grid max-w-5xl grid-cols-4">
          {items.map((it) => {
            const active = loc.pathname === it.to || (it.to !== "/" && loc.pathname.startsWith(it.to + "/"));
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-xs",
                  active ? "text-primary" : "text-zinc-400",
                )}
              >
                <it.icon className="h-5 w-5" />
                {it.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
