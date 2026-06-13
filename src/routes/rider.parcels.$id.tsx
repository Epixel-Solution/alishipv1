import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { statusBadgeClass } from "@/lib/parcel-status";
import {
  ChevronLeft, Phone, Navigation, MessageCircle,
  CheckCircle2, AlertTriangle, Undo2, Camera,
  Loader2, CreditCard, MapPin, Calendar, PackageCheck,
} from "lucide-react";
import { toast } from "sonner";
import { whatsappLinkForReceiver } from "@/lib/messaging";

const EXCEPTION_REASONS = [
  { value: "Customer Absent", label: "Customer Absent", reschedule: true },
  { value: "Refused Delivery", label: "Refused Delivery", reschedule: false },
  { value: "Wrong Address", label: "Wrong Address", reschedule: false },
  { value: "Cannot Locate Address", label: "Cannot Locate Address", reschedule: false },
  { value: "Rescheduled by Customer", label: "Rescheduled by Customer", reschedule: true },
  { value: "Stolen", label: "Stolen / Missing", reschedule: false },
  { value: "Damaged", label: "Damaged in Transit", reschedule: false },
  { value: "Wrong Recipient", label: "Delivered to Wrong Person", reschedule: false },
  { value: "Other", label: "Other", reschedule: false },
];

function buildGoogleMapsUrl(parcel: any): string {
  const addressParts = [
    parcel.receiver_nearest_location,
    parcel.receiver_town,
    parcel.receiver_subcounty,
    parcel.receiver_county,
  ].filter(Boolean);
  const fullAddress = addressParts.join(", ");
  if (fullAddress) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`;
  if (parcel.receiver_location) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(parcel.receiver_location)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parcel.receiver_county || "Nairobi")}`;
}

function normalizePhone(raw: string): string {
  let phone = raw.replace(/\s/g, "").replace(/^\+/, "");
  if (phone.startsWith("0")) phone = "254" + phone.slice(1);
  if (!phone.startsWith("254")) phone = "254" + phone;
  return phone;
}

// ─── Settlement type helpers ───────────────────────────────────────────────────
// Returns the total amount the rider needs to collect on delivery
function getCollectionAmount(parcel: any): number {
  const settlement = parcel.settlement_type;
  const freight = Number(parcel.actual_freight) || 0;
  const cod = Number(parcel.cod_amount) || 0;

  if (settlement === "freight_collect_cod") return freight + cod;
  if (settlement === "freight_collect") return freight;
  if (settlement === "cod") return cod;
  return 0;
}

// Returns true if rider needs to collect anything on delivery
function requiresOnDeliveryCollection(parcel: any): boolean {
  return ["freight_collect", "cod", "freight_collect_cod"].includes(parcel.settlement_type);
}

