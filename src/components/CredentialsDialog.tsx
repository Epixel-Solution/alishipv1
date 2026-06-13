import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eye, EyeOff, Copy, Check, MessageCircle, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import {
  buildCredentialsMessage,
  whatsappLink,
  smsLink,
  emailLink,
  type Credentials,
} from "@/lib/credentials";

export function CredentialsDialog({
  open,
  onOpenChange,
  credentials,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  credentials: Credentials | null;
}) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  if (!credentials) return null;

  const hasPhone = !!(credentials.phone && credentials.phone.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Account credentials</DialogTitle>
          <DialogDescription>
            Share these with {credentials.full_name}. The password is shown only once — copy or send it now.
          </DialogDescription>
        </DialogHeader>

        <Card className="space-y-2.5 border-border/60 p-4">
          {credentials.staff_code && (
            <Row label="Staff ID" value={credentials.staff_code} onCopy={() => copy("Staff ID", credentials.staff_code!)} copied={copied === "Staff ID"} mono />
          )}
          <Row label="Email" value={credentials.email} onCopy={() => copy("Email", credentials.email)} copied={copied === "Email"} />
          {hasPhone && (
            <Row label="Phone" value={credentials.phone!} onCopy={() => copy("Phone", credentials.phone!)} copied={copied === "Phone"} />
          )}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Password</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-2 py-1.5 font-mono text-sm">
                {show ? credentials.password : "•".repeat(Math.min(credentials.password.length, 12))}
              </code>
              <Button size="icon" variant="ghost" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide" : "Show"}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => copy("Password", credentials.password)} aria-label="Copy password">
                {copied === "Password" ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-2">
          <a href={whatsappLink(credentials)} target="_blank" rel="noreferrer">
            <Button variant="outline" className="w-full"><MessageCircle className="mr-1.5 h-4 w-4 text-[#25D366]" /> WhatsApp</Button>
          </a>
          <a href={hasPhone ? smsLink(credentials) : "#"} onClick={(e) => { if (!hasPhone) { e.preventDefault(); toast.error("Add a phone number first"); } }}>
            <Button variant="outline" className="w-full"><Phone className="mr-1.5 h-4 w-4 text-primary" /> SMS</Button>
          </a>
          <a href={emailLink(credentials)}>
            <Button variant="outline" className="w-full"><Mail className="mr-1.5 h-4 w-4 text-primary" /> Email</Button>
          </a>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => copy("Message", buildCredentialsMessage(credentials))}
          className="w-full"
        >
          <Copy className="mr-2 h-3 w-3" /> Copy full message
        </Button>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, onCopy, copied, mono }: { label: string; value: string; onCopy: () => void; copied: boolean; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className={`flex-1 truncate text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
        <Button size="icon" variant="ghost" onClick={onCopy} aria-label={`Copy ${label}`}>
          {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
