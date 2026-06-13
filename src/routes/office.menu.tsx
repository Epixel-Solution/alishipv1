import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, Users, FileText, Truck } from "lucide-react";

export const Route = createFileRoute("/office/menu")({
  component: () => (
    <RoleGuard allow={["office", "super_admin"]}>
      <Menu />
    </RoleGuard>
  ),
});

function Menu() {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Menu</h1>
      <Card className="border-border/60 bg-card p-4">
        <div className="text-lg">{profile?.full_name}</div>
        <div className="text-xs text-muted-foreground">{profile?.email} · <span className="capitalize text-primary">{role?.replace("_", " ")}</span></div>
      </Card>
      <Link to="/office/parcels"><Card className="flex items-center gap-3 border-border/60 bg-card p-4 hover:border-primary/40"><FileText className="h-5 w-5 text-primary" /> Parcels</Card></Link>
      <Link to="/office/dispatch"><Card className="flex items-center gap-3 border-border/60 bg-card p-4 hover:border-primary/40"><Truck className="h-5 w-5 text-primary" /> Batch Dispatch</Card></Link>
      {role === "super_admin" && (
        <Link to="/admin/users"><Card className="flex items-center gap-3 border-border/60 bg-card p-4 hover:border-primary/40"><Users className="h-5 w-5 text-primary" /> User Management</Card></Link>
      )}
      <Button variant="outline" className="w-full" onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}