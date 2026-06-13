import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ScannerInput } from "@/components/ScannerInput";
import { SCAN_CONFIG, type ScanType, statusBadgeClass, canTransition, type ParcelStatus } from "@/lib/parcel-status";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ChevronLeft, Camera } from "lucide-react";
import { RiderPicker } from "@/components/RiderPicker";
import {
  promptWhatsApp,
  msgPickedUp,
  msgOFD,
  msgDelivered,
  msgException,
  msgRescheduled,
  msgCOD,
  genericStatusMsg,
} from "@/lib/whatsapp";
import { enqueueScan } from "@/lib/offline-queue";

interface Props {
  scanType: ScanType;
  backTo: string;
}

const EXCEPTION_TYPES = [
  "Customer Unreachable",
  "Wrong Address",
  "Refused Delivery",
  "Damaged Parcel",
  "Lost",
  "Rescheduled",
  "Other",
];

export function ScanScreen({ scanType, backTo }: Props) {
  const cfg = SCAN_CONFIG[scanType];
  const { user, role, profile } = useAuth();
  const navigate = useNavigate();
  const [last, setLast] = useState<{ ok: boolean; message: string; parcel?: any } | null>(null);
  const [bagInfo, setBagInfo] = useState<{ bag: string; from?: string; to?: string } | null>(null);
  const [pending, setPending] = useState<{ tracking: string; parcel: any } | null>(null);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [riderId, setRiderId] = useState<string | null>(null);
  const [excType, setExcType] = useState<string>("Other");
  const [excPhoto, setExcPhoto] = useState<File | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>("");

  const isOfficeOFD =
    scanType === "out_for_delivery" && (role === "super_admin" || role === "office");
  const isBagScan = ["vehicle_sealing", "departure", "arrival"].includes(scanType);

  /** Handle a bag-number scan. Updates bag + all parcels in it. */
  const handleBag = async (bagNumber: string) => {
    const { data: bag, error } = await supabase
      .from("bags")
      .select("id, bag_number, status, site_origin, site_destination")
      .eq("bag_number", bagNumber)
      .maybeSingle();
    if (error || !bag) {
      setLast({ ok: false, message: `Bag "${bagNumber}" not found.` });
      toast.error("Bag not found");
      return;
    }

    // Resolve site names for context panel + log notes
    const siteIds = [bag.site_origin, bag.site_destination].filter(Boolean) as string[];
    let fromName: string | undefined;
    let toName: string | undefined;
    if (siteIds.length) {
      const { data: sites } = await supabase
        .from("sites")
        .select("id, name, location")
        .in("id", siteIds);
      const fmt = (s: any) => (s ? `${s.name}${s.location ? ` (${s.location})` : ""}` : undefined);
      fromName = fmt((sites || []).find((s) => s.id === bag.site_origin));
      toName = fmt((sites || []).find((s) => s.id === bag.site_destination));
    }
    setBagInfo({ bag: bag.bag_number, from: fromName, to: toName });

    let bagStatus: "sealed" | "in_transit" | "arrived" | null = null;
    if (scanType === "vehicle_sealing") bagStatus = "sealed";
    else if (scanType === "departure") bagStatus = "in_transit";
    else if (scanType === "arrival") bagStatus = "arrived";

    const errors: string[] = [];
    if (bagStatus) {
      const r = await supabase.from("bags").update({ status: bagStatus }).eq("id", bag.id);
      if (r.error) errors.push(r.error.message);
    }
    const routeNote =
      fromName && toName
        ? scanType === "arrival"
          ? ` — ${toName} from ${fromName}`
          : ` — ${fromName} → ${toName}`
        : "";
    const r2 = await supabase
      .from("parcels")
      .update({ status: cfg.status, notes: `[${cfg.label}] Bag ${bag.bag_number}${routeNote}` })
      .eq("bag_id", bag.id);
    if (r2.error) errors.push(r2.error.message);
    const err = errors[0] ? { message: errors[0] } : null;
    if (err) {
      setLast({ ok: false, message: err.message });
      toast.error(err.message);
      return;
    }
    setLast({
      ok: true,
      message: `Bag ${bag.bag_number} → ${bagStatus ?? cfg.status}. All parcels updated.`,
    });
    toast.success(`Bag ${bag.bag_number} processed`);
    promptWhatsApp(
      `Bag ${bag.bag_number} → ${bagStatus ?? cfg.status}${routeNote}\nBy: ${profile?.full_name ?? "Staff"}`,
    );
  };

  const uploadExceptionPhoto = async (parcelId: string): Promise<string | null> => {
    if (!excPhoto) return null;
    const path = `${parcelId}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("exceptions").upload(path, excPhoto, {
      contentType: excPhoto.type || "image/jpeg",
      upsert: false,
    });
    if (error) {
      toast.error("Photo upload failed: " + error.message);
      return null;
    }
    return path;
  };

  const finalize = async (
    tracking: string,
    parcel: any,
    opts: { reason?: string; amount?: number; assignRider?: string | null },
  ) => {
    const isReschedule = scanType === "exception" && excType === "Rescheduled";
    const note = opts.reason
      ? `[${cfg.label}${scanType === "exception" ? `: ${excType}` : ""}] ${opts.reason}`
      : opts.amount !== undefined
        ? `[${cfg.label}] Collected: ${opts.amount}`
        : `[${cfg.label}]`;

    // For admin/office assigning rider from Created status, allow the transition
    const isAdminAssign = isOfficeOFD && opts.assignRider && parcel.status === "Created";
    const newStatus = isAdminAssign ? "Out for Delivery" : (isReschedule ? "Rescheduled" : cfg.status);

    const update: any = {
      status: newStatus,
      notes: note,
    };

    if (scanType === "delivered") {
      update.delivered_at = new Date().toISOString();
    }

    let photoPath: string | null = null;
    if (scanType === "exception") {
      photoPath = await uploadExceptionPhoto(parcel.id);
      if (photoPath) update.photo_url = photoPath;
      if (isReschedule && rescheduleDate) update.scheduled_date = rescheduleDate;
    }

    if (scanType === "out_for_delivery") {
      if (role === "rider" && user) update.assigned_rider_id = user.id;
      else if (isOfficeOFD && opts.assignRider) update.assigned_rider_id = opts.assignRider;
    }

    // Offline queue: if browser is offline, queue and exit early.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueScan({ parcelId: parcel.id, tracking, update });
      setLast({
        ok: true,
        message: `${tracking} queued offline — will sync when reconnected`,
        parcel: { ...parcel, status: update.status },
      });
      toast.success("Queued offline");
      return;
    }

    const { data, error } = await supabase
      .from("parcels")
      .update(update)
      .eq("id", parcel.id)
      .select("id, tracking_number, status, receiver_name, receiver_phone, assigned_rider_id")
      .single();

    if (error) {
      setLast({ ok: false, message: error.message });
      toast.error(error.message);
      return;
    }

    // COD reconciliation row on payment collection
    if (scanType === "payment" && opts.amount !== undefined && user) {
      await supabase.from("cod_reconciliation").insert({
        parcel_id: parcel.id,
        rider_id: user.id,
        amount_collected: opts.amount,
        status: "pending",
      });
    }

    setLast({ ok: true, message: `${data.tracking_number} → ${data.status}`, parcel: data });
    toast.success(`${data.tracking_number} updated to ${data.status}`);

    // WhatsApp prompts
    const riderName = profile?.full_name ?? "Rider";
    const tn = data.tracking_number;
    const rcv = data.receiver_name ?? "";
    if (scanType === "pickup") promptWhatsApp(msgPickedUp({ tracking: tn, rider: riderName, receiver: rcv }));
    else if (scanType === "out_for_delivery")
      promptWhatsApp(msgOFD({ tracking: tn, rider: riderName, receiver: rcv, phone: data.receiver_phone ?? "" }));
    else if (scanType === "delivered")
      promptWhatsApp(msgDelivered({ tracking: tn, receiver: rcv, rider: riderName }));
    else if (scanType === "exception" && !isReschedule)
      promptWhatsApp(msgException({ tracking: tn, type: excType, reason: opts.reason ?? "", staff: riderName }));
    else if (isReschedule)
      promptWhatsApp(msgRescheduled({ tracking: tn, date: rescheduleDate, reason: opts.reason ?? "", receiver: rcv }));
    else if (scanType === "payment" && opts.amount !== undefined)
      promptWhatsApp(msgCOD({ tracking: tn, amount: opts.amount, rider: riderName }));
    else
      promptWhatsApp(genericStatusMsg({ tracking: tn, status: data.status, receiver: rcv }));
  };

  const handle = async (code: string) => {
    // Bag-number flow for sealing/departure/arrival
    if (isBagScan && code.toUpperCase().startsWith("BAG-")) {
      await handleBag(code.toUpperCase());
      return;
    }

    const { data: parcel, error } = await supabase
      .from("parcels")
      .select(
        "id, tracking_number, external_tracking_number, carrier, is_external, status, receiver_name, assigned_rider_id, payment_type, amount",
      )
      .or(`tracking_number.eq.${code},external_tracking_number.eq.${code}`)
      .maybeSingle();

    if (error || !parcel) {
      setLast({ ok: false, message: `Tracking "${code}" not found.` });
      toast.error("Parcel not found");
      return;
    }

    if (role === "rider" && parcel.assigned_rider_id && parcel.assigned_rider_id !== user?.id) {
      setLast({
        ok: false,
        message: "This parcel is assigned to another rider — ask office to reassign.",
      });
      toast.error("Assigned to another rider");
      return;
    }

    // Preflight: prevent re-scans / invalid transitions (super_admin and office can override)
    const current = parcel.status as ParcelStatus;
    const target = cfg.status;
    const canOverride = role === "super_admin" || role === "office";

    if (!canOverride) {
      if (current === target) {
        const msg = `Already ${current} — cannot scan again.`;
        setLast({ ok: false, message: msg, parcel });
        toast.error(msg);
        return;
      }
      if (!canTransition(current, target)) {
        const msg = `Cannot move parcel from "${current}" to "${target}".`;
        setLast({ ok: false, message: msg, parcel });
        toast.error(msg);
        return;
      }
    }

    if (cfg.needsReason || cfg.needsAmount || isOfficeOFD) {
      setPending({ tracking: code, parcel });
      setReason("");
      setAmount(cfg.needsAmount ? String(parcel.amount ?? "") : "");
      setRiderId(parcel.assigned_rider_id ?? null);
      setExcType("Other");
      setExcPhoto(null);
      setRescheduleDate("");
      return;
    }
    await finalize(code, parcel, {});
  };

  const isReschedule = scanType === "exception" && excType === "Rescheduled";
  const confirmDisabled =
    (cfg.needsReason && !reason.trim()) ||
    (cfg.needsAmount && !amount.trim()) ||
    (isOfficeOFD && !riderId) ||
    (isReschedule && !rescheduleDate);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: backTo })}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl">{cfg.label}</h1>
          <p className="text-xs text-muted-foreground">
            Updates parcel to <span className="text-primary">{cfg.status}</span>
            {isBagScan && " · Scan a BAG-... number to process whole bag"}
          </p>
        </div>
      </div>

      <ScannerInput onScan={handle} />

      {bagInfo && isBagScan && (
        <Card className="border-primary/40 bg-primary/5 p-3 text-sm">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Bag {bagInfo.bag}
          </div>
          <div className="mt-1">
            {scanType === "arrival" ? (
              <>Arrived at <span className="font-medium text-primary">【{bagInfo.to || "—"}】</span> from <span className="font-medium">【{bagInfo.from || "—"}】</span></>
            ) : (
              <>From <span className="font-medium">【{bagInfo.from || "—"}】</span> heading to <span className="font-medium text-primary">【{bagInfo.to || "—"}】</span></>
            )}
          </div>
        </Card>
      )}

      {last && (
        <Card
          className={`border p-4 ${last.ok ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10"}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{last.ok ? "Success" : "Error"}</div>
              <div className="text-sm text-muted-foreground">{last.message}</div>
              {last.parcel?.receiver_name && (
                <div className="mt-1 text-xs">Receiver: {last.parcel.receiver_name}</div>
              )}
            </div>
            {last.parcel?.status && (
              <Badge className={statusBadgeClass(last.parcel.status)}>{last.parcel.status}</Badge>
            )}
          </div>
        </Card>
      )}

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isOfficeOFD
                ? "Assign rider"
                : scanType === "exception"
                  ? "Exception details"
                  : cfg.needsReason
                    ? "Reason required"
                    : "Amount collected"}
            </DialogTitle>
          </DialogHeader>
          {pending && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Parcel: <span className="font-mono">{pending.tracking}</span>
                {pending.parcel.is_external && pending.parcel.carrier && (
                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                    {pending.parcel.carrier}
                  </span>
                )}
              </div>
              {isOfficeOFD && <RiderPicker value={riderId} onChange={setRiderId} />}

              {scanType === "exception" && (
                <div>
                  <Label>Exception type</Label>
                  <Select value={excType} onValueChange={setExcType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXCEPTION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isReschedule && (
                <div>
                  <Label>New scheduled date</Label>
                  <Input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                  />
                </div>
              )}

              {cfg.needsReason && (
                <div>
                  <Label>Reason / details</Label>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
                </div>
              )}

              {scanType === "exception" && (
                <div>
                  <Label className="flex items-center gap-2">
                    <Camera className="h-4 w-4" /> Photo (optional)
                  </Label>
                  <Input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => setExcPhoto(e.target.files?.[0] ?? null)}
                  />
                  {excPhoto && (
                    <div className="mt-1 text-xs text-muted-foreground">{excPhoto.name}</div>
                  )}
                </div>
              )}

              {cfg.needsAmount && (
                <div>
                  <Label>Amount (KES)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={confirmDisabled}
              onClick={async () => {
                if (!pending) return;
                await finalize(pending.tracking, pending.parcel, {
                  reason: cfg.needsReason ? reason.trim() : undefined,
                  amount: cfg.needsAmount ? Number(amount) : undefined,
                  assignRider: isOfficeOFD ? riderId : undefined,
                });
                setPending(null);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}