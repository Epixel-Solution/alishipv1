import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { promptWhatsApp, msgWaybillCreated } from "@/lib/whatsapp";

export const Route = createFileRoute("/office/pending")({
  component: () => (<RoleGuard allow={["office", "super_admin"]}><Pending /></RoleGuard>),
});

function Pending() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reject, setReject] = useState<{ id: string; tracking: string } | null>(null);
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("parcels")
      .select("id, tracking_number, sender_name, sender_phone, sender_location, receiver_name, receiver_phone, receiver_location, description, weight, quantity, payment_type, amount, created_at, created_by")
      .eq("submitted_by_rider", true)
      .eq("approval_status", "pending")
      .order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const approve = async (p: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("parcels").update({
      approval_status: "approved", approved_by: user?.id,
    }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Approved");
    promptWhatsApp(msgWaybillCreated({
      tracking: p.tracking_number, sender: p.sender_name, receiver: p.receiver_name,
    }));
    load();
  };

  const submitReject = async () => {
    if (!reject || !reason.trim()) return;
    const { error } = await supabase.from("parcels").update({
      approval_status: "rejected", notes: `Rejected: ${reason.trim()}`,
    }).eq("id", reject.id);
    if (error) return toast.error(error.message);
    toast.success("Rejected");
    setReject(null); setReason("");
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Pending Waybills</h1>
      {loading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : items.length === 0 ? (
        <Card className="border-border/60 bg-card p-4 text-sm text-muted-foreground">Nothing pending.</Card>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <Card key={p.id} className="space-y-2 border-border/60 bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="font-mono text-xs">{p.tracking_number}</div>
                <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><div className="text-xs text-muted-foreground">Sender</div>{p.sender_name} · {p.sender_phone}</div>
                <div><div className="text-xs text-muted-foreground">Receiver</div>{p.receiver_name} · {p.receiver_phone}</div>
                <div className="col-span-2"><div className="text-xs text-muted-foreground">Pickup</div>{p.sender_location}</div>
                <div className="col-span-2"><div className="text-xs text-muted-foreground">Drop-off</div>{p.receiver_location}</div>
                <div><div className="text-xs text-muted-foreground">Description</div>{p.description || "—"}</div>
                <div><div className="text-xs text-muted-foreground">Payment</div>{p.payment_type.toUpperCase()} · KES {p.amount}</div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => approve(p)} className="bg-primary text-primary-foreground hover:bg-primary/90">Approve</Button>
                <Button variant="outline" onClick={() => setReject({ id: p.id, tracking: p.tracking_number })}>Reject</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!reject} onOpenChange={(o) => !o && setReject(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject {reject?.tracking}</DialogTitle></DialogHeader>
          <div>
            <Label className="mb-1.5 block">Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReject(null)}>Cancel</Button>
            <Button variant="destructive" onClick={submitReject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
