// Realtime: toast riders when a new parcel is assigned to them.
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export function useRiderAssignmentNotifications() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || role !== "rider") return;
    const channel = supabase
      .channel(`rider-assign-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "parcels" },
        (payload) => {
          const n = payload.new as any;
          const o = payload.old as any;
          if (n?.assigned_rider_id === user.id && o?.assigned_rider_id !== user.id) {
            toast.success(`New parcel assigned: ${n.tracking_number}`, {
              description: n.receiver_name ?? "",
              duration: 10_000,
              action: {
                label: "Open",
                onClick: () => navigate({ to: "/rider/parcels/$id", params: { id: n.id } }),
              },
            });
            // beep
            try {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const o2 = ctx.createOscillator();
              const g = ctx.createGain();
              o2.connect(g);
              g.connect(ctx.destination);
              o2.frequency.value = 880;
              g.gain.value = 0.05;
              o2.start();
              setTimeout(() => {
                o2.stop();
                ctx.close();
              }, 250);
            } catch {
              /* sound is best-effort */
            }
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role, navigate]);
}
