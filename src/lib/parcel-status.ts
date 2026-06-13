export const PARCEL_STATUSES = [
  "Created",
  "Picked Up",
  "Departed",
  "Arrived",
  "Ready for Collection",
  "Out for Delivery",
  "Delivered",
  "Return Delivered",
  "On Hold",
  "Vehicle Sealed",
  "Unsealed",
  "Exception",
  "Returned",
  "Payment Collected",
  "Rescheduled",
] as const;

export type ParcelStatus = (typeof PARCEL_STATUSES)[number];

export type ScanType =
  | "pickup"
  | "departure"
  | "arrival"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "hold"
  | "vehicle_sealing"
  | "unsealing"
  | "exception"
  | "payment";

export const SCAN_CONFIG: Record<
  ScanType,
  { label: string; status: ParcelStatus; needsReason?: boolean; needsAmount?: boolean }
> = {
  pickup: { label: "Pickup Scan", status: "Picked Up" },
  departure: { label: "Departure Scan", status: "Departed" },
  arrival: { label: "Arrival Scan", status: "Arrived" },
  ready: { label: "Ready for Collection Scan", status: "Ready for Collection" },
  out_for_delivery: { label: "Out for Delivery Scan", status: "Out for Delivery" },
  delivered: { label: "Delivered Scan", status: "Delivered" },
  hold: { label: "Hold Scan", status: "On Hold" },
  vehicle_sealing: { label: "Vehicle Sealing Scan", status: "Vehicle Sealed" },
  unsealing: { label: "Unsealing Scan", status: "Unsealed" },
  exception: { label: "Exception Entry", status: "Exception", needsReason: true },
  payment: { label: "Online Payment Collection", status: "Payment Collected", needsAmount: true },
};

/**
 * Allowed status transitions. Mirrors the database trigger.
 * Used client-side to give a friendly error before hitting the server.
 */
export const ALLOWED_TRANSITIONS: Record<ParcelStatus, ParcelStatus[]> = {
  Created: ["Picked Up", "On Hold", "Exception"],
  "Picked Up": ["Vehicle Sealed", "Departed", "On Hold", "Exception"],
  "Vehicle Sealed": ["Departed", "Unsealed", "Exception"],
  Unsealed: ["Vehicle Sealed", "Departed", "On Hold", "Exception"],
  Departed: ["Arrived", "Exception", "On Hold"],
  Arrived: ["Ready for Collection", "Out for Delivery", "On Hold", "Exception"],
  "Ready for Collection": ["Out for Delivery", "Delivered", "Payment Collected", "Exception", "On Hold"],
  "Out for Delivery": ["Delivered", "Exception", "Rescheduled", "Payment Collected", "On Hold"],
  Rescheduled: ["Out for Delivery", "Exception", "On Hold"],
  Exception: ["Out for Delivery", "Rescheduled", "Returned", "On Hold", "Picked Up"],
  "On Hold": ["Picked Up", "Departed", "Out for Delivery", "Exception", "Returned", "Rescheduled"],
  "Payment Collected": ["Delivered", "Exception"],
  Delivered: [],
  "Return Delivered": [],
  Returned: [],
};

export function canTransition(from: ParcelStatus, to: ParcelStatus): boolean {
  if (from === to) return false;
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export const RIDER_ALLOWED_SCANS: ScanType[] = [
  "out_for_delivery",
  "delivered",
  "exception",
];

export function statusBadgeClass(status: ParcelStatus): string {
  switch (status) {
    case "Delivered":
    case "Return Delivered":
    case "Payment Collected":
      return "bg-success/20 text-success border-success/30";
    case "Exception":
    case "On Hold":
    case "Returned":
      return "bg-destructive/20 text-destructive border-destructive/30";
    case "Rescheduled":
      return "bg-warning/20 text-warning-foreground border-warning/30";
    case "Out for Delivery":
    case "Picked Up":
    case "Departed":
    case "Arrived":
    case "Ready for Collection":
      return "bg-primary/20 text-primary border-primary/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function generateTrackingNumber(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ALS-${yyyy}${mm}${dd}-${rand}`;
}
