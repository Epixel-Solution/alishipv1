import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface Site { id: string; name: string; location: string }

export function SitePicker({
  value, onChange, placeholder = "Select site",
}: { value: string | null; onChange: (id: string | null) => void; placeholder?: string }) {
  const [sites, setSites] = useState<Site[]>([]);

  useEffect(() => {
    supabase.from("sites").select("id, name, location").eq("is_active", true).order("name")
      .then(({ data }) => setSites((data as Site[]) || []));
  }, []);

  return (
    <Select value={value ?? ""} onValueChange={(v) => onChange(v || null)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {sites.map((s) => (
          <SelectItem key={s.id} value={s.id}>{s.name}{s.location ? ` — ${s.location}` : ""}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
