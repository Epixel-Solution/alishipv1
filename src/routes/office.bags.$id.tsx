import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Package, Truck, CheckCircle2, ArrowLeft, Scan, X } from "lucide-react";

export const Route = createFileRoute("/office/bags/$id")({
  component: () => (
    <RoleGuard allow={["office", "super_admin"]}>
      <BagDetail />
    </RoleGuard>
  ),
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

function BagDetail() {
  const { id } = useParams({ from: "/office/bags/$id" });
  const [bag, setBag] = useState<any>(null);
  const [parcels, setParcels] = useState<any[]>([]);
  const [tracking, setTracking] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    setLoading(true);

    const { data: b, error: bagError } = await supabase
      .from("bags")
      .select("*")
      .eq("id", id)
      .single();

    if (bagError) {
      console.error("Bag fetch error:", bagError);
      setLoading(false);
      return;
    }

    const { data: p, error: parcelsError } = await supabase
      .from("parcels")
      .select("id, tracking_number, receiver_name, status, receiver_location")
      .eq("bag_id", id);

    if (parcelsError) {
      console.error("Parcels fetch error:", parcelsError);
    }

    setBag(b);
    setParcels(p || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const addParcel = async () => {
    if (bag?.status !== "open") {
      toast.error("Cannot add parcels to a sealed or in-transit bag");
      return;
    }
    if (!tracking.trim()) return;

    const { data: parcel, error } = await supabase
      .from("parcels")
      .select("id, status, site_destination")
      .eq("tracking_number", tracking.trim())
      .maybeSingle();

    if (error || !parcel) {
      toast.error("Parcel not found");
      return;
    }

    const { error: updateErr } = await supabase
      .from("parcels")
      .update({ bag_id: id })
      .eq("id", parcel.id);

    if (updateErr) {
      toast.error(updateErr.message);
    } else {
      setTracking("");
      toast.success("Parcel added to bag");
      load();
    }
  };

  const removeParcel = async (pid: string, trackingNumber: string) => {
    if (bag?.status !== "open") {
      toast.error("Cannot remove parcels from a sealed or in-transit bag");
      return;
    }

    const { error } = await supabase
      .from("parcels")
      .update({ bag_id: null })
      .eq("id", pid);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Removed ${trackingNumber} from bag`);
      load();
    }
  };

  const updateBagStatus = async (status: "sealed" | "in_transit" | "arrived") => {
    setUpdating(true);

    const parcelStatusMap: Record<string, string> = {
      sealed: "Vehicle Sealed",
      in_transit: "Departed",
      arrived: "Arrived",
    };

    const parcelStatus = parcelStatusMap[status];

    const { error: bagError } = await supabase
      .from("bags")
      .update({ status })
      .eq("id", id);

    if (bagError) {
      toast.error(bagError.message);
      setUpdating(false);
      return;
    }

    if (parcelStatus && parcels.length > 0) {
      const { error: parcelError } = await supabase
        .from("parcels")
        .update({
          status: parcelStatus,
          notes: `[Bag ${bag?.bag_number}] ${parcelStatus}`,
        })
        .eq("bag_id", id);

      if (parcelError) {
        toast.warning("Bag updated but some parcels failed to update");
      } else {
        toast.success(`${parcels.length} parcels updated to ${parcelStatus}`);
      }
    }

    toast.success(`Bag ${status}`);
    setUpdating(false);
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!bag) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Bag not found</p>
        <Link to="/office/bags">
          <Button className="mt-4">Back to Bags</Button>
        </Link>
      </div>
    );
  }

  const canAddRemove = bag.status === "open";
  const canSeal = bag.status === "open";
  const canDepart = bag.status === "sealed";
  const canArrive = bag.status === "in_transit";

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <Link to="/office/bags">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> All Bags
          </Button>
        </Link>
      </div>

      {/* Bag header */}
      <Card className="border-border/60 bg-card p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="font-mono text-xl">{bag.bag_number}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {bag.site_origin || "?"} → {bag.site_destination || "?"}
            </div>
          </div>
          <Badge className={bagStatusBadgeClass(bag.status)}>
            {bag.status?.toUpperCase() || "OPEN"}
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {canSeal && (
            <Button
              onClick={() => updateBagStatus("sealed")}
              disabled={updating}
              className="bg-primary text-primary-foreground"
            >
              {updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
              Seal Bag
            </Button>
          )}
          {canDepart && (
            <Button
              onClick={() => updateBagStatus("in_transit")}
              disabled={updating}
              variant="outline"
            >
              {updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
              Departure
            </Button>
          )}
          {canArrive && (
            <Button
              onClick={() => updateBagStatus("arrived")}
              disabled={updating}
              variant="outline"
            >
              {updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Arrival
            </Button>
          )}
        </div>
      </Card>

      {/* Add parcel */}
      {canAddRemove && (
        <Card className="border-border/60 bg-card p-4">
          <h2 className="text-base text-primary mb-3">Add parcel to bag</h2>
          <div className="flex gap-2">
            <Input
              placeholder="Scan or enter tracking number"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addParcel(); } }}
              className="font-mono flex-1"
            />
            <Button
              onClick={addParcel}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Scan className="mr-2 h-4 w-4" /> Add
            </Button>
          </div>
        </Card>
      )}

      {/* Parcels list */}
      <div>
        <h2 className="text-lg mb-3">Parcels in bag ({parcels.length})</h2>
        {parcels.length === 0 ? (
          <Card className="border-border/60 bg-card p-8 text-center">
            <p className="text-muted-foreground">No parcels in this bag yet.</p>
            {canAddRemove && (
              <p className="text-xs text-muted-foreground mt-1">
                Scan parcels above to add them to this bag.
              </p>
            )}
          </Card>
        ) : (
          <div className="space-y-2">
            {parcels.map((p) => (
              <Card
                key={p.id}
                className="flex items-center justify-between border-border/60 bg-card p-3"
              >
                <div className="flex-1">
                  <div className="font-mono text-sm">{p.tracking_number}</div>
                  <div className="text-sm font-medium mt-1">{p.receiver_name}</div>
                  <div className="text-xs text-muted-foreground">{p.receiver_location}</div>
                  <Badge variant="outline" className="text-xs mt-1">{p.status}</Badge>
                </div>
                {canAddRemove && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeParcel(p.id, p.tracking_number)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}