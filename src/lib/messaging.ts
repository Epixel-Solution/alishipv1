// Helpers for outbound messages to receivers / customers.

function sanitizePhone(p?: string | null): string {
  if (!p) return "";
  let n = p.replace(/[^\d+]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  // Default to Kenya if a leading 0 is provided
  if (n.startsWith("0")) n = "254" + n.slice(1);
  return n;
}

export function whatsappLinkForReceiver(p: {
  name: string;
  phone?: string | null;
  tracking: string;
}): string {
  const msg =
    `Hi ${p.name}, this is your Aliship Logistics rider. ` +
    `Your parcel ${p.tracking} is on the way. ` +
    `Please confirm a good time to deliver. Thank you.`;
  const text = encodeURIComponent(msg);
  const phone = sanitizePhone(p.phone);
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}
