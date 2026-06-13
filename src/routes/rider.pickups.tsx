import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle } from "lucide-react";
import { whatsappAdminUrl, msgRiderWaybill } from "@/lib/whatsapp";

export const Route = createFileRoute("/rider/pickups")({
  component: () => (<RoleGuard allow={["rider"]}><Pickups /></RoleGuard>),
});

function Pickups() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("parcels")
      .select("id, tracking_number, sender_name, sender_location, receiver_name, approval_status, notes, created_at")
      .eq("submitted_by_rider", true).eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false); });
  }, [user]);

  const colorFor = (s?: string) => s === "approved" ? "bg-success/20 text-success border-success/30"
    : s === "rejected" ? "bg-destructive/20 text-destructive border-destructive/30"
    : "bg-muted text-muted-foreground border-border";

  const sendWa = async (p: any) => {
    const url = await whatsappAdminUrl(
      msgRiderWaybill({
        rider: profile?.full_name || "Rider",
        tracking: p.tracking_number,
        pickup: p.sender_location || "",
      }),
    );
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">My Pickups</h1>
      {loading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : items.length === 0 ? (
        <Card className="border-border/60 bg-card p-4 text-sm text-muted-foreground">No submissions yet.</Card>
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <Card key={p.id} className="space-y-2 border-border/60 bg-card p-3">
              <div className="flex items-center justify-between">
                <div className="font-mono text-xs">{p.tracking_number}</div>
                <Badge className={colorFor(p.approval_status)}>{p.approval_status || "pending"}</Badge>
              </div>
              <div className="text-sm">{p.sender_name} → {p.receiver_name}</div>
              {p.approval_status === "rejected" && p.notes && (
                <div className="text-xs text-destructive">{p.notes}</div>
              )}
              {(p.approval_status ?? "pending") === "pending" && (
                <Button
                  size="sm"
                  className="w-full bg-[#25D366] text-white hover:bg-[#1ebd5a]"
                  onClick={() => sendWa(p)}
                >
                  <MessageCircle className="mr-2 h-4 w-4" /> Send to office on WhatsApp
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
