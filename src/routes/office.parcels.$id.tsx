import { createFileRoute, useParams, useSearch, Link } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusBadgeClass } from "@/lib/parcel-status";
import { Printer, ChevronLeft, MapPin, Copy, Check, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ALISHIP_CONTACT } from "@/lib/contact";
import {
  DELIVERY_TYPE_LABEL,
  GOODS_TYPE_LABEL,
  PRODUCT_SERVICE_LABEL,
  SETTLEMENT_TYPE_LABEL,
  SERVICE_CLASS_LABEL,
} from "@/lib/waybill-options";
import { z } from "zod";
import alishipLogo from "@/assets/aliship-logo.png";

export const Route = createFileRoute("/office/parcels/$id")({
  validateSearch: z.object({ print: z.coerce.number().optional() }),
  component: () => (
    <RoleGuard allow={["office", "super_admin"]}>
      <ParcelDetail />
    </RoleGuard>
  ),
});

function buildGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

// ─── Settlement helpers ────────────────────────────────────────────────────────
function getSettlementBreakdown(parcel: any): {
  showFreight: boolean;
  showCOD: boolean;
  showCombined: boolean;
  freight: number;
  cod: number;
  combined: number;
  freightLabel: string;
} {
  const s = parcel.settlement_type;
  const freight = Number(parcel.actual_freight || 0);
  const cod = Number(parcel.cod_amount || 0);

  switch (s) {
    case "freight_collect_cod":
      return { showFreight: true, showCOD: true, showCombined: true, freight, cod, combined: freight + cod, freightLabel: "Freight (collect on delivery)" };
    case "freight_collect":
      return { showFreight: true, showCOD: false, showCombined: false, freight, cod: 0, combined: freight, freightLabel: "Freight (collect on delivery)" };
    case "cod":
      return { showFreight: false, showCOD: true, showCombined: false, freight: 0, cod, combined: cod, freightLabel: "Freight" };
    case "cash_at_office":
    case "prepaid":
    default:
      // Paid upfront — don't show freight on the waybill print
      return { showFreight: false, showCOD: false, showCombined: false, freight, cod: 0, combined: freight, freightLabel: "Freight" };
  }
}

// ─── Copy Messages ─────────────────────────────────────────────────────────────
function CopyMessages({ parcel }: { parcel: any }) {
  const [copiedSender, setCopiedSender] = useState(false);
  const [copiedReceiver, setCopiedReceiver] = useState(false);

  const receiverFirstName = parcel.receiver_name?.split(" ")[0] || parcel.receiver_name;
  const area = parcel.receiver_town || parcel.receiver_subcounty || "";
  const county = parcel.receiver_county || "";

  const { showFreight, showCOD, showCombined, freight, cod, combined } = getSettlementBreakdown(parcel);

  let amountLine = "";
  if (showCombined) {
    amountLine = `COD KSh ${cod.toLocaleString()} + Freight KSh ${freight.toLocaleString()} = KSh ${combined.toLocaleString()} (M-Pesa on delivery)`;
  } else if (showCOD) {
    amountLine = `COD KSh ${cod.toLocaleString()} (M-Pesa on delivery)`;
  } else if (showFreight && parcel.settlement_type === "freight_collect") {
    amountLine = `Freight KSh ${freight.toLocaleString()} (paid on delivery)`;
  } else {
    amountLine = `Paid KSh ${freight.toLocaleString()}`;
  }

  const isPickup = parcel.delivery_type === "pickup";

  const senderMsg = `✅ Shipment booked!
Tracking No: ${parcel.tracking_number}
To: ${receiverFirstName}
Destination: ${area}, ${county}
${amountLine}
Bring your ID during collection.
Track your parcel on our portal using the tracking number above.`;

  const receiverMsg = isPickup
    ? `📦 A package has been booked for you!
Tracking No: ${parcel.tracking_number}
Collect at: Our branch
Bring your National ID during collection.
Track your parcel on our portal using the tracking number above.`
    : `📦 A package has been booked for you!
Tracking No: ${parcel.tracking_number}
Delivery to: ${area}, ${county}
Bring your National ID during collection.
Track your parcel on our portal using the tracking number above.`;

  const copy = (text: string, which: "sender" | "receiver") => {
    navigator.clipboard.writeText(text).then(() => {
      if (which === "sender") {
        setCopiedSender(true);
        setTimeout(() => setCopiedSender(false), 2000);
      } else {
        setCopiedReceiver(true);
        setTimeout(() => setCopiedReceiver(false), 2000);
      }
    });
  };

  return (
    <Card className="no-print border-border/60 bg-card p-4 space-y-3">
      <h2 className="text-base text-primary">Copy messages</h2>
      <div className="rounded-md border border-border/50 bg-muted/40 p-3 text-xs font-mono whitespace-pre-wrap text-foreground">
        {senderMsg}
      </div>
      <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => copy(senderMsg, "sender")}>
        {copiedSender ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        {copiedSender ? "Copied!" : "Copy sender message"}
      </Button>
      <div className="rounded-md border border-border/50 bg-muted/40 p-3 text-xs font-mono whitespace-pre-wrap text-foreground">
        {receiverMsg}
      </div>
      <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => copy(receiverMsg, "receiver")}>
        {copiedReceiver ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        {copiedReceiver ? "Copied!" : "Copy receiver message"}
      </Button>
    </Card>
  );
}

