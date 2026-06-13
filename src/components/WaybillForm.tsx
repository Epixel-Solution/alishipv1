import { useMemo, useState, useRef, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { whatsappAdminUrl } from "@/lib/whatsapp";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { generateTrackingNumber } from "@/lib/parcel-status";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Loader2, Minus, Plus, CreditCard, CheckCircle2, Smartphone } from "lucide-react";
import { promptWhatsApp, msgWaybillCreated, msgRiderWaybill } from "@/lib/whatsapp";
import { useAuth } from "@/lib/auth";
import {
  SERVICE_CLASSES, WAYBILL_MODES, DELIVERY_TYPES, GOODS_TYPES,
  PRODUCT_SERVICES, DELIVERY_TYPE_LABEL, GOODS_TYPE_LABEL,
  PRODUCT_SERVICE_LABEL, estimateFreight,
} from "@/lib/waybill-options";

// ─── Kenya Location Data ───────────────────────────────────────────────────────
export const KENYA_LOCATION_DATA: Record<string, Record<string, string[]>> = {
  Mombasa: {
    Mvita: ["Mombasa CBD", "Old Town", "Majengo", "Tononoka", "Shimanzi", "Ganjoni"],
    Nyali: ["Nyali", "Frere Town", "Ziwa la Ng'ombe", "Kongowea", "Kadzandani"],
    Kisauni: ["Bamburi", "Shanzu", "Mwembetanga", "Mwakirunge", "Mtopanga", "Junda"],
    Likoni: ["Likoni", "Shika Adabu", "Bofu", "Mtongwe", "Timbwani"],
    Changamwe: ["Changamwe", "Port Reitz", "Kipevu", "Airport", "Miritini", "Chaani"],
    Jomvu: ["Jomvu Kuu", "Mikindani", "Magongo"],
  },
  Kilifi: {
    "Kilifi North": ["Kilifi Town", "Mnarani", "Chasimba", "Mtepeni"],
    "Kilifi South": ["Mariakani", "Kayafungo", "Junju", "Mwarakaya"],
    Kaloleni: ["Kaloleni", "Mariakani", "Mwele", "Ruruma"],
    Rabai: ["Rabai", "Mwaweza", "Kisurutini"],
    Ganze: ["Ganze", "Bamba", "Jaribuni", "Sokoni"],
    Malindi: ["Malindi Town", "Shella", "Ganda", "Kakuyuni", "Jilore"],
    Magarini: ["Magarini", "Adu", "Marafa", "Watamu", "Dabaso"],
  },
  Kwale: {
    Msambweni: ["Msambweni", "Gombato", "Bongwe", "Ukunda", "Diani"],
    Lungalunga: ["Lungalunga", "Vanga", "Majoreni"],
    Matuga: ["Kwale Town", "Tiwi", "Kubo South", "Ng'ombeni"],
    Kinango: ["Kinango", "Mackinon Road", "Ndavaya", "Puma", "Golini"],
  },
  Nairobi: {
    Westlands: ["Westlands", "Parklands", "Highridge", "Mountain View", "Karura", "Kangemi"],
    "Dagoretti North": ["Riruta", "Uthiru", "Ruthimitu", "Gitaru"],
    "Dagoretti South": ["Mutu-ini", "Ngando", "Riruta Satellite", "Waithaka", "Karen"],
    Langata: ["Langata", "Karen", "Nairobi West", "South C", "Nyayo Highrise"],
    Kibra: ["Kibra", "Woodley", "Sarang'ombe", "Makina", "Lindi"],
    Roysambu: ["Roysambu", "Githurai", "Kahawa West", "Lucky Summer", "Zimmerman"],
    Kasarani: ["Kasarani", "Clayworks", "Mwiki", "Njiru", "Ruai"],
    Ruaraka: ["Ruaraka", "Baba Dogo", "Utalii", "Mathare North", "Lucky Summer"],
    "Embakasi South": ["Imara Daima", "Kwa Njenga", "Kwa Reuben", "Pipeline", "Kware"],
    "Embakasi North": ["Embakasi", "Utawala", "Mihango", "Kamulu", "Joska"],
    "Embakasi Central": ["Kayole", "Soweto", "Matopeni", "Spring Valley"],
    "Embakasi East": ["Upper Savanna", "Lower Savanna", "Caltex", "Mihang'o"],
    "Embakasi West": ["Umoja", "Mowlem", "Kariobangi South"],
    Makadara: ["Makadara", "Maringo", "Hamza", "Viwandani"],
    Kamukunji: ["Kamukunji", "Pumwani", "Eastleigh North", "Eastleigh South", "Airbase"],
    Starehe: ["Starehe", "Nairobi CBD", "Ngara", "Pangani", "Ziwani", "Kariokor"],
    Mathare: ["Mathare", "Hospital", "Mabatini", "Huruma", "Ngei", "Mlango Kubwa"],
  },
  Nakuru: {
    "Nakuru Town East": ["Nakuru CBD", "Biashara", "Kivumbini", "Flamingo", "Menengai"],
    "Nakuru Town West": ["Nakuru West", "Barut", "London", "Kaptembwo", "Rhoda"],
    Naivasha: ["Naivasha Town", "Biashara", "Hells Gate", "Mai Mahiu", "Olkaria"],
    Gilgil: ["Gilgil", "Elementaita", "Mbaruk", "Eburru", "Malewa"],
  },
  Kisumu: {
    "Kisumu Central": ["Kisumu CBD", "Milimani", "Railways", "Market Milimani"],
    "Kisumu East": ["Kolwa East", "Miwani", "Nyalenda A"],
    "Kisumu West": ["South West Kisumu", "Central Kisumu", "Kisumu North"],
  },
  Machakos: {
    "Machakos Town": ["Machakos CBD", "Mumbuni", "Mutituni", "Kalama"],
    Mavoko: ["Athi River", "Kinanie", "Muthwani"],
  },
  Kajiado: {
    Kajiado_Central: ["Kajiado Town", "Rongai", "Matathia"],
    Kajiado_East: ["Isinya", "Kitengela", "Oloosirkon"],
    Kajiado_North: ["Ngong", "Olkeri", "Magadi Road"],
  },
  Kiambu: {
    Thika: ["Thika Town", "Kamenu", "Gatuanyaga", "Ngoliba"],
    Ruiru: ["Ruiru", "Githurai", "Kahawa Wendani", "Biashara"],
    Kikuyu: ["Kikuyu", "Kinoo", "Karai", "Nachu"],
    Limuru: ["Limuru Town", "Bibirioni", "Ndeiya", "Ngecha"],
    Kiambu: ["Kiambu Town", "Ndumberi", "Riabai", "Township"],
  },
};

