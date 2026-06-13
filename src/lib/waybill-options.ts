// Shared option lists & helpers for the Waybill form / parcel detail / track page.

export const SERVICE_CLASSES = ["express", "ltl"] as const;
export type ServiceClass = (typeof SERVICE_CLASSES)[number];
export const SERVICE_CLASS_LABEL: Record<ServiceClass, string> = {
  express: "Express",
  ltl: "LTL",
};

export const WAYBILL_MODES = ["electronic", "paper"] as const;
export type WaybillMode = (typeof WAYBILL_MODES)[number];
export const WAYBILL_MODE_LABEL: Record<WaybillMode, string> = {
  electronic: "E-Waybill",
  paper: "Paper-Waybill",
};

export const DELIVERY_TYPES = ["door", "branch"] as const;
export type DeliveryType = (typeof DELIVERY_TYPES)[number];
export const DELIVERY_TYPE_LABEL: Record<DeliveryType, string> = {
  door: "Delivery to Door",
  branch: "Branch Pickup",
};

export const GOODS_TYPES = [
  "normal",
  "fragile",
  "documents",
  "electronics",
  "perishable",
  "liquid",
  "other",
] as const;
export type GoodsType = (typeof GOODS_TYPES)[number];
export const GOODS_TYPE_LABEL: Record<GoodsType, string> = {
  normal: "Normal Cargo",
  fragile: "Fragile",
  documents: "Documents",
  electronics: "Electronics",
  perishable: "Perishable",
  liquid: "Liquid",
  other: "Other",
};

export const SETTLEMENT_TYPES = ["cash", "prepaid", "freight_collect", "cod"] as const;
export type SettlementType = (typeof SETTLEMENT_TYPES)[number];
export const SETTLEMENT_TYPE_LABEL: Record<SettlementType, string> = {
  cash: "Cash (paid at office)",
  prepaid: "Prepaid Wallet (account / bulk)",
  freight_collect: "Freight Collect (paid on pickup at destination)",
  cod: "Cash on Delivery (paid on doorstep delivery)",
};

export const PRODUCT_SERVICES = ["standard", "same_day", "next_day", "economy"] as const;
export type ProductService = (typeof PRODUCT_SERVICES)[number];
export const PRODUCT_SERVICE_LABEL: Record<ProductService, string> = {
  standard: "Standard Express",
  same_day: "Same-Day",
  next_day: "Next-Day",
  economy: "Economy",
};

/**
 * Estimate freight in KES based on service tier + weight.
 * Tweakable until a rate-card admin UI exists.
 */
export function estimateFreight(
  weightKg: number,
  service: ProductService,
  klass: ServiceClass,
): number {
  const w = Math.max(0, Number(weightKg) || 0);
  if (klass === "ltl") return Math.max(500, Math.round(w * 35));
  switch (service) {
    case "same_day":
      return Math.round(250 + Math.max(0, w - 1) * 80);
    case "next_day":
      return Math.round(200 + Math.max(0, w - 1) * 70);
    case "economy":
      return Math.round(100 + Math.max(0, w - 1) * 40);
    case "standard":
    default:
      return Math.round(150 + Math.max(0, w - 1) * 60);
  }
}

/** Mask a phone for public tracking: keep first 4 + last 3, mask middle. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\s+/g, "");
  if (cleaned.length <= 7) return cleaned;
  const head = cleaned.slice(0, 4);
  const tail = cleaned.slice(-3);
  const mid = "•".repeat(Math.max(2, cleaned.length - 7));
  return `${head}${mid}${tail}`;
}
