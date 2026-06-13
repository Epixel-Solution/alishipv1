import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SitePicker } from "@/components/SitePicker";
import { toast } from "sonner";
import { Loader2, Package } from "lucide-react";

export const Route = createFileRoute("/office/bags/")({
  component: Bags,
});

function bagStatusBadgeClass(status: string) {
  switch (status) {
    case "open": return "bg-yellow-500/20 text-yellow-600";
    case "sealed": return "bg-primary/20 text-primary";
    case "in_transit": return "bg-blue-500/20 text-blue-600";
    case "arrived": return "bg-green-500/20 text-green-600";
    default: return "bg-muted";
  }
}

function Bags() {
  const navigate = useNavigate();
  const [bags, setBags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState<string | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bags")
      .select(`
        id, bag_number, status, created_at,
        origin:site_origin(id, name),
        destination:site_destination(id, name)
      `)
      .order("created_at", { ascending: false })
      .limit(100);
    setBags(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!origin || !destination) {
      toast.error("Select both origin and destination");
      return;
    }
    setCreating(true);

    const { data: numData } = await supabase.rpc("generate_bag_number");
    const bag_number = (numData as string) || `BAG-${Date.now()}`;
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("bags")
      .insert({
        bag_number,
        site_origin: origin,
        site_destination: destination,
        created_by: user?.id,
        status: "open",
      })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message);
      setCreating(false);
      return;
    }

    toast.success(`Bag ${bag_number} created`);
    navigate({ to: "/office/bags/$id", params: { id: data.id } });
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Bags Management</h1>
        <Package className="h-5 w-5 text-muted-foreground" />
      </div>

      <Card className="space-y-3 border-border/60 bg-card p-4">
        <h2 className="text-base text-primary">Create new bag</h2>
        <div>
          <Label className="mb-1.5 block">Origin site</Label>
          <SitePicker value={origin} onChange={setOrigin} />
        </div>
        <div>
          <Label className="mb-1.5 block">Destination site</Label>
          <SitePicker value={destination} onChange={setDestination} />
        </div>
        <Button onClick={create} disabled={creating} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create bag
        </Button>
      </Card>

      <h2 className="text-lg">Recent bags</h2>
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      ) : (
        <div className="space-y-2">
          {bags.map((b) => (
            <Link key={b.id} to="/office/bags/$id" params={{ id: b.id }} className="block">
              <Card className="flex items-center justify-between p-3 hover:border-primary/40 transition-colors cursor-pointer">
                <div>
                  <div className="font-mono text-sm">{b.bag_number}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {(b.origin as any)?.name || "?"} → {(b.destination as any)?.name || "?"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created: {new Date(b.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Badge className={bagStatusBadgeClass(b.status || "open")}>
                  {b.status || "open"}
                </Badge>
              </Card>
            </Link>
          ))}
          {bags.length === 0 && (
            <p className="text-sm text-muted-foreground">No bags yet. Create one above.</p>
          )}
        </div>
      )}
    </div>
  );
}