export const KENYA_COUNTIES = Object.keys(KENYA_LOCATION_DATA).sort();

// ─── Settlement types ──────────────────────────────────────────────────────────
// 5 types:
// cash_at_office  — product + freight both paid upfront at office
// prepaid         — deducted from company wallet
// freight_collect — receiver pays transport on delivery (rider STK)
// cod             — rider collects product price on delivery (freight already paid)
// freight_collect_cod — rider collects freight + product price combined on delivery

export const SETTLEMENT_TYPES = [
  "cash_at_office",
  "prepaid",
  "freight_collect",
  "cod",
  "freight_collect_cod",
] as const;

export type SettlementType = typeof SETTLEMENT_TYPES[number];

export const SETTLEMENT_TYPE_LABEL: Record<SettlementType, string> = {
  cash_at_office: "Cash at Office",
  prepaid: "Prepaid",
  freight_collect: "Freight Collect",
  cod: "Cash on Delivery (COD)",
  freight_collect_cod: "Freight Collect + COD",
};

// Rider only sees types relevant to their collection scenarios
const RIDER_SETTLEMENT_TYPES: SettlementType[] = ["cash_at_office", "cod", "freight_collect", "freight_collect_cod"];
const OFFICE_SETTLEMENT_TYPES: SettlementType[] = [...SETTLEMENT_TYPES];

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  mode: "office" | "rider";
}

const Schema = z.object({
  service_class: z.enum(SERVICE_CLASSES),
  waybill_mode: z.enum(WAYBILL_MODES),
  paper_waybill_number: z.string().trim().max(60).optional(),
  sender_name: z.string().trim().min(1, "Required").max(120),
  sender_phone: z.string().trim().min(7, "Required").max(20),
  sender_county: z.string().min(1, "County is required"),
  sender_subcounty: z.string().min(1, "Sub-county is required"),
  sender_town: z.string().min(1, "Town is required"),
  sender_nearest_location: z.string().trim().min(1, "Nearest location is required").max(200),
  sender_location: z.string().optional(),
  receiver_name: z.string().trim().min(1, "Required").max(120),
  receiver_phone: z.string().trim().min(7, "Required").max(20),
  receiver_county: z.string().min(1, "County is required"),
  receiver_subcounty: z.string().min(1, "Sub-county is required"),
  receiver_town: z.string().min(1, "Town is required"),
  receiver_nearest_location: z.string().trim().min(1, "Nearest location is required").max(200),
  receiver_location: z.string().optional(),
  delivery_type: z.enum(DELIVERY_TYPES),
  description: z.string().trim().max(500),
  goods_type: z.enum(GOODS_TYPES),
  weight: z.coerce.number().min(0).max(10000),
  quantity: z.coerce.number().int().min(1).max(1000),
  settlement_type: z.enum(SETTLEMENT_TYPES),
  actual_freight: z.coerce.number().min(0).max(10000000),
  insured_amount: z.coerce.number().min(0).max(100000000),
  insurance_fee: z.coerce.number().min(0).max(10000000),
  product_service: z.enum(PRODUCT_SERVICES),
  cod_amount: z.coerce.number().min(0).max(10000000),
  notes: z.string().trim().max(500).optional(),
});
type FormData = z.infer<typeof Schema>;

// ─── Payment dialog state ─────────────────────────────────────────────────────
type PaymentState =
  | { stage: "idle" }
  | { stage: "confirm"; amount: number; phone: string; formData: FormData }
  | { stage: "stk_sent"; checkoutRequestId: string; phone: string; formData: FormData; amount: number }
  | { stage: "manual"; formData: FormData; amount: number }
  | { stage: "paid" };