function ParcelDetail() {
  const { id } = useParams({ from: "/office/parcels/$id" });
  const search = useSearch({ from: "/office/parcels/$id" });
  const [parcel, setParcel] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [size, setSize] = useState<"a6" | "a4">("a6");
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("parcels").select("*").eq("id", id).maybeSingle();
      setParcel(p);
      const { data: l } = await supabase
        .from("parcel_status_logs")
        .select("*")
        .eq("parcel_id", id)
        .order("created_at", { ascending: false });
      setLogs(l || []);
    })();
  }, [id]);

  const refreshParcel = async () => {
    const { data: p } = await supabase.from("parcels").select("*").eq("id", id).maybeSingle();
    setParcel(p);
    const { data: l } = await supabase.from("parcel_status_logs").select("*").eq("parcel_id", id).order("created_at", { ascending: false });
    setLogs(l || []);
  };

  const handleConfirmPayment = async () => {
    if (!parcel) return;
    setConfirmingPayment(true);
    const { error } = await supabase
      .from("parcels")
      .update({ payment_status: "completed", notes: "[Payment confirmed manually — Paybill/Cash]" })
      .eq("id", parcel.id);
    setConfirmingPayment(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Payment marked as confirmed");
    await refreshParcel();
  };

  const handlePrint = () => {
    if (!parcel) return;
    const originalTitle = document.title;
    document.title = `Waybill_${parcel.tracking_number}`;
    setTimeout(() => {
      window.print();
      setTimeout(() => { document.title = originalTitle; }, 500);
    }, 100);
  };

  useEffect(() => {
    if (search.print && parcel) handlePrint();
  }, [search.print, parcel]);

  if (!parcel) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  const receiverFullAddress = [
    parcel.receiver_nearest_location,
    parcel.receiver_town,
    parcel.receiver_subcounty,
    parcel.receiver_county,
  ].filter(Boolean).join(", ");

  const bd = getSettlementBreakdown(parcel);

  // ── Inline styles for the printable waybill ──────────────────────────────────
  const FONT_BODY    = '"DM Sans", ui-sans-serif, sans-serif';
  const FONT_HEADING = '"Urbanist", ui-sans-serif, sans-serif';
  const FONT_MONO    = '"Courier New", Courier, monospace';

  const S = {
    // layout
    wbWrap:   { color: "#000", background: "#fff", overflow: "hidden", fontFamily: FONT_BODY } as React.CSSProperties,

    // header (orange strip)
    head:     { background: "#FF6600", padding: "7px 10px 6px", display: "flex", justifyContent: "space-between", alignItems: "center" } as React.CSSProperties,
    brandName:{ fontFamily: FONT_HEADING, fontSize: size === "a6" ? 15 : 22, fontWeight: 900, color: "#fff", letterSpacing: 2, lineHeight: 1 } as React.CSSProperties,
    brandTag: { fontSize: size === "a6" ? 7 : 9, opacity: 0.85, letterSpacing: 1.5, textTransform: "uppercase" as const, marginTop: 2, color: "#fff" },
    contact:  { textAlign: "right" as const, fontSize: size === "a6" ? 8 : 10, color: "rgba(255,255,255,0.92)", lineHeight: 1.6 },

    // tracking bar (dark)
    trackBar: { background: "#1a1a1a", padding: size === "a6" ? "5px 10px" : "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
    trackNum: { fontFamily: FONT_MONO, fontSize: size === "a6" ? 13 : 20, fontWeight: 900, color: "#fff", letterSpacing: 1.5 } as React.CSSProperties,
    trackBadge:{ fontSize: size === "a6" ? 7.5 : 9, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: 1, padding: "2px 7px", borderRadius: 2, background: "#FF6600", color: "#fff" },

    // body
    body:     { padding: size === "a6" ? "7px 10px 5px" : "10px 14px 8px" } as React.CSSProperties,

    // QR + meta row
    qrRow:    { display: "flex", gap: 10, marginBottom: size === "a6" ? 7 : 10 } as React.CSSProperties,
    qrBox:    { width: size === "a6" ? 76 : 130, height: size === "a6" ? 76 : 130, flexShrink: 0, border: "1.5px solid #222", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9f9f9" } as React.CSSProperties,
    qrImg:    { width: size === "a6" ? 72 : 126, height: size === "a6" ? 72 : 126 } as React.CSSProperties,
    meta:     { flex: 1 } as React.CSSProperties,
    metaRow:  { display: "flex", justifyContent: "space-between", fontSize: size === "a6" ? 9.5 : 12, padding: "2.5px 0", borderBottom: "0.5px solid #eee" } as React.CSSProperties,
    metaRowLast: { display: "flex", justifyContent: "space-between", fontSize: size === "a6" ? 9.5 : 12, padding: "2.5px 0" } as React.CSSProperties,
    metaK:    { color: "#888" } as React.CSSProperties,
    metaV:    { fontWeight: 700, color: "#111", textAlign: "right" as const } as React.CSSProperties,

    // COD callout
    cod:      { border: "2px solid #FF6600", borderRadius: 4, background: "#fff8f0", padding: size === "a6" ? "5px 9px" : "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: size === "a6" ? 7 : 10 } as React.CSSProperties,
    codTag:   { fontSize: size === "a6" ? 8 : 10, textTransform: "uppercase" as const, letterSpacing: 1, color: "#FF6600", fontWeight: 700 },
    codBreak: { fontSize: size === "a6" ? 8 : 10, color: "#777", marginTop: 2 } as React.CSSProperties,
    codAmt:   { fontSize: size === "a6" ? 20 : 28, fontWeight: 900, color: "#FF6600", lineHeight: 1 } as React.CSSProperties,

    // single freight/cod row (non-combined)
    freightRow: { fontSize: size === "a6" ? 9.5 : 12, marginBottom: size === "a6" ? 7 : 10 } as React.CSSProperties,

    // divider
    divWrap:  { display: "flex", alignItems: "center", gap: 6, fontSize: size === "a6" ? 8 : 9, textTransform: "uppercase" as const, letterSpacing: 1, color: "#aaa", marginBottom: size === "a6" ? 5 : 8 } as React.CSSProperties,
    divLine:  { flex: 1, height: 0.5, background: "#ddd" } as React.CSSProperties,

    // address grid
    addrGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: size === "a6" ? 5 : 8, marginBottom: size === "a6" ? 6 : 10 } as React.CSSProperties,
    addrFrom: { border: "1px solid #ddd", borderRadius: 4, padding: size === "a6" ? "5px 7px" : "8px 10px" } as React.CSSProperties,
    addrTo:   { border: "2px solid #FF6600", borderRadius: 4, padding: size === "a6" ? "5px 7px" : "8px 10px", background: "#fff8f0" } as React.CSSProperties,
    addrTag:  { fontSize: size === "a6" ? 7.5 : 9, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: 0.8, color: "#888", marginBottom: 4 },
    addrTagTo:{ fontSize: size === "a6" ? 7.5 : 9, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: 0.8, color: "#FF6600", marginBottom: 4 },
    addrName: { fontFamily: FONT_HEADING, fontSize: size === "a6" ? 12 : 15, fontWeight: 900, lineHeight: 1.2, marginBottom: 1 } as React.CSSProperties,
    addrPhone:{ fontSize: size === "a6" ? 9.5 : 12, color: "#444", marginBottom: 3 } as React.CSSProperties,
    addrLoc:  { fontSize: size === "a6" ? 9 : 11, fontWeight: 700, color: "#FF6600", lineHeight: 1.3 } as React.CSSProperties,
    addrLocFrom:{ fontSize: size === "a6" ? 9 : 11, fontWeight: 600, color: "#333", lineHeight: 1.3 } as React.CSSProperties,
    addrPin:  { fontSize: size === "a6" ? 8.5 : 10, color: "#666", marginTop: 3, paddingTop: 3, borderTop: "0.5px solid #FFD9B3", lineHeight: 1.3 } as React.CSSProperties,

    // delivery confirmation
    confirm:       { border: "1.5px dashed #ccc", borderRadius: 4, padding: size === "a6" ? "6px 8px" : "10px 12px", margin: size === "a6" ? "0 10px 5px" : "0 14px 8px" } as React.CSSProperties,
    confirmTitle:  { fontSize: size === "a6" ? 8 : 10, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: 1, color: "#FF6600", marginBottom: size === "a6" ? 6 : 9, display: "flex", alignItems: "center", gap: 5 } as React.CSSProperties,
    confirmTitleLine: { flex: 1, height: 0.5, background: "#FFD9B3" } as React.CSSProperties,
    confirmRow:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: size === "a6" ? 8 : 12, marginBottom: size === "a6" ? 6 : 9 } as React.CSSProperties,
    fieldLabel:    { fontSize: size === "a6" ? 8 : 9.5, color: "#888", textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 3 },
    fieldLine:     { borderBottom: "1.5px solid #222", height: size === "a6" ? 18 : 24, width: "100%" } as React.CSSProperties,
    sigArea:       { border: "1.5px solid #222", borderRadius: 3, height: size === "a6" ? 38 : 55, width: "100%", display: "flex", alignItems: "flex-end", padding: "2px 4px", background: "#fafafa" } as React.CSSProperties,
    sigHint:       { fontSize: size === "a6" ? 7.5 : 9, color: "#ccc" } as React.CSSProperties,

    // footer
    footer:   { borderTop: "1px dashed #ddd", padding: size === "a6" ? "4px 10px" : "6px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: size === "a6" ? 9 : 11 } as React.CSSProperties,
    footerSite:{ color: "#bbb", fontSize: size === "a6" ? 8 : 9.5, letterSpacing: 0.5 } as React.CSSProperties,
  };

  return (
    <div className="space-y-4">
      {/* ── Screen toolbar ── */}
      <div className="no-print flex items-center justify-between gap-2">
        <Link to="/office/parcels" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex gap-2">
          <select
            value={size}
            onChange={(e) => setSize(e.target.value as any)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="a6">A6 thermal</option>
            <option value="a4">A4 full page</option>
          </select>
          <Button onClick={handlePrint} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Printer className="mr-2 h-4 w-4" /> Save as PDF
          </Button>
        </div>
      </div>

      {/* ── Screen info card ── */}
      <Card className="no-print border-border/60 bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-xs text-muted-foreground">{parcel.tracking_number}</div>
            {parcel.is_external && (
              <div className="mt-0.5 text-xs">
                <span className="rounded bg-primary/15 px-1.5 py-0.5 font-medium uppercase tracking-wide text-primary">
                  {parcel.carrier || "External"}
                </span>
                {parcel.external_tracking_number && (
                  <span className="ml-2 font-mono">{parcel.external_tracking_number}</span>
                )}
              </div>
            )}
            <h1 className="text-xl">{parcel.receiver_name}</h1>
            <div className="text-sm text-muted-foreground">{parcel.receiver_location}</div>
          </div>
          <Badge className={statusBadgeClass(parcel.status)}>{parcel.status}</Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Sender</div>
            <div>{parcel.sender_name}</div>
            <div className="text-xs">{parcel.sender_phone}</div>
            <div className="text-xs text-muted-foreground">{parcel.sender_location}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Receiver</div>
            <div>{parcel.receiver_name}</div>
            <div className="text-xs">{parcel.receiver_phone}</div>
            <div className="text-xs text-muted-foreground">{parcel.receiver_location}</div>
            {parcel.receiver_nearest_location && (
              <div className="text-xs text-muted-foreground mt-1">📍 {parcel.receiver_nearest_location}</div>
            )}
          </div>

          {receiverFullAddress && (
            <div className="col-span-2 mt-2">
              <a href={buildGoogleMapsUrl(receiverFullAddress)} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm" className="w-full gap-2">
                  <MapPin className="h-4 w-4" />
                  Navigate to: {receiverFullAddress}
                </Button>
              </a>
            </div>
          )}

          <div><div className="text-xs text-muted-foreground">Service</div><div>{SERVICE_CLASS_LABEL[(parcel.service_class as keyof typeof SERVICE_CLASS_LABEL) || "express"]} · {PRODUCT_SERVICE_LABEL[(parcel.product_service as keyof typeof PRODUCT_SERVICE_LABEL) || "standard"]}</div></div>
          <div><div className="text-xs text-muted-foreground">Delivery</div><div>{DELIVERY_TYPE_LABEL[(parcel.delivery_type as keyof typeof DELIVERY_TYPE_LABEL) || "door"]}</div></div>
          <div><div className="text-xs text-muted-foreground">Goods</div><div>{GOODS_TYPE_LABEL[(parcel.goods_type as keyof typeof GOODS_TYPE_LABEL) || "normal"]}</div></div>
          <div>
            <div className="text-xs text-muted-foreground">Settlement</div>
            <div>{SETTLEMENT_TYPE_LABEL[(parcel.settlement_type as keyof typeof SETTLEMENT_TYPE_LABEL)] || parcel.settlement_type}</div>
          </div>

          {bd.showFreight && (
            <div>
              <div className="text-xs text-muted-foreground">{bd.freightLabel}</div>
              <div>KES {bd.freight.toLocaleString()}</div>
            </div>
          )}
          {bd.showCOD && (
            <div>
              <div className="text-xs text-muted-foreground">COD — product price</div>
              <div className="font-bold text-primary">KES {bd.cod.toLocaleString()}</div>
            </div>
          )}
          {bd.showCombined && (
            <div className="col-span-2 rounded-md border border-orange-400/30 bg-orange-500/5 px-3 py-2">
              <div className="text-xs text-muted-foreground">Total collected on delivery</div>
              <div className="font-bold text-lg text-orange-500">KES {bd.combined.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                KES {bd.freight.toLocaleString()} freight + KES {bd.cod.toLocaleString()} product
              </div>
            </div>
          )}

          {(Number(parcel.insured_amount) > 0 || Number(parcel.insurance_fee) > 0) && (
            <div className="col-span-2">
              <div className="text-xs text-muted-foreground">Insurance</div>
              <div>Insured KES {Number(parcel.insured_amount).toLocaleString()} · Fee KES {Number(parcel.insurance_fee).toLocaleString()}</div>
            </div>
          )}
          <div><div className="text-xs text-muted-foreground">Weight</div><div>{parcel.weight} kg × {parcel.quantity}</div></div>
          {parcel.reverse_receipts && (
            <div><div className="text-xs text-muted-foreground">Reverse Receipts</div><div className="text-primary">Yes</div></div>
          )}
        </div>
        {parcel.description && (
          <div className="mt-3 text-sm"><span className="text-muted-foreground">Description: </span>{parcel.description}</div>
        )}
      </Card>

      <CopyMessages parcel={parcel} />

      {/* ── Manual Payment Confirmation ── */}
      {["freight_collect", "freight_collect_cod", "cod"].includes(parcel.settlement_type) && (
        <Card className="no-print border-border/60 bg-card p-4 space-y-3">
          <h2 className="text-base text-primary">Payment</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Payment Status</div>
              <div className={`text-sm font-semibold mt-0.5 ${parcel.payment_status === "completed" ? "text-green-600" : "text-amber-500"}`}>
                {parcel.payment_status === "completed" ? "✅ Paid" : parcel.payment_status === "pending" ? "⏳ Awaiting M-Pesa" : "Not paid"}
              </div>
            </div>
            {parcel.payment_status !== "completed" && (
              <Button
                size="sm"
                disabled={confirmingPayment}
                onClick={handleConfirmPayment}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                {confirmingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                Mark as Paid (Paybill/Cash)
              </Button>
            )}
          </div>
          {parcel.payment_status !== "completed" && (
            <p className="text-xs text-muted-foreground">
              Use this if the customer has paid via Paybill, bank transfer, or cash and you want to confirm manually.
            </p>
          )}
        </Card>
      )}

      <Card className="no-print border-border/60 bg-card p-4">
        <h2 className="mb-3 text-base">Status timeline</h2>
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0">
              <div>
                <div className="text-sm">{l.status}</div>
                {l.notes && <div className="text-xs text-muted-foreground">{l.notes}</div>}
              </div>
              <div className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* ══════════════════════════════════════════════════════════════
          PRINTABLE WAYBILL
      ══════════════════════════════════════════════════════════════ */}
      <div className={`print-area ${size === "a6" ? "print-a6" : "print-a4"}`} style={S.wbWrap}>

        {/* ── Orange header strip ── */}
        <div style={S.head}>
          <div>
            <div style={S.brandName}>ALISHIP</div>
            <div style={S.brandTag}>Sorted · Shipped · Simple</div>
          </div>
          <div style={S.contact}>
            {ALISHIP_CONTACT.phones.join("  ·  ")}<br />
            {ALISHIP_CONTACT.email}
          </div>
        </div>

        {/* ── Dark tracking bar ── */}
        <div style={S.trackBar}>
          <span style={S.trackNum}>{parcel.tracking_number}</span>
          <span style={S.trackBadge}>
            {SERVICE_CLASS_LABEL[(parcel.service_class as keyof typeof SERVICE_CLASS_LABEL)] || "Express"}
          </span>
        </div>

        {/* ── Body ── */}
        <div style={S.body}>

          {/* QR + shipment meta */}
          <div style={S.qrRow}>
            <div style={S.qrBox}>
              <img src={parcel.qr_code_data} alt="QR" style={S.qrImg} />
            </div>
            <div style={S.meta}>
              <div style={S.metaRow}>
                <span style={S.metaK}>Weight</span>
                <span style={S.metaV}>{parcel.weight} kg × {parcel.quantity}</span>
              </div>
              <div style={S.metaRow}>
                <span style={S.metaK}>Delivery</span>
                <span style={S.metaV}>{DELIVERY_TYPE_LABEL[(parcel.delivery_type as keyof typeof DELIVERY_TYPE_LABEL) || "door"]}</span>
              </div>
              <div style={S.metaRow}>
                <span style={S.metaK}>Goods</span>
                <span style={S.metaV}>{GOODS_TYPE_LABEL[(parcel.goods_type as keyof typeof GOODS_TYPE_LABEL) || "normal"]}</span>
              </div>
              <div style={S.metaRow}>
                <span style={S.metaK}>Settlement</span>
                <span style={S.metaV}>{SETTLEMENT_TYPE_LABEL[(parcel.settlement_type as keyof typeof SETTLEMENT_TYPE_LABEL)] || parcel.settlement_type}</span>
              </div>
              {parcel.description && (
                <div style={S.metaRowLast}>
                  <span style={S.metaK}>Item</span>
                  <span style={S.metaV}>{parcel.description}</span>
                </div>
              )}
            </div>
          </div>

          {/* COD combined callout */}
          {bd.showCombined && (
            <div style={S.cod}>
              <div>
                <div style={S.codTag}>Collect on delivery</div>
                <div style={S.codBreak}>
                  KES {bd.freight.toLocaleString()} freight &nbsp;+&nbsp; KES {bd.cod.toLocaleString()} product
                </div>
              </div>
              <div style={S.codAmt}>KES {bd.combined.toLocaleString()}</div>
            </div>
          )}

          {/* Single freight (non-combined) */}
          {bd.showFreight && !bd.showCombined && (
            <div style={S.cod}>
              <div>
                <div style={S.codTag}>{bd.freightLabel}</div>
              </div>
              <div style={S.codAmt}>KES {bd.freight.toLocaleString()}</div>
            </div>
          )}

          {/* COD only */}
          {bd.showCOD && !bd.showCombined && (
            <div style={S.cod}>
              <div>
                <div style={S.codTag}>Cash on Delivery — product</div>
              </div>
              <div style={S.codAmt}>KES {bd.cod.toLocaleString()}</div>
            </div>
          )}

          {/* Addresses divider */}
          <div style={S.divWrap}>
            <span style={S.divLine} />
            Addresses
            <span style={S.divLine} />
          </div>

          {/* FROM / TO */}
          <div style={S.addrGrid}>
            <div style={S.addrFrom}>
              <div style={S.addrTag}>From</div>
              <div style={S.addrName}>{parcel.sender_name}</div>
              <div style={S.addrPhone}>{parcel.sender_phone}</div>
              <div style={S.addrLocFrom}>{parcel.sender_location}</div>
            </div>
            <div style={S.addrTo}>
              <div style={S.addrTagTo}>📍 Drop off pin</div>
              <div style={S.addrName}>{parcel.receiver_name}</div>
              <div style={S.addrPhone}>{parcel.receiver_phone}</div>
              <div style={S.addrLoc}>{parcel.receiver_location}</div>
              {parcel.receiver_nearest_location && (
                <div style={S.addrPin}>
                  📍 {parcel.receiver_nearest_location}
                  {parcel.receiver_town && (<><br />{parcel.receiver_town}{parcel.receiver_subcounty ? `, ${parcel.receiver_subcounty}` : ""}</>)}
                </div>
              )}
            </div>
          </div>

        </div>{/* end body */}

        {/* ── Delivery Confirmation ── */}
        <div style={S.confirm}>
          <div style={S.confirmTitle}>
            Delivery Confirmation
            <span style={S.confirmTitleLine} />
          </div>

          {/* Date + Time */}
          <div style={S.confirmRow}>
            <div>
              <div style={S.fieldLabel}>Date of Collection</div>
              <div style={S.fieldLine} />
            </div>
            <div>
              <div style={S.fieldLabel}>Time</div>
              <div style={S.fieldLine} />
            </div>
          </div>

          {/* Receiver name + ID */}
          <div style={{ ...S.confirmRow, marginBottom: size === "a6" ? 6 : 9 }}>
            <div>
              <div style={S.fieldLabel}>Receiver Name</div>
              <div style={S.fieldLine} />
            </div>
            <div>
              <div style={S.fieldLabel}>ID / Passport No.</div>
              <div style={S.fieldLine} />
            </div>
          </div>

          {/* Signature */}
          <div>
            <div style={S.fieldLabel}>Receiver Signature</div>
            <div style={S.sigArea}>
              <span style={S.sigHint}>Sign here</span>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={S.footer}>
          <span><b>Item:</b> {parcel.description || "—"} · {parcel.weight} kg</span>
          <span style={S.footerSite}>aliship.co.ke</span>
        </div>

      </div>{/* end print-area */}
    </div>
  );
}
