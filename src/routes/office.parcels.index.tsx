import { createFileRoute, Link } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { statusBadgeClass, PARCEL_STATUSES } from "@/lib/parcel-status";

export const Route = createFileRoute("/office/parcels/")({
  component: () => (
    <RoleGuard allow={["office", "super_admin"]}>
      <ParcelsList />
    </RoleGuard>
  ),
});

function ParcelsList() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let qb = supabase.from("parcels").select("id, tracking_number, receiver_name, receiver_location, status, created_at").order("created_at", { ascending: false }).limit(200);
      if (status) qb = qb.eq("status", status as any);
      if (q.trim()) qb = qb.or(`tracking_number.ilike.%${q}%,receiver_name.ilike.%${q}%,sender_name.ilike.%${q}%`);
      const { data } = await qb;
      setItems(data || []);
      setLoading(false);
    })();
  }, [q, status]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Parcels</h1>
      <div className="flex gap-2">
        <Input placeholder="Search tracking #, sender, receiver…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-border bg-background px-3 text-sm">
          <option value="">All statuses</option>
          {PARCEL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <Card className="border-border/60 bg-card/60 p-6 text-center text-sm text-muted-foreground">No parcels found.</Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <Link key={p.id} to="/office/parcels/$id" params={{ id: p.id }}>
              <Card className="h-full border-border/60 bg-card p-3 transition-colors hover:border-primary/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs text-muted-foreground">{p.tracking_number}</div>
                    <div className="truncate text-sm font-medium">{p.receiver_name}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.receiver_location}</div>
                  </div>
                  <Badge className={statusBadgeClass(p.status)}>{p.status}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