async function initiateMpesaPayment(
  parcelId: string,
  phone: string,
  amount: number,
  trackingNumber: string,
  settlementType: string
) {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(`${supabaseUrl}/functions/v1/mpesa-stk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      parcel_id: parcelId,
      phone,
      amount,
      tracking_number: trackingNumber,
      settlement_type: settlementType,
    }),
  });
  return response.json();
}

export const Route = createFileRoute("/rider/parcels/$id")({
  component: () => (
    <RoleGuard allow={["rider"]}>
      <RiderParcelDetail />
    </RoleGuard>
  ),
});

function RiderParcelDetail() {
  const { id } = useParams({ from: "/rider/parcels/$id" });
  const { user } = useAuth();
  const navigate = useNavigate();

  const [parcel, setParcel] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [working, setWorking] = useState(false);
  const [requestingPayment, setRequestingPayment] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState("");
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  // POD dialog
  const [pod, setPod] = useState<{ kind: "delivered" | "return_delivered" } | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Exception dialog
  const [exc, setExc] = useState(false);
  const [excReason, setExcReason] = useState("");
  const [excNotes, setExcNotes] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");

  // Polling — entirely ref-based
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    const { data: p } = await supabase
      .from("parcels")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setParcel(p);
    if (p) setPaymentPhone(p.payment_phone || p.receiver_phone || "");
    const { data: l } = await supabase
      .from("parcel_status_logs")
      .select("*")
      .eq("parcel_id", id)
      .order("created_at", { ascending: false });
    setLogs(l || []);
    return p;
  }, [id]);

  useEffect(() => {
    refresh();
    return () => stopPolling();
  }, [refresh, stopPolling]);

  const startPaymentPolling = useCallback((parcelId: string) => {
    stopPolling();

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const { data } = await supabase
          .from("parcels")
          .select("payment_status")
          .eq("id", parcelId)
          .maybeSingle();

        if (data?.payment_status === "completed") {
          stopPolling();
          await refresh();
          toast.success("✅ Payment confirmed! Now collect proof of delivery.");
          setPod({ kind: "delivered" });
        }
      } catch (err) {
        console.error("Payment poll error:", err);
      }
    }, 3000);

    pollingTimeoutRef.current = setTimeout(() => {
      stopPolling();
      toast.warning("Payment not confirmed after 3 minutes. Use 'Resend' to try again.");
    }, 180_000);
  }, [refresh, stopPolling]);

  if (!parcel) {
    return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  }

  const isMine = parcel.assigned_rider_id === user?.id;
  const needsCollection = requiresOnDeliveryCollection(parcel);
  const collectionAmount = getCollectionAmount(parcel);
  const isFreightCollect = parcel.settlement_type === "freight_collect";
  const isCOD = parcel.settlement_type === "cod";
  const isFreightCollectCOD = parcel.settlement_type === "freight_collect_cod";
  const isPaymentCompleted = parcel.payment_status === "completed";
  const isPaymentPending = parcel.payment_status === "pending";
  const isArrived = parcel.status === "Arrived";
  const isOutForDelivery = parcel.status === "Out for Delivery";
  const isDelivered = parcel.status === "Delivered" || parcel.status === "Return Delivered";
  const isRescheduled = parcel.status === "Rescheduled";
  const selectedExcReason = EXCEPTION_REASONS.find((r) => r.value === excReason);
  const canReschedule = selectedExcReason?.reschedule ?? false;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const updateStatus = async (status: any, extra: Record<string, any> = {}, label?: string) => {
    setWorking(true);
    const { error } = await supabase
      .from("parcels")
      .update({ status, notes: `[${label ?? status}]`, ...extra })
      .eq("id", parcel.id);
    setWorking(false);
    if (error) { toast.error(error.message); return false; }
    toast.success(`${parcel.tracking_number} → ${status}`);
    await refresh();
    return true;
  };

  const triggerSTK = async (phone: string) => {
    if (!needsCollection || collectionAmount <= 0) return;

    setRequestingPayment(true);
    try {
      const result = await initiateMpesaPayment(
        parcel.id,
        phone,
        collectionAmount,
        parcel.tracking_number,
        parcel.settlement_type
      );

      if (result.success) {
        await supabase
          .from("parcels")
          .update({ payment_phone: phone, payment_status: "pending" })
          .eq("id", parcel.id);
        await refresh();

        // Label the toast based on what's being collected
        let label = `KES ${collectionAmount.toLocaleString()}`;
        if (isFreightCollectCOD) {
          label += ` (KES ${Number(parcel.actual_freight).toLocaleString()} freight + KES ${Number(parcel.cod_amount).toLocaleString()} product)`;
        }
        toast.success(`M-Pesa prompt sent to ${phone} — ${label}`);
        startPaymentPolling(parcel.id);
      } else {
        toast.warning("STK push failed — enter phone manually");
        setShowPaymentDialog(true);
      }
    } catch {
      toast.warning("STK push failed — enter phone manually");
      setShowPaymentDialog(true);
    } finally {
      setRequestingPayment(false);
    }
  };

  const handleReactivateClick = async () => {
    await updateStatus("Out for Delivery", { scheduled_date: null }, "Re-activated for delivery");
  };

  const handleArrivedClick = async () => {
    const ok = await updateStatus("Arrived", {}, "Arrived at destination");
    if (!ok) return;

    // Trigger STK for any collect-on-delivery type
    if (needsCollection && collectionAmount > 0) {
      const phone = normalizePhone(parcel.receiver_phone || "");
      if (phone.length < 12) {
        toast.warning("Invalid receiver phone — enter manually");
        setShowPaymentDialog(true);
        return;
      }
      await triggerSTK(phone);
    }
  };

  const sendPaymentRequest = async () => {
    const phone = normalizePhone(paymentPhone);
    if (!phone || phone.length < 12) {
      toast.error("Enter a valid Safaricom number (e.g. 0712345678)");
      return;
    }
    setShowPaymentDialog(false);
    await triggerSTK(phone);
  };

  // ── POD ─────────────────────────────────────────────────────────────────────

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
    } else {
      setPhotoPreview(null);
    }
  };

  const closePOD = () => {
    setPod(null);
    setRecipientName("");
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const submitPOD = async () => {
    if (!pod) return;
    if (!recipientName.trim()) {
      toast.error("Enter the name of the person who received the parcel");
      return;
    }
    if (!photoFile) {
      toast.error("A photo of the recipient holding their ID is required");
      return;
    }
    if (needsCollection && !isPaymentCompleted && pod.kind === "delivered") {
      toast.error("Payment must be completed before confirming delivery");
      setShowPaymentDialog(true);
      return;
    }

    setWorking(true);
    try {
      const ext = photoFile.name.split(".").pop() || "jpg";
      const path = `${parcel.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("pod")
        .upload(path, photoFile, { upsert: false, contentType: photoFile.type });
      if (upErr) throw upErr;

      const status = pod.kind === "delivered" ? "Delivered" : "Return Delivered";
      const { error } = await supabase
        .from("parcels")
        .update({
          status,
          notes: `[${status}] received_by:${recipientName.trim()}`,
          pod_signature: recipientName.trim(),
          pod_photo_path: path,
          delivered_at: new Date().toISOString(),
        })
        .eq("id", parcel.id);
      if (error) throw error;

      toast.success(`✅ ${status} — ${parcel.tracking_number}`);
      closePOD();
      navigate({ to: "/rider" });
    } catch (e: any) {
      toast.error(e.message || "Failed to confirm delivery");
    } finally {
      setWorking(false);
    }
  };

  // ── Exception ────────────────────────────────────────────────────────────────

  const closeExc = () => {
    setExc(false);
    setExcReason("");
    setExcNotes("");
    setRescheduleDate("");
  };

  const submitException = async () => {
    if (!excReason) { toast.error("Select a reason"); return; }
    if (canReschedule && !rescheduleDate) { toast.error("Select a reschedule date"); return; }

    setWorking(true);
    const notes = `[Exception] ${excReason}${excNotes ? ` — ${excNotes}` : ""}`;
    const updateData: any = {
      notes,
      reschedule_reason: excReason,
      reschedule_count: (parcel.reschedule_count || 0) + (canReschedule ? 1 : 0),
    };

    if (!isDelivered) {
      if (canReschedule) {
        updateData.status = "Rescheduled";
        updateData.scheduled_date = rescheduleDate;
      } else {
        updateData.status = "Exception";
        updateData.assigned_rider_id = null;
      }
    }

    const { error } = await supabase.from("parcels").update(updateData).eq("id", parcel.id);
    setWorking(false);
    if (error) { toast.error(error.message); return; }

    toast.success(
      isDelivered
        ? "Issue reported — admin has been notified"
        : canReschedule
          ? `Rescheduled for ${rescheduleDate}`
          : "Exception logged"
    );
    closeExc();
    await refresh();
  };

  const waLink = whatsappLinkForReceiver({
    name: parcel.receiver_name,
    phone: parcel.receiver_phone,
    tracking: parcel.tracking_number,
  });

  // ── Collection label for UI ──────────────────────────────────────────────────
  const collectionLabel = isFreightCollectCOD
    ? `KES ${collectionAmount.toLocaleString()} (freight + product)`
    : isFreightCollect
      ? `KES ${collectionAmount.toLocaleString()} (freight)`
      : `KES ${collectionAmount.toLocaleString()} (product)`;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pb-24">

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/rider" })}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl">Parcel Details</h1>
      </div>

      {/* Info card */}
      <Card className="border-border/60 bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-xs text-muted-foreground">{parcel.tracking_number}</div>
            <div className="mt-1 text-base font-medium">{parcel.receiver_name}</div>
            <div className="text-sm text-muted-foreground">{parcel.receiver_location}</div>
            {parcel.receiver_nearest_location && (
              <div className="mt-1 text-sm flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                {parcel.receiver_nearest_location}
              </div>
            )}
            {isRescheduled && parcel.scheduled_date && (
              <div className="mt-1 text-xs flex items-center gap-1 text-amber-500">
                <Calendar className="h-3 w-3 shrink-0" />
                Rescheduled for {new Date(parcel.scheduled_date).toLocaleDateString()}
              </div>
            )}
          </div>
          <Badge className={statusBadgeClass(parcel.status)}>{parcel.status}</Badge>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <a href={`tel:${parcel.receiver_phone}`}>
            <Button variant="outline" size="sm" className="w-full"><Phone className="mr-1 h-3 w-3" /> Call</Button>
          </a>
          <a href={waLink} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="w-full"><MessageCircle className="mr-1 h-3 w-3" /> WhatsApp</Button>
          </a>
          <a href={buildGoogleMapsUrl(parcel)} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="w-full"><Navigation className="mr-1 h-3 w-3" /> Directions</Button>
          </a>
        </div>

        {/* ── Financial summary ── */}
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Settlement</div>
            <div className="font-medium capitalize">{(parcel.settlement_type || "").replace(/_/g, " ")}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Freight</div>
            <div>KES {Number(parcel.actual_freight || 0).toLocaleString()}</div>
          </div>

          {/* COD amount — show for cod and freight_collect_cod */}
          {(isCOD || isFreightCollectCOD) && (
            <div>
              <div className="text-xs text-muted-foreground">COD (Product Price)</div>
              <div className="font-bold text-primary">KES {Number(parcel.cod_amount || 0).toLocaleString()}</div>
            </div>
          )}

          {/* Combined collection amount for freight_collect_cod */}
          {isFreightCollectCOD && (
            <div>
              <div className="text-xs text-muted-foreground">Total to Collect</div>
              <div className="font-bold text-lg text-orange-500">KES {collectionAmount.toLocaleString()}</div>
            </div>
          )}

          {/* Single collection amount for freight_collect or cod */}
          {(isFreightCollect || isCOD) && !isFreightCollectCOD && (
            <div className="col-span-2">
              <div className="text-xs text-muted-foreground">
                {isFreightCollect ? "Collect from Receiver (Freight)" : "Collect from Receiver (Product)"}
              </div>
              <div className="font-bold text-lg text-primary">KES {collectionAmount.toLocaleString()}</div>
            </div>
          )}

          {/* Payment status when arrived */}
          {needsCollection && isArrived && (
            <div className="col-span-2">
              <div className="text-xs text-muted-foreground">Payment Status</div>
              <Badge
                variant={isPaymentCompleted ? "default" : "outline"}
                className={isPaymentCompleted ? "bg-green-600" : ""}
              >
                {isPaymentCompleted ? "Paid ✓" : isPaymentPending ? "⏳ Awaiting M-Pesa..." : "Not paid"}
              </Badge>
              {isPaymentPending && parcel.payment_phone && (
                <p className="text-xs text-muted-foreground mt-1">Prompt sent to: {parcel.payment_phone}</p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ── Active delivery actions ── */}
      {isMine && !isDelivered && (
        <Card className="border-border/60 bg-card p-4">
          <h2 className="mb-3 text-base font-medium">Actions</h2>
          <div className="space-y-2">

            {isRescheduled && (
              <>
                <div className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
                  Rescheduled{parcel.scheduled_date ? ` for ${new Date(parcel.scheduled_date).toLocaleDateString()}` : ""}. Tap below to start delivery.
                </div>
                <Button disabled={working} onClick={handleReactivateClick} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
                  Start Delivery
                </Button>
                <Button disabled={working} variant="outline" className="w-full border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setExc(true)}>
                  <AlertTriangle className="mr-2 h-4 w-4" /> Log Exception
                </Button>
              </>
            )}

            {isOutForDelivery && (
              <Button disabled={working || requestingPayment} onClick={handleArrivedClick} className="w-full bg-blue-600 text-white hover:bg-blue-700">
                {(working || requestingPayment) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                Arrived at Destination
              </Button>
            )}

            {/* Payment request button — shown for all collect-on-delivery types when arrived and not yet paid */}
            {isArrived && needsCollection && !isPaymentCompleted && (
              <>
                <Button
                  disabled={working || requestingPayment}
                  onClick={() => { setPaymentPhone(parcel.payment_phone || parcel.receiver_phone || ""); setShowPaymentDialog(true); }}
                  className="w-full bg-amber-500 text-white hover:bg-amber-600"
                >
                  {requestingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                  {isPaymentPending ? "Resend M-Pesa Request" : "Request M-Pesa Payment"}
                </Button>
                <div className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
                  {isPaymentPending
                    ? `⏳ Waiting for payment from ${parcel.payment_phone || "customer"}…`
                    : `Send M-Pesa prompt to receiver for ${collectionLabel}.`}
                </div>
              </>
            )}

            {isArrived && needsCollection && isPaymentCompleted && (
              <div className="rounded-md bg-green-500/10 px-3 py-2 text-xs text-green-600">
                ✅ Payment confirmed — {collectionLabel}
              </div>
            )}

            {/* Confirm delivery — available when no collection needed OR payment done */}
            {isArrived && (!needsCollection || isPaymentCompleted) && (
              <Button disabled={working} onClick={() => setPod({ kind: "delivered" })} className="w-full bg-green-600 text-white hover:bg-green-700">
                {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Confirm Delivery
              </Button>
            )}

            {(isOutForDelivery || isArrived) && (
              <Button disabled={working} variant="outline" className="w-full" onClick={() => setPod({ kind: "return_delivered" })}>
                <Undo2 className="mr-2 h-4 w-4" /> Return Delivery
              </Button>
            )}

            {(isOutForDelivery || isArrived) && (
              <Button disabled={working} variant="outline" className="w-full border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setExc(true)}>
                <AlertTriangle className="mr-2 h-4 w-4" /> Log Exception
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* ── Delivered confirmation card ── */}
      {isDelivered && (
        <Card className="border-green-500/30 bg-green-500/5 p-4 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-green-500" />
          <p className="mt-2 font-medium text-green-600">{parcel.status}</p>
          {parcel.delivered_at && (
            <p className="text-xs text-muted-foreground mt-1">{new Date(parcel.delivered_at).toLocaleString()}</p>
          )}
        </Card>
      )}

      {/* ── Post-delivery issue reporting ── */}
      {isDelivered && isMine && (
        <Card className="border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="mb-1 text-base font-medium text-amber-700">Report an Issue</h2>
          <p className="text-xs text-muted-foreground mb-3">
            If there is a problem with this delivery (stolen, damaged, wrong recipient), report it immediately so admin can investigate.
          </p>
          <Button
            disabled={working}
            variant="outline"
            className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => setExc(true)}
          >
            <AlertTriangle className="mr-2 h-4 w-4" /> Report Post-Delivery Issue
          </Button>
        </Card>
      )}

      {/* Timeline */}
      <Card className="border-border/60 bg-card p-4">
        <h2 className="mb-3 text-base font-medium">Timeline</h2>
        <div className="space-y-2">
          {logs.length === 0 && <p className="text-xs text-muted-foreground">No history yet.</p>}
          {logs.map((l) => (
            <div key={l.id} className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0">
              <div>
                <div className="text-sm">{l.status}</div>
                {l.notes && <div className="text-xs text-muted-foreground">{l.notes}</div>}
              </div>
              <div className="text-xs text-muted-foreground shrink-0 ml-2">{new Date(l.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Payment Dialog ── */}
      <Dialog open={showPaymentDialog} onOpenChange={(o) => !o && setShowPaymentDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isPaymentPending ? "Resend M-Pesa Request" : "Request Payment"}</DialogTitle>
            <DialogDescription>
              {isFreightCollectCOD
                ? `Send one M-Pesa prompt for KES ${collectionAmount.toLocaleString()} (KES ${Number(parcel.actual_freight).toLocaleString()} freight + KES ${Number(parcel.cod_amount).toLocaleString()} product price)`
                : isFreightCollect
                  ? `Send M-Pesa prompt for KES ${collectionAmount.toLocaleString()} (freight)`
                  : `Send M-Pesa prompt for KES ${collectionAmount.toLocaleString()} (product price)`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Amount summary */}
            <div className="rounded-md bg-primary/5 p-3 text-center">
              <div className="text-xs text-muted-foreground">Total to collect</div>
              <div className="text-2xl font-bold text-primary">KES {collectionAmount.toLocaleString()}</div>
              {isFreightCollectCOD && (
                <div className="mt-1 text-xs text-muted-foreground">
                  KES {Number(parcel.actual_freight).toLocaleString()} freight + KES {Number(parcel.cod_amount).toLocaleString()} product
                </div>
              )}
            </div>

            <div>
              <Label>Waybill Phone</Label>
              <Input value={parcel?.receiver_phone || ""} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground mt-1">Phone on the waybill</p>
            </div>
            <div>
              <Label>Payment Phone</Label>
              <Input
                placeholder="e.g. 0712345678"
                value={paymentPhone}
                onChange={(e) => setPaymentPhone(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">Change if receiver is paying from a different number</p>
            </div>
            {paymentPhone && paymentPhone !== parcel?.receiver_phone && (
              <div className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-600">
                ⚠️ Prompt goes to: {normalizePhone(paymentPhone)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Cancel</Button>
            <Button onClick={sendPaymentRequest} disabled={requestingPayment || !paymentPhone}>
              {requestingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CreditCard className="mr-2 h-4 w-4" />
              {isPaymentPending ? "Resend Prompt" : "Send Prompt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── POD Dialog ── */}
      <Dialog open={!!pod} onOpenChange={(o) => { if (!o) closePOD(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pod?.kind === "delivered" ? "Confirm Delivery" : "Confirm Return"}</DialogTitle>
            <DialogDescription>
              {pod?.kind === "delivered"
                ? needsCollection && isPaymentCompleted
                  ? `Payment of ${collectionLabel} confirmed ✓ — collect proof below.`
                  : "Collect proof of delivery before confirming."
                : "Confirm this parcel is being returned to the hub."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block">
                Recipient name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Full name of person who received"
              />
            </div>

            <div>
              <Label className="mb-1.5 block">
                <span className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Photo — recipient holding ID <span className="text-destructive">*</span>
                </span>
              </Label>
              <Input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
              />
              {photoPreview && (
                <div className="mt-2 overflow-hidden rounded-md border border-border">
                  <img src={photoPreview} alt="POD preview" className="max-h-48 w-full object-cover" />
                </div>
              )}
              {!photoFile && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Take a photo of the recipient holding a valid ID.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closePOD}>Cancel</Button>
            <Button
              disabled={working || !recipientName.trim() || !photoFile}
              onClick={submitPOD}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {working && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pod?.kind === "delivered" ? "Complete Delivery" : "Confirm Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Exception Dialog ── */}
      <Dialog open={exc} onOpenChange={(o) => !o && closeExc()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isDelivered ? "Report Post-Delivery Issue" : "Log Exception"}</DialogTitle>
            <DialogDescription>
              {isDelivered
                ? "Report any issue after delivery. This will be flagged for admin review."
                : "What happened with this delivery?"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Reason</Label>
              <Select value={excReason} onValueChange={setExcReason}>
                <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
                <SelectContent>
                  {EXCEPTION_REASONS
                    .filter((r) => isDelivered ? !r.reschedule : true)
                    .map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {canReschedule && !isDelivered && (
              <div>
                <Label className="mb-1.5 block flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Reschedule Date
                </Label>
                <Input type="date" min={minDate} value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Parcel stays assigned to you on this date.</p>
              </div>
            )}

            {excReason && !canReschedule && !isDelivered && (
              <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                ⚠️ Parcel will be returned to admin queue for reassignment.
              </div>
            )}

            {isDelivered && excReason && (
              <div className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-600">
                ⚠️ This report will be sent to admin for investigation. Delivery status will not change.
              </div>
            )}

            <div>
              <Label className="mb-1.5 block">Additional notes (optional)</Label>
              <Textarea rows={2} value={excNotes} onChange={(e) => setExcNotes(e.target.value)} placeholder="Any extra details..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeExc}>Cancel</Button>
            <Button
              disabled={!excReason || (canReschedule && !rescheduleDate && !isDelivered) || working}
              onClick={submitException}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {working && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDelivered ? "Submit Report" : canReschedule ? "Reschedule" : "Log Exception"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}