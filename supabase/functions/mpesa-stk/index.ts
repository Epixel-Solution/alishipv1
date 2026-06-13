import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DARAJA_BASE_URL = "https://api.safaricom.co.ke";

async function getDarajaToken(): Promise<string> {
  const consumerKey = Deno.env.get("DARAJA_CONSUMER_KEY")!;
  const consumerSecret = Deno.env.get("DARAJA_CONSUMER_SECRET")!;
  const credentials = btoa(`${consumerKey}:${consumerSecret}`);

  const res = await fetch(
    `${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${credentials}` } }
  );

  if (!res.ok) throw new Error("Failed to get Daraja token");
  const data = await res.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, amount, parcel_id, tracking_number } = await req.json();
    
    const shortcode = Deno.env.get("DARAJA_SHORTCODE") || "4050399";
    const passkey = Deno.env.get("DARAJA_PASSKEY");
    const consumerKey = Deno.env.get("DARAJA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("DARAJA_CONSUMER_SECRET");

    if (!consumerKey || !consumerSecret || !passkey) {
      throw new Error("Mpesa credentials not configured");
    }

    let normalizedPhone = phone.replace(/\s/g, "").replace(/^\+/, "");
    if (normalizedPhone.startsWith("0")) {
      normalizedPhone = "254" + normalizedPhone.slice(1);
    }

    const accessToken = await getDarajaToken();

    const now = new Date();
    const timestamp =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0") +
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0");

    const password = btoa(`${shortcode}${passkey}${timestamp}`);
    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-callback`;

    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(amount),
      PartyA: normalizedPhone,
      PartyB: shortcode,
      PhoneNumber: normalizedPhone,
      CallBackURL: callbackUrl,
      AccountReference: tracking_number ? `${tracking_number.slice(-12)}` : "ALISHIP",
      TransactionDesc: `COD Payment`,
    };

    const stkRes = await fetch(
      `${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(stkPayload),
      }
    );

    const stkData = await stkRes.json();

    if (stkData.ResponseCode !== "0") {
      throw new Error(stkData.ResponseDescription || "STK Push failed");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabase
      .from("parcels")
      .update({ payment_reference: stkData.CheckoutRequestID })
      .eq("id", parcel_id);

    return new Response(
      JSON.stringify({
        success: true,
        checkoutRequestId: stkData.CheckoutRequestID,
        merchantRequestId: stkData.MerchantRequestID,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("STK Push error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});