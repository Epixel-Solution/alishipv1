import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/office/cod")({
  component: () => (<RoleGuard allow={["office", "super_admin"]}><COD /></RoleGuard>),
});

function COD() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("cod_reconciliation")
      .select("id, parcel_id, rider_id, amount_collected, amount_remitted, status, created_at, parcels(tracking_number, receiver_name)")
      .order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setRemitted = async (id: string) => {
    const v = Number(edit[id] || 0);
    const { error } = await supabase.from("cod_reconciliation").update({
      amount_remitted: v, status: "remitted", remitted_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Remitted recorded");
    load();
  };

  const confirm = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("cod_reconciliation").update({
      status: "confirmed", confirmed_by: user?.id, confirmed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Confirmed");
    load();
  };

  const colorFor = (s: string) => s === "confirmed" ? "bg-success/20 text-success border-success/30"
    : s === "remitted" ? "bg-primary/20 text-primary border-primary/30"
    : "bg-warning/20 text-warning-foreground border-warning/30";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">COD Reconciliation</h1>
      {loading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : items.length === 0 ? (
        <Card className="border-border/60 bg-card p-4 text-sm text-muted-foreground">Nothing collected yet.</Card>
      ) : (
        <div className="space-y-2">
          {items.map((c) => {
            const variance = c.amount_remitted != null ? Number(c.amount_remitted) - Number(c.amount_collected) : null;
            return (
              <Card key={c.id} className="space-y-2 border-border/60 bg-card p-3">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs">{c.parcels?.tracking_number}</div>
                  <Badge className={colorFor(c.status)}>{c.status}</Badge>
                </div>
                <div className="text-sm">{c.parcels?.receiver_name}</div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><div className="text-xs text-muted-foreground">Collected</div>KES {Number(c.amount_collected).toFixed(2)}</div>
                  <div><div className="text-xs text-muted-foreground">Remitted</div>{c.amount_remitted != null ? `KES ${Number(c.amount_remitted).toFixed(2)}` : "—"}</div>
                  {variance != null && <div><div className="text-xs text-muted-foreground">Variance</div><span className={variance === 0 ? "" : "text-destructive"}>KES {variance.toFixed(2)}</span></div>}
                </div>
                {c.status === "pending" && (
                  <div className="flex gap-2">
                    <Input type="number" step="0.01" placeholder="Remitted KES"
                      value={edit[c.id] || ""}
                      onChange={(e) => setEdit({ ...edit, [c.id]: e.target.value })}
                    />
                    <Button onClick={() => setRemitted(c.id)} variant="outline">Mark remitted</Button>
                  </div>
                )}
                {c.status === "remitted" && (
                  <Button onClick={() => confirm(c.id)} className="bg-primary text-primary-foreground hover:bg-primary/90">Confirm receipt</Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
