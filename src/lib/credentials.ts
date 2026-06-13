import { ALISHIP_CONTACT } from "@/lib/contact";

export interface Credentials {
  staff_code: string | null;
  full_name: string;
  email: string;
  password: string;
  phone?: string | null;
  role: string;
}

const ROLE_PORTAL: Record<string, string> = {
  super_admin: "/login/admin",
  office: "/login/admin",
  rider: "/login/rider",
};

export function buildCredentialsMessage(c: Credentials): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://app.aliship.com";
  const portal = ROLE_PORTAL[c.role] || "/login";
  const lines = [
    "Welcome to Aliship Logistics.",
    "",
    `Name: ${c.full_name}`,
    c.staff_code ? `Staff ID: ${c.staff_code}` : "",
    `Login: ${origin}${portal}`,
    `Email: ${c.email}`,
    `Password: ${c.password}`,
    "",
    "Please sign in and keep these details safe.",
    `Help: ${ALISHIP_CONTACT.phones[0]} · ${ALISHIP_CONTACT.email}`,
  ].filter(Boolean);
  return lines.join("\n");
}

function sanitizePhone(p?: string | null): string {
  if (!p) return "";
  return p.replace(/[^\d+]/g, "");
}

export function whatsappLink(c: Credentials): string {
  const text = encodeURIComponent(buildCredentialsMessage(c));
  const phone = sanitizePhone(c.phone).replace(/^\+/, "");
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function smsLink(c: Credentials): string {
  const body = encodeURIComponent(buildCredentialsMessage(c));
  const phone = sanitizePhone(c.phone);
  return `sms:${phone}?body=${body}`;
}

export function emailLink(c: Credentials): string {
  const subject = encodeURIComponent("Your Aliship Logistics account");
  const body = encodeURIComponent(buildCredentialsMessage(c));
  return `mailto:${encodeURIComponent(c.email)}?subject=${subject}&body=${body}`;
}
