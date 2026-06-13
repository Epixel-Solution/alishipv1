import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { generateTrackingNumber } from "@/lib/parcel-status";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { LocationFields, type LocationValue } from "@/components/LocationFields";

export const Route = createFileRoute("/office/external")({
  component: () => (
    <RoleGuard allow={["office", "super_admin"]}>
      <ExternalForm basePath="/office" />
    </RoleGuard>
  ),
});

const CARRIERS = ["SpeedAF", "G4S", "DHL", "Sendy", "Posta Kenya", "Other"];

const Schema = z.object({
  carrier: z.string().trim().min(1).max(60),
  external_tracking_number: z.string().trim().min(2).max(80),
  sender_name: z.string().trim().min(1).max(120),
  sender_phone: z.string().trim().min(7).max(20),
  sender_location: z.string().trim().min(1).max(200),
  receiver_name: z.string().trim().min(1).max(120),
  receiver_phone: z.string().trim().min(7).max(20),
  receiver_location: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional(),
  weight: z.coerce.number().min(0).max(10000).optional(),
  amount: z.coerce.number().min(0).max(10000000).optional(),
  notes: z.string().trim().max(500).optional(),
});

type FormData = z.infer<typeof Schema>;

export function ExternalForm({ basePath }: { basePath: string }) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [senderLoc, setSenderLoc] = useState<LocationValue>({});
  const [receiverLoc, setReceiverLoc] = useState<LocationValue>({});
  const { register, handleSubmit, formState, watch, setValue } = useForm<FormData>({
    resolver: zodResolver(Schema) as any,
    defaultValues: { carrier: "SpeedAF", weight: 0, amount: 0 },
  });
  const carrier = watch("carrier");

  const onSubmit = async (values: FormData) => {
    setSubmitting(true);
    try {
      const tracking = generateTrackingNumber();
      const qrData = await QRCode.toDataURL(
        `https://alishiplogisticsv1.vercel.app/track?waybill=${encodeURIComponent(tracking)}`,
        { margin: 1, width: 256 }
      ); const { data: { user } } = await supabase.auth.getUser();
      const isCod = (values.amount ?? 0) > 0;
      const { data, error } = await supabase
        .from("parcels")
        .insert({
          sender_name: values.sender_name,
          sender_phone: values.sender_phone,
          sender_location: values.sender_location,
          receiver_name: values.receiver_name,
          receiver_phone: values.receiver_phone,
          receiver_location: values.receiver_location,
          description: values.description || "",
          weight: values.weight ?? 0,
          quantity: 1,
          payment_type: isCod ? "cod" : "prepaid",
          amount: values.amount ?? 0,
          notes: values.notes || null,
          tracking_number: tracking,
          qr_code_data: qrData,
          status: "Created",
          created_by: user?.id,
          is_external: true,
          carrier: values.carrier,
          external_tracking_number: values.external_tracking_number,
          // New required-by-default columns
          service_class: "express",
          waybill_mode: "electronic",
          delivery_type: "door",
          goods_type: "normal",
          settlement_type: isCod ? "cod" : "prepaid",
          product_service: "standard",
          actual_freight: isCod ? 0 : (values.amount ?? 0),
          insured_amount: 0,
          insurance_fee: 0,
          cod_amount: isCod ? (values.amount ?? 0) : 0,
          sender_landmark: senderLoc.landmark || null,
          sender_lat: senderLoc.lat ?? null,
          sender_lng: senderLoc.lng ?? null,
          sender_map_url: senderLoc.map_url || null,
          receiver_landmark: receiverLoc.landmark || null,
          receiver_lat: receiverLoc.lat ?? null,
          receiver_lng: receiverLoc.lng ?? null,
          receiver_map_url: receiverLoc.map_url || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (!data?.id) throw new Error("Insert returned no id");
      toast.success(`External waybill ${tracking} recorded`);
      navigate({ to: `${basePath}/parcels/$id`, params: { id: data.id }, search: { print: 1 } as any });
    } catch (e: any) {
      toast.error(e.message || "Failed to record external waybill");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl">Receive External Waybill</h1>
        <p className="text-sm text-muted-foreground">
          Log a parcel from another carrier (SpeedAF, etc.) so we can track it through our scans.
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card className="space-y-3 border-border/60 bg-card p-4">
          <h2 className="text-base text-primary">Carrier</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Carrier</Label>
              <Select value={carrier} onValueChange={(v) => setValue("carrier", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CARRIERS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formState.errors.carrier && (
                <p className="mt-1 text-xs text-destructive">{formState.errors.carrier.message}</p>
              )}
            </div>
            <Field label="Carrier tracking #" error={formState.errors.external_tracking_number?.message}>
              <Input className="font-mono" {...register("external_tracking_number")} />
            </Field>
          </div>
        </Card>

        <Card className="space-y-3 border-border/60 bg-card p-4">
          <h2 className="text-base text-primary">Sender</h2>
          <Field label="Name" error={formState.errors.sender_name?.message}><Input {...register("sender_name")} /></Field>
          <Field label="Phone" error={formState.errors.sender_phone?.message}><Input type="tel" {...register("sender_phone")} /></Field>
          <Field label="Area / Town" error={formState.errors.sender_location?.message}><Input {...register("sender_location")} /></Field>
          <LocationFields label="Pickup" value={senderLoc} onChange={setSenderLoc} />
        </Card>

        <Card className="space-y-3 border-border/60 bg-card p-4">
          <h2 className="text-base text-primary">Receiver</h2>
          <Field label="Name" error={formState.errors.receiver_name?.message}><Input {...register("receiver_name")} /></Field>
          <Field label="Phone" error={formState.errors.receiver_phone?.message}><Input type="tel" {...register("receiver_phone")} /></Field>
          <Field label="Area / Town" error={formState.errors.receiver_location?.message}><Input {...register("receiver_location")} /></Field>
          <LocationFields label="Drop-off" value={receiverLoc} onChange={setReceiverLoc} />
        </Card>

        <Card className="space-y-3 border-border/60 bg-card p-4">
          <h2 className="text-base text-primary">Parcel</h2>
          <Field label="Description"><Textarea rows={2} {...register("description")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Weight (kg)"><Input type="number" step="0.01" {...register("weight")} /></Field>
            <Field label="COD / Amount (KES)"><Input type="number" step="0.01" {...register("amount")} /></Field>
          </div>
          <Field label="Notes"><Textarea rows={2} {...register("notes")} /></Field>
        </Card>

        <Button type="submit" disabled={submitting} className="h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90">
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Record External Waybill
        </Button>
      </form>
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
