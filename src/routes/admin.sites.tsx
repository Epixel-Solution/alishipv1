import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/sites")({
  component: () => (<RoleGuard allow={["super_admin"]}><Sites /></RoleGuard>),
});

interface Site { id: string; name: string; location: string; is_active: boolean }

function Sites() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("sites").select("id, name, location, is_active").order("name");
    setSites((data as Site[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return toast.error("Name required");
    const { error } = await supabase.from("sites").insert({ name: name.trim(), location: location.trim() });
    if (error) return toast.error(error.message);
    setName(""); setLocation("");
    toast.success("Site created");
    load();
  };

  const toggle = async (s: Site) => {
    const { error } = await supabase.from("sites").update({ is_active: !s.is_active }).eq("id", s.id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Sites</h1>
      <Card className="space-y-3 border-border/60 bg-card p-4">
        <h2 className="text-base text-primary">Add new site</h2>
        <div>
          <Label className="mb-1.5 block">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nairobi HQ" />
        </div>
        <div>
          <Label className="mb-1.5 block">Location / city</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <Button onClick={create} className="bg-primary text-primary-foreground hover:bg-primary/90">Create</Button>
      </Card>

      <h2 className="text-lg">All sites</h2>
      {loading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (
        <div className="space-y-2">
          {sites.map((s) => (
            <Card key={s.id} className="flex items-center justify-between border-border/60 bg-card p-3">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.location || "—"}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs">{s.is_active ? "Active" : "Inactive"}</span>
                <Switch checked={s.is_active} onCheckedChange={() => toggle(s)} />
              </div>
            </Card>
          ))}
          {sites.length === 0 && <p className="text-sm text-muted-foreground">No sites yet.</p>}
        </div>
      )}
    </div>
  );
}
