import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LogOut, Users, FileText, ListChecks, Package, Building2,
  ShieldCheck, BarChart3, ShoppingBag, Truck,
} from "lucide-react";

export const Route = createFileRoute("/admin/menu")({
  component: () => (
    <RoleGuard allow={["super_admin"]}>
      <Menu />
    </RoleGuard>
  ),
});

const ITEMS = [
  { to: "/admin/parcels", label: "Parcels", icon: FileText },
  { to: "/admin/users", label: "User Management", icon: Users },
  { to: "/admin/sites", label: "Sites", icon: Building2 },
  { to: "/admin/audit", label: "Audit Log", icon: ShieldCheck },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/office/bags", label: "Bags", icon: Package },
  { to: "/office/pending", label: "Pending Waybills", icon: ListChecks },
  { to: "/office/cod", label: "COD Reconciliation", icon: ListChecks },
  { to: "/admin/alimall", label: "Alimall Integration", icon: ShoppingBag },
  { to: "/admin/dispatch", label: "Batch Dispatch", icon: Truck },
];

function Menu() {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Menu</h1>
      <Card className="border-border/60 bg-card p-4">
        <div className="text-lg">{profile?.full_name}</div>
        <div className="text-xs text-muted-foreground">
          {profile?.email} · <span className="capitalize text-primary">{role?.replace("_", " ")}</span>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ITEMS.map((it) => (
          <Link key={it.to} to={it.to}>
            <Card className="flex h-full flex-col items-center gap-2 border-border/60 bg-card p-4 text-center hover:border-primary/40">
              <it.icon className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium">{it.label}</span>
            </Card>
          </Link>
        ))}
      </div>

      <Button variant="outline" className="w-full" onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}