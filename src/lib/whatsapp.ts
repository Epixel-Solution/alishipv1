// WhatsApp prompt helpers — opens wa.me with a pre-filled message.
// Used after every status change, waybill, exception, COD, etc.
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

let cachedNumber: string | null = null;

export async function getAdminWhatsAppNumber(): Promise<string> {
  if (cachedNumber) return cachedNumber;
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "whatsapp_admin_number")
    .maybeSingle();
  cachedNumber = (data?.value as string) || "+254769473510";
  return cachedNumber;
}

function clean(p: string): string {
  let n = p.replace(/[^\d+]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  if (n.startsWith("0")) n = "254" + n.slice(1);
  return n;
}

export async function whatsappAdminUrl(message: string): Promise<string> {
  const num = await getAdminWhatsAppNumber();
  return `https://wa.me/${clean(num)}?text=${encodeURIComponent(message)}`;
}

/** Show a non-blocking toast with a "Send WhatsApp update" action. */
export async function promptWhatsApp(message: string, label = "Send WhatsApp update") {
  const url = await whatsappAdminUrl(message);
  toast(label, {
    description: message.split("\n")[0],
    duration: 8000,
    action: {
      label: "Open",
      onClick: () => window.open(url, "_blank", "noopener,noreferrer"),
    },
  });
}

// === Message builders ===

export function msgWaybillCreated(p: {
  tracking: string;
  sender: string;
  receiver: string;
  origin?: string;
  destination?: string;
  service?: string;
  insured?: number;
}) {
  return [
    `New parcel created. Tracking: ${p.tracking}`,
    `Sender: ${p.sender} | Receiver: ${p.receiver}`,
    p.origin && p.destination ? `Route: ${p.origin} → ${p.destination}` : null,
    p.service ? `Service: ${p.service}` : null,
    p.insured && p.insured > 0 ? `Insured: KES ${p.insured.toLocaleString()}` : null,
  ].filter(Boolean).join("\n");
}
export function msgPickedUp(p: { tracking: string; rider: string; receiver: string }) {
  return `Parcel ${p.tracking} has been picked up.\nRider: ${p.rider} | Receiver: ${p.receiver}`;
}
export function msgOFD(p: { tracking: string; rider: string; receiver: string; phone: string }) {
  return `Parcel ${p.tracking} is out for delivery.\nRider: ${p.rider} | Receiver: ${p.receiver} (${p.phone})`;
}
export function msgDelivered(p: { tracking: string; receiver: string; rider: string }) {
  return `Parcel ${p.tracking} has been delivered.\nReceiver: ${p.receiver} | Rider: ${p.rider}`;
}
export function msgException(p: { tracking: string; type: string; reason: string; staff: string }) {
  return `EXCEPTION on parcel ${p.tracking}\nType: ${p.type} | Reason: ${p.reason}\nReported by: ${p.staff}`;
}
export function msgRescheduled(p: { tracking: string; date: string; reason: string; receiver: string }) {
  return `Parcel ${p.tracking} rescheduled to ${p.date}\nReason: ${p.reason} | Receiver: ${p.receiver}`;
}
export function msgCOD(p: { tracking: string; amount: number; rider: string }) {
  return `COD collected for ${p.tracking}\nAmount: KES ${p.amount} | Rider: ${p.rider}`;
}
export function msgRiderWaybill(p: { rider: string; tracking: string; pickup: string }) {
  return `New waybill pending approval from rider ${p.rider}\nTracking: ${p.tracking} | Pickup from: ${p.pickup}`;
}

export function genericStatusMsg(p: { tracking: string; status: string; receiver?: string }) {
  return `Parcel ${p.tracking} → ${p.status}` + (p.receiver ? `\nReceiver: ${p.receiver}` : "");
}