// ─── Settlement type helpers ───────────────────────────────────────────────────
// Types where rider collects on delivery — no payment gate at waybill creation
const COLLECT_ON_DELIVERY: SettlementType[] = ["freight_collect", "freight_collect_cod", "cod"];
// Types that require M-Pesa gate at office before saving
const REQUIRES_UPFRONT_PAYMENT: SettlementType[] = ["cash_at_office"];

// ─── Address cascade block ────────────────────────────────────────────────────
function AddressBlock({ prefix, title, register, formState, watch, setValue }: {
  prefix: "sender" | "receiver"; title: string;
  register: any; formState: any; watch: any; setValue: any;
}) {
  const county: string = watch(`${prefix}_county`) || "";
  const subcounty: string = watch(`${prefix}_subcounty`) || "";
  const town: string = watch(`${prefix}_town`) || "";
  const subcounties = county ? Object.keys(KENYA_LOCATION_DATA[county] ?? {}) : [];
  const towns = county && subcounty ? (KENYA_LOCATION_DATA[county]?.[subcounty] ?? []) : [];

  const handleCountyChange = (val: string) => {
    setValue(`${prefix}_county`, val, { shouldValidate: true });
    setValue(`${prefix}_subcounty`, "", { shouldValidate: false });
    setValue(`${prefix}_town`, "", { shouldValidate: false });
    setValue(`${prefix}_location`, val, { shouldValidate: false });
  };
  const handleSubcountyChange = (val: string) => {
    setValue(`${prefix}_subcounty`, val, { shouldValidate: true });
    setValue(`${prefix}_town`, "", { shouldValidate: false });
    if (county) setValue(`${prefix}_location`, `${county} > ${val}`, { shouldValidate: false });
  };
  const handleTownChange = (val: string) => {
    setValue(`${prefix}_town`, val, { shouldValidate: true });
    if (county && subcounty) setValue(`${prefix}_location`, `${county} > ${subcounty} > ${val}`, { shouldValidate: false });
  };

  return (
    <Card className="space-y-3 border-border/60 bg-card p-4">
      <h2 className="text-base text-primary">{title}</h2>
      <Field label="Name *" error={formState.errors[`${prefix}_name`]?.message}>
        <Input {...register(`${prefix}_name`)} />
      </Field>
      <Field label="Phone *" error={formState.errors[`${prefix}_phone`]?.message}>
        <Input type="tel" {...register(`${prefix}_phone`)} />
      </Field>
      <Field label="County *" error={formState.errors[`${prefix}_county`]?.message}>
        <Select value={county} onValueChange={handleCountyChange}>
          <SelectTrigger><SelectValue placeholder="Select county" /></SelectTrigger>
          <SelectContent className="max-h-60">
            {KENYA_COUNTIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      {county && (
        <Field label="Sub-county *" error={formState.errors[`${prefix}_subcounty`]?.message}>
          {subcounties.length > 0 ? (
            <Select value={subcounty} onValueChange={handleSubcountyChange}>
              <SelectTrigger><SelectValue placeholder="Select sub-county" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {subcounties.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Input placeholder="Enter sub-county" value={subcounty} onChange={(e) => handleSubcountyChange(e.target.value)} />
          )}
        </Field>
      )}
      {county && subcounty && (
        <Field label="Town / Estate *" error={formState.errors[`${prefix}_town`]?.message}>
          {towns.length > 0 ? (
            <Select value={town} onValueChange={handleTownChange}>
              <SelectTrigger><SelectValue placeholder="Select town / estate" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {towns.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                <SelectItem value="__other__">Other (type below)</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Input placeholder="e.g. Bamburi, Nyali" value={town} onChange={(e) => handleTownChange(e.target.value)} />
          )}
          {town === "__other__" && (
            <Input className="mt-2" placeholder="Type town name" onChange={(e) => handleTownChange(e.target.value)} />
          )}
        </Field>
      )}
      {county && subcounty && town && town !== "__other__" && (
        <>
          <Field label="Nearest Location / Landmark *" error={formState.errors[`${prefix}_nearest_location`]?.message}>
            <Input placeholder="e.g. Opposite Total Petrol Station" {...register(`${prefix}_nearest_location`)} />
          </Field>
          <div className="rounded-md border border-border/40 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            📍 {county} › {subcounty} › {town}
          </div>
        </>
      )}
    </Card>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────
export function WaybillForm({ mode }: Props) {
  const navigate = useNavigate();
  const [pendingTracking, setPendingTracking] = useState<string>("");
  const { user, profile, role } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState("");
  const [manualRef, setManualRef] = useState("");
  const [paymentState, setPaymentState] = useState<PaymentState>({ stage: "idle" });
  const [created, setCreated] = useState<{
    id: string; tracking: string; sender: string; receiver: string; pickup: string;
  } | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  const { register, handleSubmit, formState, watch, setValue } = useForm<FormData>({
    resolver: zodResolver(Schema) as any,
    defaultValues: {
      service_class: "express", waybill_mode: "electronic", delivery_type: "door",
      goods_type: "normal", settlement_type: "cash_at_office", product_service: "standard",
      weight: 1, quantity: 1, actual_freight: 0, insured_amount: 0,
      insurance_fee: 0, cod_amount: 0, description: "",
      sender_county: "", sender_subcounty: "", sender_town: "",
      sender_nearest_location: "", sender_location: "",
      receiver_county: "", receiver_subcounty: "", receiver_town: "",
      receiver_nearest_location: "", receiver_location: "",
    },
  });

  const v = watch();
  const availableSettlementTypes = mode === "rider" ? RIDER_SETTLEMENT_TYPES : OFFICE_SETTLEMENT_TYPES;
  const estimated = useMemo(
    () => estimateFreight(Number(v.weight) || 0, v.product_service, v.service_class),
    [v.weight, v.product_service, v.service_class]
  );

  // Derived flags for conditional rendering
  const isCollectOnDelivery = COLLECT_ON_DELIVERY.includes(v.settlement_type as SettlementType);
  const isCOD = v.settlement_type === "cod" || v.settlement_type === "freight_collect_cod";
  const isFreightCollect = v.settlement_type === "freight_collect" || v.settlement_type === "freight_collect_cod";
  const isFreightPaidUpfront = !isFreightCollect; // cash_at_office, prepaid, cod all have freight known at creation

  const adjustWeight = (delta: number) => {
    const next = Math.max(0, Math.round(((Number(v.weight) || 0) + delta) * 10) / 10);
    setValue("weight", next, { shouldValidate: true });
  };

  // ── Build tracking + insert row ────────────────────────────────────────────
  const buildAndInsert = async (
    values: FormData,
    paymentMethod: "mpesa" | "manual" | "collect_on_delivery",
    mpesaReceipt?: string,
    manualReference?: string,
    preGeneratedTracking?: string
  ) => {
    const senderLocation = `${values.sender_county} > ${values.sender_subcounty} > ${values.sender_town}`;
    const receiverLocation = `${values.receiver_county} > ${values.receiver_subcounty} > ${values.receiver_town}`;

    let tracking: string;
    if (values.waybill_mode === "paper") {
      const t = (values.paper_waybill_number || "").trim();
      if (!t) throw new Error("Enter the paper waybill number");
      const { data: existing } = await supabase.from("parcels").select("id").eq("tracking_number", t).maybeSingle();
      if (existing) throw new Error("That waybill number is already used");
      tracking = t;
    } else {
      tracking = preGeneratedTracking || generateTrackingNumber();
    }

    const TRACK_BASE_URL = "https://aliship.vercel.app";
    const qrData = await QRCode.toDataURL(`${TRACK_BASE_URL}/?track=${tracking}`, { margin: 1, width: 256 });
    // payment_type: cod = rider collects product price; prepaid = already settled
    const payment_type: "cod" | "prepaid" =
      values.settlement_type === "cod" || values.settlement_type === "freight_collect_cod"
        ? "cod"
        : "prepaid";

    // amount = what rider collects on delivery (freight + cod for freight_collect_cod, cod only for cod, freight for freight_collect)
    let amount = 0;
    if (values.settlement_type === "freight_collect_cod") {
      amount = (values.actual_freight || 0) + (values.cod_amount || 0);
    } else if (values.settlement_type === "cod") {
      amount = values.cod_amount || 0;
    } else if (values.settlement_type === "freight_collect") {
      amount = values.actual_freight || 0;
    } else {
      // cash_at_office / prepaid — nothing collected on delivery
      amount = values.actual_freight || 0;
    }

    // payment_status:
    // collect_on_delivery types → pending (rider collects later)
    // upfront types → completed (already paid at creation)
    const payment_status = COLLECT_ON_DELIVERY.includes(values.settlement_type as SettlementType)
      ? "pending"
      : "completed";

    const insertRow: any = {
      tracking_number: tracking, qr_code_data: qrData, status: "Created", created_by: user?.id,
      service_class: values.service_class, waybill_mode: values.waybill_mode,
      delivery_type: values.delivery_type, goods_type: values.goods_type,
      settlement_type: values.settlement_type, product_service: values.product_service,
      actual_freight: values.actual_freight, insured_amount: values.insured_amount,
      insurance_fee: values.insurance_fee, cod_amount: values.cod_amount,
      estimated_freight: Number(values.weight) > 5 ? null : estimated,
      sender_name: values.sender_name, sender_phone: values.sender_phone,
      sender_location: senderLocation, sender_county: values.sender_county,
      sender_subcounty: values.sender_subcounty, sender_town: values.sender_town,
      sender_nearest_location: values.sender_nearest_location,
      receiver_name: values.receiver_name, receiver_phone: values.receiver_phone,
      receiver_location: receiverLocation, receiver_county: values.receiver_county,
      receiver_subcounty: values.receiver_subcounty, receiver_town: values.receiver_town,
      receiver_nearest_location: values.receiver_nearest_location,
      description: values.description, weight: values.weight, quantity: values.quantity,
      payment_type, amount, notes: values.notes || null,
      receiver_landmark: values.receiver_nearest_location || null,
      sender_landmark: null, sender_lat: null, sender_lng: null, sender_map_url: null,
      receiver_lat: null, receiver_lng: null, receiver_map_url: null,
      payment_status,
      payment_method: paymentMethod,
      payment_receipt: mpesaReceipt || manualReference || null,
      payment_verified_at: payment_status === "completed" ? new Date().toISOString() : null,
      payment_verified_by: payment_status === "completed" ? user?.id : null,
    };

    if (values.settlement_type === "cash_at_office" && user?.id) insertRow.cash_received_by = user.id;
    if (mode === "rider") {
      insertRow.assigned_rider_id = user?.id;
      insertRow.submitted_by_rider = true;
      insertRow.approval_status = "pending";
    }

    const { data, error } = await supabase.from("parcels").insert(insertRow).select("id").single();
    if (error) throw error;
    return { id: data.id, tracking, senderLocation };
  };

  // ── Send STK push ──────────────────────────────────────────────────────────
  const sendSTK = async (phone: string, amount: number, tracking: string, settlement_type: string) => {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    const res = await fetch(`${supabaseUrl}/functions/v1/mpesa-stk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ phone, amount, tracking_number: tracking, settlement_type }),
    });
    return res.json();
  };

  // ── Poll for payment confirmation ──────────────────────────────────────────
  const startPolling = useCallback((checkoutRequestId: string, formData: FormData, amount: number) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

        const res = await fetch(
          `${supabaseUrl}/functions/v1/mpesa-status?checkout_id=${checkoutRequestId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const result = await res.json();

        if (result.status === "completed") {
          stopPolling();
          setSubmitting(true);
          try {
            const { id, tracking, senderLocation } = await buildAndInsert(formData, "mpesa", result.mpesa_receipt, undefined, pendingTracking); setPaymentState({ stage: "paid" });
            toast.success(`✅ Payment confirmed! Waybill ${tracking} created.`);
            setTimeout(() => {
              if (mode === "rider") {
                setCreated({ id, tracking, sender: formData.sender_name, receiver: formData.receiver_name, pickup: senderLocation });
                setPaymentState({ stage: "idle" });
              } else {
                promptWhatsApp(msgWaybillCreated({ tracking, sender: formData.sender_name, receiver: formData.receiver_name, service: PRODUCT_SERVICE_LABEL[formData.product_service], insured: formData.insured_amount }));
                navigate({ to: "/office/parcels/$id", params: { id }, search: { print: 1 } as any });
              }
            }, 1500);
          } catch (e: any) {
            toast.error(e.message || "Failed to save waybill");
          } finally {
            setSubmitting(false);
          }
        } else if (result.status === "failed") {
          stopPolling();
          toast.error("Payment failed or cancelled. Try again or pay manually.");
          setPaymentState({ stage: "confirm", amount, phone: "", formData });
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    }, 3000);

    timeoutRef.current = setTimeout(() => {
      stopPolling();
      toast.warning("Payment not confirmed after 3 minutes. Use 'Pay Manually' to record cash payment.");
      setPaymentState((prev) =>
        prev.stage === "stk_sent"
          ? { stage: "manual", formData: prev.formData, amount }
          : prev
      );
    }, 180_000);
  }, [stopPolling, mode, navigate]);

  // ── Form submit ────────────────────────────────────────────────────────────
  const onSubmit = async (values: FormData) => {
    const heavy = Number(values.weight) > 5;
    if (heavy && role !== "super_admin" && (!values.actual_freight || values.actual_freight <= 0)) {
      toast.error("Weight over 5 kg — ask admin to set the actual freight before saving.");
      return;
    }

    // COD types require cod_amount
    if (isCOD && (!values.cod_amount || values.cod_amount <= 0)) {
      toast.error("Enter a COD amount — this is what the rider collects on delivery.");
      return;
    }

    // Freight collect types require actual_freight
    if (isFreightCollect && (!values.actual_freight || values.actual_freight <= 0)) {
      toast.error("Enter the freight amount — receiver will pay this on delivery.");
      return;
    }

    // ── Collect on delivery types — save immediately, no upfront payment gate ──
    if (COLLECT_ON_DELIVERY.includes(values.settlement_type as SettlementType)) {
      setSubmitting(true);
      try {
        const { id, tracking, senderLocation } = await buildAndInsert(values, "collect_on_delivery");
        const label = SETTLEMENT_TYPE_LABEL[values.settlement_type as SettlementType];
        toast.success(mode === "rider" ? `Submitted ${tracking} — pending approval` : `Waybill ${tracking} created (${label})`);
        if (mode === "rider") {
          setCreated({ id, tracking, sender: values.sender_name, receiver: values.receiver_name, pickup: senderLocation });
        } else {
          promptWhatsApp(msgWaybillCreated({ tracking, sender: values.sender_name, receiver: values.receiver_name, service: PRODUCT_SERVICE_LABEL[values.product_service], insured: values.insured_amount }));
          navigate({ to: "/office/parcels/$id", params: { id }, search: { print: 1 } as any });
        }
      } catch (e: any) {
        toast.error(e.message || "Failed to create waybill");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ── Prepaid — save immediately, no payment dialog ──
    if (values.settlement_type === "prepaid") {
      setSubmitting(true);
      try {
        const { id, tracking, senderLocation } = await buildAndInsert(values, "manual");
        toast.success(`Waybill ${tracking} created — deducted from prepaid wallet`);
        if (mode === "rider") {
          setCreated({ id, tracking, sender: values.sender_name, receiver: values.receiver_name, pickup: senderLocation });
        } else {
          promptWhatsApp(msgWaybillCreated({ tracking, sender: values.sender_name, receiver: values.receiver_name, service: PRODUCT_SERVICE_LABEL[values.product_service], insured: values.insured_amount }));
          navigate({ to: "/office/parcels/$id", params: { id }, search: { print: 1 } as any });
        }
      } catch (e: any) {
        toast.error(e.message || "Failed to create waybill");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // ── Cash at Office — M-Pesa payment gate before saving ──
    const amount = values.actual_freight;
    const phone = values.sender_phone;
    setPaymentPhone(phone);
    setPaymentState({ stage: "confirm", amount, phone, formData: values });
  };

  // ── Send STK from dialog ───────────────────────────────────────────────────
  const handleSendSTK = async () => {
    if (paymentState.stage !== "confirm") return;
    const { amount, formData } = paymentState;
    const phone = paymentPhone;

    if (!phone || phone.length < 7) {
      toast.error("Enter a valid phone number");
      return;
    }

    setSubmitting(true);
    try {
      const tracking = formData.waybill_mode === "paper"
        ? (formData.paper_waybill_number || "").trim()
        : generateTrackingNumber();

      setPendingTracking(tracking);

      const result = await sendSTK(phone, amount, tracking, formData.settlement_type);
      if (result.success) {
        setPaymentState({ stage: "stk_sent", checkoutRequestId: result.checkoutRequestId, phone, formData, amount });
        toast.success(`M-Pesa prompt sent to ${phone}`);
        startPolling(result.checkoutRequestId, formData, amount);
      } else {
        toast.error(result.error || "STK failed — use Pay Manually");
        setPaymentState({ stage: "manual", formData, amount });
      }
    } catch {
      toast.error("STK failed — use Pay Manually");
      setPaymentState({ stage: "manual", formData: paymentState.formData, amount: paymentState.amount });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Manual payment ─────────────────────────────────────────────────────────
  const handleManualPayment = async () => {
    const fd = paymentState.stage === "manual" || paymentState.stage === "stk_sent"
      ? (paymentState as any).formData as FormData
      : null;
    if (!fd) return;
    const amount = (paymentState as any).amount || 0;

    if (!manualRef.trim()) {
      toast.error("Enter the M-Pesa code or payment reference");
      return;
    }

    setSubmitting(true);
    try {
      stopPolling();
      const { id, tracking, senderLocation } = await buildAndInsert(fd, "manual", undefined, manualRef.trim(), pendingTracking);
      setPaymentState({ stage: "paid" });
      toast.success(`✅ Manual payment recorded. Waybill ${tracking} created.`);
      setTimeout(() => {
        if (mode === "rider") {
          setCreated({ id, tracking, sender: fd.sender_name, receiver: fd.receiver_name, pickup: senderLocation });
          setPaymentState({ stage: "idle" });
        } else {
          navigate({ to: "/office/parcels/$id", params: { id }, search: { print: 1 } as any });
        }
      }, 1200);
    } catch (e: any) {
      toast.error(e.message || "Failed to save waybill");
    } finally {
      setSubmitting(false);
    }
  };

  const closePaymentDialog = () => {
    stopPolling();
    setPaymentState({ stage: "idle" });
    setManualRef("");
  };

  // ── Success screen (rider mode) ────────────────────────────────────────────
  if (created && mode === "rider") {
    return (
      <div className="space-y-4">
        <Card className="space-y-3 border-success/40 bg-success/10 p-4">
          <div className="text-sm text-muted-foreground">Submitted for approval</div>
          <div className="font-mono text-lg">{created.tracking}</div>
          <div className="text-sm">{created.sender} → {created.receiver}</div>
          <div className="text-xs text-muted-foreground">Pickup: {created.pickup}</div>
        </Card>
        <Button
          type="button"
          className="h-12 w-full bg-[#25D366] text-white hover:bg-[#1ebd5a]"
          onClick={async () => {
            const url = await whatsappAdminUrl(msgRiderWaybill({ rider: profile?.full_name || "Rider", tracking: created.tracking, pickup: created.pickup }));
            window.open(url, "_blank", "noopener,noreferrer");
          }}
        >
          Send to office on WhatsApp
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setCreated(null)}>Submit another</Button>
          <Button className="bg-primary text-primary-foreground" onClick={() => navigate({ to: "/rider/pickups" })}>My Pickups</Button>
        </div>
      </div>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-2xl">Waybill Entry</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "rider" ? "Office will review and approve." : "Tracking number is generated automatically."}
        </p>
      </div>

      <Tabs value={v.service_class} onValueChange={(val) => setValue("service_class", val as any)} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="express" className="flex-1">Express</TabsTrigger>
          <TabsTrigger value="ltl" className="flex-1">LTL</TabsTrigger>
        </TabsList>
        <TabsContent value={v.service_class} />
      </Tabs>

      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground">Mode</Label>
        <Select value={v.waybill_mode} onValueChange={(val) => setValue("waybill_mode", val as any)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="electronic">E-Waybill</SelectItem>
            <SelectItem value="paper">Paper-Waybill</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {v.waybill_mode === "paper" && (
          <Card className="space-y-3 border-border/60 bg-card p-4">
            <Field label="Waybill No." error={formState.errors.paper_waybill_number?.message}>
              <Input placeholder="Enter waybill number from booklet" {...register("paper_waybill_number")} />
            </Field>
          </Card>
        )}

        <AddressBlock prefix="sender" title="Sender Information *" register={register} formState={formState} watch={watch} setValue={setValue} />
        <AddressBlock prefix="receiver" title="Receiver Information *" register={register} formState={formState} watch={watch} setValue={setValue} />

        <Card className="space-y-3 border-border/60 bg-card p-4">
          <Field label="Delivery Type *">
            <Select value={v.delivery_type} onValueChange={(val) => setValue("delivery_type", val as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DELIVERY_TYPES.map((t) => <SelectItem key={t} value={t}>{DELIVERY_TYPE_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Description *">
            <Textarea rows={2} placeholder="Please enter the name of the item." {...register("description")} />
          </Field>
          <Field label="Goods Type *">
            <Select value={v.goods_type} onValueChange={(val) => setValue("goods_type", val as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GOODS_TYPES.map((t) => <SelectItem key={t} value={t}>{GOODS_TYPE_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Weight *" error={formState.errors.weight?.message}>
            <div className="flex items-center gap-2">
              <Input type="number" step="0.1" className="flex-1" {...register("weight")} />
              <span className="text-sm text-muted-foreground">KG</span>
              <Button type="button" variant="outline" size="icon" onClick={() => adjustWeight(-0.1)}><Minus className="h-4 w-4" /></Button>
              <Button type="button" variant="outline" size="icon" onClick={() => adjustWeight(0.1)}><Plus className="h-4 w-4" /></Button>
            </div>
          </Field>
          <Field label="Quantity" error={formState.errors.quantity?.message}>
            <Input type="number" step="1" {...register("quantity")} />
          </Field>
          {Number(v.weight) > 5 && (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning-foreground">
              Weight exceeds 5 kg — admin must confirm the actual freight.
            </div>
          )}
        </Card>

        {/* ── Financials Card ── */}
        <Card className="space-y-3 border-border/60 bg-card p-4">
          <Field label="Settlement Type *">
            <Select
              value={v.settlement_type}
              onValueChange={(val) => setValue("settlement_type", val as SettlementType)}
            >
              <SelectTrigger><SelectValue placeholder="Select settlement type" /></SelectTrigger>
              <SelectContent>
                {availableSettlementTypes.map((t) => (
                  <SelectItem key={t} value={t}>{SETTLEMENT_TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* ── Info banners ── */}
          {v.settlement_type === "cash_at_office" && (
            <div className="rounded-md bg-blue-500/10 px-3 py-2 text-xs text-blue-600">
              💳 Both freight and product price paid upfront. M-Pesa prompt sent to sender before waybill is saved.
            </div>
          )}
          {v.settlement_type === "prepaid" && (
            <div className="rounded-md bg-purple-500/10 px-3 py-2 text-xs text-purple-600">
              🏦 Freight deducted from the company's prepaid wallet. No payment collected at creation.
            </div>
          )}
          {v.settlement_type === "freight_collect" && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-foreground">
              📦 Freight Collect — receiver pays transport on delivery via M-Pesa (rider sends prompt). Product price already settled.
            </div>
          )}
          {v.settlement_type === "cod" && (
            <div className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
              🛵 COD — rider collects product price at doorstep via M-Pesa. Freight already paid.
            </div>
          )}
          {v.settlement_type === "freight_collect_cod" && (
            <div className="rounded-md border border-orange-400/40 bg-orange-500/10 p-2 text-xs text-orange-600">
              📦🛵 Freight Collect + COD — rider sends one combined M-Pesa prompt to receiver covering both transport and product price.
            </div>
          )}

          {/* ── Freight Amount ──
              Show for: cash_at_office, prepaid, cod (paid upfront), freight_collect, freight_collect_cod
              All types need freight recorded. Label changes based on who pays when. */}
          <Field
            label={
              isFreightCollect
                ? "Freight Amount (KES) — collected on delivery *"
                : "Actual Freight (KES)"
            }
            error={formState.errors.actual_freight?.message}
          >
            <Input type="number" step="0.01" placeholder="0" {...register("actual_freight")} />
          </Field>

          {/* ── COD Amount ── only for cod and freight_collect_cod ── */}
          {isCOD && (
            <Field
              label="COD Amount (KES) — product price collected on delivery *"
              error={formState.errors.cod_amount?.message}
            >
              <Input type="number" step="0.01" placeholder="Amount rider collects for the product" {...register("cod_amount")} />
            </Field>
          )}

          {/* ── Combined total preview for freight_collect_cod ── */}
          {v.settlement_type === "freight_collect_cod" && (
            <div className="rounded-md border border-orange-400/30 bg-orange-500/5 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Combined STK on delivery: </span>
              <span className="font-semibold text-foreground">
                KES {((Number(v.actual_freight) || 0) + (Number(v.cod_amount) || 0)).toLocaleString()}
              </span>
              <span className="ml-2 text-muted-foreground">
                (KES {(Number(v.actual_freight) || 0).toLocaleString()} freight + KES {(Number(v.cod_amount) || 0).toLocaleString()} product)
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Insured Amount" error={formState.errors.insured_amount?.message}>
              <Input type="number" step="0.01" placeholder="0" {...register("insured_amount")} />
            </Field>
            <Field label="Insurance Fee" error={formState.errors.insurance_fee?.message}>
              <Input type="number" step="0.01" {...register("insurance_fee")} />
            </Field>
          </div>

          <Field label="Product Service *">
            <Select value={v.product_service} onValueChange={(val) => setValue("product_service", val as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRODUCT_SERVICES.map((t) => <SelectItem key={t} value={t}>{PRODUCT_SERVICE_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Remark"><Textarea rows={2} {...register("notes")} /></Field>

          <div className="text-right text-sm text-muted-foreground">
            {Number(v.weight) > 5
              ? <span>Estimated Freight — <span className="font-medium text-foreground">set by admin</span></span>
              : <span>Estimated Freight — <span className="font-medium text-foreground">KES {estimated.toLocaleString()}</span></span>
            }
          </div>
        </Card>

        <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
          <div className="mx-auto max-w-screen-md">
            <Button type="submit" disabled={submitting} className="h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {v.settlement_type === "cash_at_office"
                ? "Proceed to Payment"
                : mode === "rider" ? "Submit for Approval" : "Place An Order"}
            </Button>
          </div>
        </div>
      </form>

      {/* ── Payment Dialog (cash_at_office only) ── */}
      <Dialog
        open={paymentState.stage !== "idle" && paymentState.stage !== "paid"}
        onOpenChange={(o) => { if (!o) closePaymentDialog(); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {paymentState.stage === "confirm" && "Confirm Payment"}
              {paymentState.stage === "stk_sent" && "⏳ Waiting for Payment..."}
              {paymentState.stage === "manual" && "Record Manual Payment"}
            </DialogTitle>
            <DialogDescription>
              {paymentState.stage === "confirm" && `Send M-Pesa prompt to sender for KES ${(paymentState as any).amount?.toLocaleString()}`}
              {paymentState.stage === "stk_sent" && `Prompt sent to ${(paymentState as any).phone}. Customer should enter M-Pesa PIN now.`}
              {paymentState.stage === "manual" && "STK failed or customer paid cash. Record the payment reference."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {(paymentState.stage === "confirm" || paymentState.stage === "stk_sent") && (
              <div className="rounded-md bg-primary/5 p-3 text-center">
                <div className="text-xs text-muted-foreground">Amount</div>
                <div className="text-2xl font-bold text-primary">
                  KES {((paymentState as any).amount || 0).toLocaleString()}
                </div>
                <Badge variant="outline" className="mt-1">Paybill 4050399 · A/C {(paymentState as any).formData?.paper_waybill_number || "Auto-generated"}</Badge>
              </div>
            )}

            {paymentState.stage === "confirm" && (
              <div>
                <Label>Send prompt to</Label>
                <Input
                  value={paymentPhone}
                  onChange={(e) => setPaymentPhone(e.target.value)}
                  placeholder="e.g. 0712345678"
                  className="font-mono"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Defaults to sender's phone. Change if paying from different number.
                </p>
              </div>
            )}

            {paymentState.stage === "stk_sent" && (
              <div className="flex items-center gap-3 rounded-md bg-amber-500/10 p-3 text-sm text-amber-600">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                Waiting for customer to enter M-Pesa PIN...
              </div>
            )}

            {(paymentState.stage === "manual" || paymentState.stage === "stk_sent") && (
              <div>
                <Label>M-Pesa Code / Reference</Label>
                <Input
                  value={manualRef}
                  onChange={(e) => setManualRef(e.target.value.toUpperCase())}
                  placeholder="e.g. QKA12345"
                  className="font-mono"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter the M-Pesa confirmation code for reconciliation.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={closePaymentDialog}>Cancel</Button>

            {paymentState.stage === "confirm" && (
              <Button onClick={handleSendSTK} disabled={submitting} className="bg-green-600 text-white hover:bg-green-700">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}
                Send M-Pesa Prompt
              </Button>
            )}

            {(paymentState.stage === "confirm" || paymentState.stage === "stk_sent" || paymentState.stage === "manual") && (
              <Button
                variant={paymentState.stage === "manual" ? "default" : "outline"}
                onClick={() => {
                  stopPolling();
                  setPaymentState({ stage: "manual", formData: (paymentState as any).formData, amount: (paymentState as any).amount || 0 });
                }}
                disabled={submitting || paymentState.stage === "manual"}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Pay Manually
              </Button>
            )}

            {(paymentState.stage === "manual" || paymentState.stage === "stk_sent") && manualRef.trim() && (
              <Button onClick={handleManualPayment} disabled={submitting} className="bg-primary text-primary-foreground">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Confirm & Save Waybill
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: any }) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
