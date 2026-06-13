import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { downloadCSV } from "@/lib/csv";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/reports")({
  component: () => (<RoleGuard allow={["super_admin"]}><Reports /></RoleGuard>),
});

function Reports() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    let q = supabase.from("parcels").select("tracking_number, sender_name, receiver_name, status, payment_type, amount, created_at, assigned_rider_id");
    if (from) q = q.gte("created_at", new Date(from).toISOString());
    if (to) q = q.lte("created_at", new Date(to + "T23:59:59").toISOString());
    const { data } = await q.order("created_at", { ascending: false }).limit(1000);
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { run(); }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Reports</h1>
      <Card className="grid grid-cols-2 gap-3 border-border/60 bg-card p-4 sm:grid-cols-3">
        <div><Label className="mb-1.5 block">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label className="mb-1.5 block">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="flex items-end gap-2">
          <Button onClick={run} className="bg-primary text-primary-foreground hover:bg-primary/90">Run</Button>
          <Button variant="outline" onClick={() => downloadCSV(`parcels-${Date.now()}.csv`, items)}>Export CSV</Button>
        </div>
      </Card>
      {loading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (
        <Card className="overflow-x-auto border-border/60 bg-card p-3 text-xs">
          <table className="w-full">
            <thead><tr className="text-left text-muted-foreground">
              <th className="p-1">Tracking</th><th className="p-1">Receiver</th>
              <th className="p-1">Status</th><th className="p-1">Pay</th>
              <th className="p-1">Amount</th><th className="p-1">Created</th>
            </tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.tracking_number} className="border-t border-border/40">
                  <td className="p-1 font-mono">{p.tracking_number}</td>
                  <td className="p-1">{p.receiver_name}</td>
                  <td className="p-1">{p.status}</td>
                  <td className="p-1">{p.payment_type}</td>
                  <td className="p-1">{Number(p.amount).toFixed(2)}</td>
                  <td className="p-1">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-muted-foreground">{items.length} rows</div>
        </Card>
      )}
    </div>
  );
}
