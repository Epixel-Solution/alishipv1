import { supabase } from "@/integrations/supabase/client";

export async function initiateMpesaPayment(input: { parcel_id: string; phone: string; amount: number }) {
  const { data, error } = await supabase.functions.invoke("mpesa-stk", { body: input });
  if (error) throw new Error(error.message);
  return data;
}

export async function checkPaymentStatus(input: { parcel_id: string }) {
  const { data, error } = await supabase.from("parcels")
    .select("payment_status, payment_reference, cod_amount")
    .eq("id", input.parcel_id).single();
  if (error) throw new Error(error.message);
  return { payment_status: data?.payment_status || "pending",
    payment_reference: data?.payment_reference, amount: data?.cod_amount };
}

export async function confirmDeliveryAfterPayment(input: { parcel_id: string; signature?: string }) {
  const { data: parcel, error: fetchErr } = await supabase
    .from("parcels").select("payment_status, cod_amount, tracking_number")
    .eq("id", input.parcel_id).single();
  if (fetchErr || !parcel) throw new Error("Parcel not found");
  if (parcel.payment_status !== "completed") throw new Error("Payment not completed.");
  const { error } = await supabase.from("parcels").update({
    status: "Delivered", delivered_at: new Date().toISOString(),
    pod_signature: input.signature || null,
    notes: `COD payment of KES ${parcel.cod_amount} collected and delivered`,
  }).eq("id", input.parcel_id);
  if (error) throw new Error(error.message);
  await supabase.from("parcel_status_logs").insert({
    parcel_id: input.parcel_id, status: "Delivered",
    notes: `COD payment collected: KES ${parcel.cod_amount}`,
  });
  return { success: true, message: `Parcel ${parcel.tracking_number} marked as delivered` };
}