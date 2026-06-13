// Friendly timeline formatter shared by the public Track page and parcel detail.

import type { ParcelStatus } from "@/lib/parcel-status";

export interface TimelineEntry {
  status: ParcelStatus | string;
  notes?: string | null;
  created_at: string;
  actor_name?: string | null;
  actor_phone?: string | null;
  site_from_name?: string | null;
  site_to_name?: string | null;
  exception_type?: string | null;
}

/**
 * Produce a single human-friendly sentence for the public Track timeline,
 * matching the style in the screenshots ("[Site] scanned for delivery; The
 * delivery courier is [Rider] [Phone]").
 */
export function formatTimelineLine(e: TimelineEntry, receiverName?: string | null): string {
  const site = e.site_from_name || e.site_to_name;
  const actor = e.actor_name;
  const phone = e.actor_phone;

  switch (e.status) {
    case "Delivered":
      return `Parcel delivered 【Collected】 and Received by 【${receiverName || "Recipient"}】${site ? `; Collection site is 【${site}】` : ""}.`;
    case "Out for Delivery":
      return `${actor ? `【${actor}】` : "Courier"}${site ? ` in 【${site}】` : ""} scanned for delivery; The delivery courier is 【${actor || "—"}】${phone ? ` 【${phone}】` : ""}.`;
    case "Picked Up":
      return `Parcel picked up${actor ? ` by 【${actor}】` : ""}${site ? ` at 【${site}】` : ""}.`;
    case "Departed":
      return `Parcel departed${e.site_from_name ? ` from 【${e.site_from_name}】` : ""}${e.site_to_name ? ` heading to 【${e.site_to_name}】` : ""}.`;
    case "Arrived":
      return `Parcel arrived${e.site_to_name ? ` at 【${e.site_to_name}】` : site ? ` at 【${site}】` : ""}.`;
    case "Ready for Collection":
      return `Parcel ready for collection${site ? ` at 【${site}】` : ""}.`;
    case "Rescheduled":
      return `Issue Parcel Reason 【Rescheduled delivery】${e.notes ? ` ,${e.notes}` : ""}.`;
    case "Exception":
      return `Issue Parcel Reason 【${e.exception_type || "Exception"}】${e.notes ? ` ,${e.notes}` : ""}.`;
    case "On Hold":
      return `Parcel placed On Hold${e.notes ? ` — ${e.notes}` : ""}.`;
    case "Returned":
      return `Parcel returned to origin${site ? ` at 【${site}】` : ""}.`;
    case "Return Delivered":
      return `Return delivered${actor ? ` by 【${actor}】` : ""}.`;
    case "Payment Collected":
      return `Payment collected${actor ? ` by 【${actor}】` : ""}.`;
    case "Vehicle Sealed":
      return `Vehicle sealed${site ? ` at 【${site}】` : ""}.`;
    case "Unsealed":
      return `Vehicle unsealed${site ? ` at 【${site}】` : ""}.`;
    case "Created":
      return `Waybill created${site ? ` at 【${site}】` : ""}.`;
    default:
      return `${e.status}${e.notes ? ` — ${e.notes}` : ""}.`;
  }
}
