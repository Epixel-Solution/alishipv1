import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

serve(async (req) => {
  try {
    const body = await req.json();
    console.log("M-Pesa callback received:", JSON.stringify(body));

    const callback = body?.Body?.stkCallback;
    if (!callback) {
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const checkoutRequestId = callback.CheckoutRequestID;
    const resultCode = callback.ResultCode;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (resultCode === 0) {
      const items = callback.CallbackMetadata?.Item || [];
      const mpesaCode = items.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value || "";
      const paidAmount = items.find((i: any) => i.Name === "Amount")?.Value || 0;

      // Find the parcel
      const { data: parcels } = await supabase
        .from("parcels")
        .select("id, tracking_number, status, payment_status, cod_amount")
        .eq("payment_reference", checkoutRequestId);

      if (!parcels || parcels.length === 0) {
        console.log(`No parcel found for checkout ${checkoutRequestId}`);
        return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      for (const parcel of parcels) {
        if (parcel.payment_status === "completed") {
          console.log(`Parcel ${parcel.tracking_number} already paid, skipping`);
          continue;
        }

        // Update payment status
        await supabase
          .from("parcels")
          .update({
            payment_status: "completed",
            payment_receipt: mpesaCode,
            payment_verified_at: new Date().toISOString(),
          })
          .eq("id", parcel.id);

        console.log(`✅ COD Payment confirmed for ${parcel.tracking_number}, M-Pesa: ${mpesaCode}`);
      }
    } else {
      console.log(`Payment failed for ${checkoutRequestId}: ${callback.ResultDesc}`);
      
      // Update payment status to failed
      await supabase
        .from("parcels")
        .update({ payment_status: "failed" })
        .eq("payment_reference", checkoutRequestId);
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Callback error:", error);
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
});