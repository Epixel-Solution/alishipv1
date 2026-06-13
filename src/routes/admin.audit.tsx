import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { downloadCSV } from "@/lib/csv";

export const Route = createFileRoute("/admin/audit")({
  component: () => (<RoleGuard allow={["super_admin"]}><Audit /></RoleGuard>),
});

function Audit() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    supabase.from("audit_logs")
      .select("id, action, entity, entity_id, performed_by, timestamp, new_value, old_value")
      .order("timestamp", { ascending: false }).limit(500)
      .then(({ data }) => { setItems(data || []); setLoading(false); });
  }, []);

  const filtered = items.filter((it) =>
    !filter || it.entity.includes(filter) || it.action.includes(filter)
    || (it.entity_id || "").includes(filter)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Audit Log</h1>
        <Button variant="outline" onClick={() => downloadCSV("audit-logs.csv", filtered.map(i => ({
          timestamp: i.timestamp, entity: i.entity, action: i.action,
          entity_id: i.entity_id, performed_by: i.performed_by,
        })))}>Export CSV</Button>
      </div>
      <Input placeholder="Filter by entity / action / id" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {loading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (
        <div className="space-y-1">
          {filtered.map((i) => (
            <Card key={i.id} className="flex items-center justify-between border-border/60 bg-card p-2 text-xs">
              <div className="space-y-0.5">
                <div className="font-mono">{i.entity}.{i.action}</div>
                <div className="text-muted-foreground">{i.entity_id}</div>
              </div>
              <div className="text-right text-muted-foreground">{new Date(i.timestamp).toLocaleString()}</div>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">No matches.</p>}
        </div>
      )}
    </div>
  );
}
