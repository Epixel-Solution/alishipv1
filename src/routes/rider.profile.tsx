import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, Lock, Phone, Mail, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { ALISHIP_CONTACT } from "@/lib/contact";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/rider/profile")({
  component: () => (
    <RoleGuard allow={["rider"]}>
      <Profile />
    </RoleGuard>
  ),
});

interface PerfStats {
  delivered7: number;
  delivered30: number;
  exception30: number;
  onTimeRate: number; // 0-100
  codCollected30: number;
  codRemitted30: number;
  shifts30: number;
}

function Profile() {
  const { profile, signOut, role, user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<PerfStats | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const now = Date.now();
      const d7 = new Date(now - 7 * 86400_000).toISOString();
      const d30 = new Date(now - 30 * 86400_000).toISOString();
      const [{ data: del7 }, { data: del30 }, { data: exc30 }, { data: cod30 }, { data: shifts30 }] = await Promise.all([
        supabase.from("parcels").select("id").eq("assigned_rider_id", user.id).eq("status", "Delivered").gte("updated_at", d7),
        supabase.from("parcels").select("id, delivered_at, scheduled_date, created_at").eq("assigned_rider_id", user.id).eq("status", "Delivered").gte("updated_at", d30),
        supabase.from("parcels").select("id").eq("assigned_rider_id", user.id).eq("status", "Exception").gte("updated_at", d30),
        supabase.from("cod_reconciliation").select("amount_collected, amount_remitted, status, created_at").eq("rider_id", user.id).gte("created_at", d30),
        supabase.from("rider_shifts").select("id").eq("rider_id", user.id).gte("started_at", d30),
      ]);

      // On-time: delivered_at <= end of scheduled_date if scheduled, else delivered within 48h of created_at.
      let onTime = 0; let total = 0;
      for (const p of del30 || []) {
        total++;
        const delivered = p.delivered_at ? new Date(p.delivered_at).getTime() : null;
        if (!delivered) continue;
        if (p.scheduled_date) {
          const end = new Date(p.scheduled_date).getTime() + 86400_000;
          if (delivered <= end) onTime++;
        } else if (p.created_at) {
          if (delivered - new Date(p.created_at).getTime() <= 48 * 3600_000) onTime++;
        }
      }
      const onTimeRate = total ? Math.round((onTime / total) * 100) : 0;

      const codCollected30 = (cod30 || []).reduce((s, r) => s + Number(r.amount_collected || 0), 0);
      const codRemitted30 = (cod30 || []).filter((r) => r.status === "confirmed").reduce((s, r) => s + Number(r.amount_remitted || 0), 0);

      setStats({
        delivered7: (del7 || []).length,
        delivered30: (del30 || []).length,
        exception30: (exc30 || []).length,
        onTimeRate,
        codCollected30,
        codRemitted30,
        shifts30: (shifts30 || []).length,
      });
    })();
  }, [user]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Profile</h1>

      <Card className="border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
        {profile?.staff_code && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1">
            <span className="font-mono text-xs font-bold text-primary">{profile.staff_code}</span>
            <span className="text-[10px] uppercase tracking-wider text-primary/80">Rider ID</span>
          </div>
        )}
        <Field label="Name" value={profile?.full_name || "—"} />
        <Field label="Email" value={profile?.email || "—"} />
        {profile?.phone && <Field label="Phone" value={profile.phone} />}
        <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">Role</div>
        <div className="capitalize text-primary">{role}</div>
      </Card>

      <Card className="border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Performance (last 30 days)</h2>
        </div>
        {!stats ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Delivered (7d)" value={stats.delivered7} />
            <Stat label="Delivered (30d)" value={stats.delivered30} />
            <Stat label="On-time rate" value={`${stats.onTimeRate}%`} />
            <Stat label="Exceptions (30d)" value={stats.exception30} />
            <Stat label="COD collected" value={`KES ${stats.codCollected30.toLocaleString()}`} small />
            <Stat label="COD remitted" value={`KES ${stats.codRemitted30.toLocaleString()}`} small />
            <Stat label="Shifts worked" value={stats.shifts30} />
          </div>
        )}
      </Card>

      <Card className="border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Lock className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">Password</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Riders can't change their password from the app. Contact your Super Admin to request a reset.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => toast.error("You are not authorized to perform this action.")}
            >
              Change password
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Need help?</div>
        <div className="mt-2 space-y-1.5 text-sm">
          <a href={`tel:${ALISHIP_CONTACT.phones[0].replace(/\s/g, "")}`} className="flex items-center gap-2 hover:text-primary">
            <Phone className="h-4 w-4 text-primary" /> {ALISHIP_CONTACT.phones[0]}
          </a>
          <a href={`tel:${ALISHIP_CONTACT.phones[1].replace(/\s/g, "")}`} className="flex items-center gap-2 hover:text-primary">
            <Phone className="h-4 w-4 text-primary" /> {ALISHIP_CONTACT.phones[1]}
          </a>
          <a href={`mailto:${ALISHIP_CONTACT.email}`} className="flex items-center gap-2 hover:text-primary">
            <Mail className="h-4 w-4 text-primary" /> {ALISHIP_CONTACT.email}
          </a>
        </div>
      </Card>

      <Button
        variant="outline"
        className="w-full"
        onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
      >
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mb-2">{value}</div>
    </>
  );
}

function Stat({ label, value, small }: { label: string; value: number | string; small?: boolean }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/50 p-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-heading font-bold text-primary ${small ? "text-sm" : "text-lg"}`}>{value}</div>
    </div>
  );
}
