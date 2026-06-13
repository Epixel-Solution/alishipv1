import { supabase } from "@/integrations/supabase/client";

export async function getPublicTracking(input: { waybill: string }) {
  const { data, error } = await supabase.functions.invoke("public-tracking", {
    body: { waybill: input.waybill },
  });
  if (error) throw new Error(error.message);
  return data;
}