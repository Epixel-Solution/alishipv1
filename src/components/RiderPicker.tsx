import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface RiderOption {
  id: string;
  full_name: string;
  staff_code: string | null;
}

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
}

export function RiderPicker({ value, onChange, label = "Assign rider" }: Props) {
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRiders();
  }, []);

  const fetchRiders = async () => {
    console.log("=== RiderPicker: Starting fetch ===");
    setLoading(true);
    try {
      // First, check session
      const { data: sessionData } = await supabase.auth.getSession();
      console.log("Session exists:", !!sessionData?.session);
      console.log("User email:", sessionData?.session?.user?.email);
      
      // Get all users with role 'rider' from user_roles
      console.log("Fetching user_roles with role='rider'...");
      const { data: roleRows, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "rider");
      
      console.log("roleRows result:", roleRows);
      console.log("roleError:", roleError);
      
      if (roleError) {
        console.error("Role fetch error:", roleError);
        throw roleError;
      }
      
      if (!roleRows || roleRows.length === 0) {
        console.log("No riders found in user_roles table");
        setRiders([]);
        setLoading(false);
        return;
      }
      
      const riderIds = roleRows.map((r: any) => r.user_id);
      console.log("Found rider IDs:", riderIds);
      
      // Fetch profiles for these riders
      console.log("Fetching profiles for rider IDs...");
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, staff_code, is_active")
        .in("id", riderIds)
        .order("full_name");
      
      console.log("Profiles result:", profiles);
      console.log("Profile error:", profileError);
      
      if (profileError) {
        console.error("Profile fetch error:", profileError);
        throw profileError;
      }
      
      // Filter only active riders
      const activeRiders = (profiles || []).filter((p: any) => p.is_active === true);
      console.log("Active riders:", activeRiders);
      
      setRiders(activeRiders as RiderOption[]);
    } catch (err) {
      console.error("Error in fetchRiders:", err);
      setRiders([]);
    } finally {
      setLoading(false);
      console.log("=== RiderPicker: Fetch complete ===");
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Select 
        value={value ?? ""} 
        onValueChange={(v) => {
          console.log("Selected rider ID:", v);
          onChange(v || null);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={loading ? "Loading riders..." : "Select a rider"} />
        </SelectTrigger>
        <SelectContent>
          {loading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
          ) : riders.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No active riders found. Please create a rider in User Management first.
            </div>
          ) : (
            riders.map((rider) => (
              <SelectItem key={rider.id} value={rider.id}>
                {rider.full_name}
                {rider.staff_code ? ` (${rider.staff_code})` : ""}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}