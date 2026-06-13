import { createFileRoute, Link } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, ExternalLink } from "lucide-react";
import { statusBadgeClass } from "@/lib/parcel-status";

export const Route = createFileRoute("/admin/alimall")({
  component: () => (
    <RoleGuard allow={["super_admin"]}>
      <AlimallPage />
    </RoleGuard>
  ),
});

function AlimallPage() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("parcels")
        .select("id, tracking_number, external_order_ref, external_source, status, receiver_name, receiver_location, created_at")
        .not("external_order_ref", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);
      setItems(data || []);
    })();
  }, []);

  const filtered = items.filter(
    (p) =>
      !q.trim() ||
      (p.external_order_ref || "").toLowerCase().includes(q.toLowerCase()) ||
      (p.tracking_number || "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="-mx-4 -mt-4 bg-zinc-950 px-4 pb-6 pt-5 text-zinc-50 sm:rounded-b-2xl">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold">Alimall Integration</h1>
        </div>
        <p className="text-sm text-zinc-400">
          Parcels linked to Alimall (or other external) order numbers. Customers can track using the order number on the public Track page.
        </p>
      </div>

      <Card className="border-border/60 bg-card p-4 text-sm">
        <div className="font-medium">How it works</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>External systems (e.g. Alimall) write the <code className="rounded bg-muted px-1">external_order_ref</code> on a parcel when it&apos;s created.</li>
          <li>Public tracking accepts <em>tracking number</em>, <em>carrier tracking</em>, OR <em>order number</em>.</li>
          <li>To wire up incoming orders, add a webhook endpoint at <code className="rounded bg-muted px-1">/api/public/alimall</code> that creates a parcel with the order ref.</li>
        </ul>
      </Card>

      <Input placeholder="Search by order # or waybill" value={q} onChange={(e) => setQ(e.target.value)} />

      {filtered.length === 0 ? (
        <Card className="border-border/60 bg-card/60 p-6 text-center text-sm text-muted-foreground">
          No linked Alimall orders yet.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link key={p.id} to="/admin/parcels/$id" params={{ id: p.id }}>
              <Card className="h-full border-border/60 bg-card p-3 hover:border-primary/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <ExternalLink className="h-3 w-3" />
                      <span className="font-mono">{p.external_order_ref}</span>
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">{p.tracking_number}</div>
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
