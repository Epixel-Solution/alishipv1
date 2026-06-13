import { ALISHIP_CONTACT } from "@/lib/contact";
import { Phone, Mail } from "lucide-react";

export function ContactBanner() {
  return (
    <div className="border-t border-border/60 bg-card/60 px-4 py-3 text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-1 text-center sm:flex-row sm:justify-center sm:gap-4">
        <span className="font-medium text-foreground">Contact admin:</span>
        <span className="inline-flex items-center gap-1">
          <Phone className="h-3 w-3 text-primary" />
          <a href={`tel:${ALISHIP_CONTACT.phones[0].replace(/\s/g, "")}`} className="hover:text-primary">
            {ALISHIP_CONTACT.phones[0]}
          </a>
          <span className="opacity-50">/</span>
          <a href={`tel:${ALISHIP_CONTACT.phones[1].replace(/\s/g, "")}`} className="hover:text-primary">
            {ALISHIP_CONTACT.phones[1]}
          </a>
        </span>
        <span className="inline-flex items-center gap-1">
          <Mail className="h-3 w-3 text-primary" />
          <a href={`mailto:${ALISHIP_CONTACT.email}`} className="hover:text-primary">
            {ALISHIP_CONTACT.email}
          </a>
        </span>
      </div>
    </div>
  );
}
