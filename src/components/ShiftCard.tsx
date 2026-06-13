import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, StopCircle, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getCurrentPosition } from "@/lib/route-geo";

export interface Shift {
  id: string;
  started_at: string;
  ended_at: string | null;
}

interface ShiftCardProps {
  /** Called whenever shift state changes so the parent can gate the UI */
  onShiftChange?: (shift: Shift | null) => void;
}

/** Returns milliseconds until 23:00 tonight (negative if already past) */
function msUntil2300(): number {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(23, 0, 0, 0);  // Changed from 21 to 23
  return cutoff.getTime() - now.getTime();
}

function elapsed(startedAt: string): string {
  const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function ShiftCard({ onShiftChange }: ShiftCardProps) {
  const { user } = useAuth();
  const [shift, setShift] = useState<Shift | null | undefined>(undefined); // undefined = loading
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0); // triggers re-render every minute for the elapsed timer
  const autoEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── helpers ───────────────────────────────────────────────────────────────

  const publish = useCallback(
    (s: Shift | null) => {
      setShift(s);
      onShiftChange?.(s);
    },
    [onShiftChange],
  );

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("rider_shifts")
      .select("id, started_at, ended_at")
      .eq("rider_id", user.id)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    publish(data ?? null);
  }, [user, publish]);

  /** Writes ended_at to DB and clears local state */
  const terminateShift = useCallback(
    async (shiftId: string, opts: { silent?: boolean } = {}) => {
      const pos = await getCurrentPosition();
      await supabase
        .from("rider_shifts")
        .update({
          ended_at: new Date().toISOString(),
          end_lat: pos?.lat ?? null,
          end_lng: pos?.lng ?? null,
        })
        .eq("id", shiftId);
      publish(null);
      if (!opts.silent) toast.success("Shift ended");
    },
    [publish],
  );

  // ── auto-terminate at 23:00 ───────────────────────────────────────────────

  const scheduleAutoEnd = useCallback(
    (shiftId: string) => {
      // clear any previous timer
      if (autoEndTimer.current) clearTimeout(autoEndTimer.current);

      const ms = msUntil2300();
      if (ms <= 0) {
        // already past 23:00 — terminate immediately
        toast.warning("Shift auto-terminated: past 23:00 curfew.");
        terminateShift(shiftId, { silent: true });
        return;
      }

      autoEndTimer.current = setTimeout(async () => {
        toast.warning("23:00 reached — your shift has been automatically ended.");
        await terminateShift(shiftId, { silent: true });
      }, ms);
    },
    [terminateShift],
  );

  // ── live elapsed ticker (every 60 s) ─────────────────────────────────────

  useEffect(() => {
    if (shift?.id) {
      tickTimer.current = setInterval(() => setTick((t) => t + 1), 60_000);
    }
    return () => {
      if (tickTimer.current) clearInterval(tickTimer.current);
    };
  }, [shift?.id]);

  // ── initial load ─────────────────────────────────────────────────────────

  useEffect(() => {
    load();
  }, [load]);

  // ── schedule auto-end whenever an active shift is loaded ─────────────────

  useEffect(() => {
    if (shift?.id) scheduleAutoEnd(shift.id);
    return () => {
      if (autoEndTimer.current) clearTimeout(autoEndTimer.current);
    };
  }, [shift?.id, scheduleAutoEnd]);

  // ── actions ───────────────────────────────────────────────────────────────

  const start = async () => {
    if (!user) return;

    // Block starting a shift past 23:00
    if (msUntil2300() <= 0) {
      toast.error("Cannot start a shift after 23:00.");
      return;
    }

    setLoading(true);
    const pos = await getCurrentPosition();
    const { error } = await supabase.from("rider_shifts").insert({
      rider_id: user.id,
      start_lat: pos?.lat ?? null,
      start_lng: pos?.lng ?? null,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Shift started — have a great day!");
    load();
  };

  const end = async () => {
    if (!shift) return;
    setLoading(true);
    await terminateShift(shift.id);
    setLoading(false);
  };

  // ── render ────────────────────────────────────────────────────────────────

  // Still fetching from DB — render nothing to avoid flash
  if (shift === undefined) return null;

  if (!shift) {
    const blocked = msUntil2300() <= 0;
    return (
      <Card className="border-border/60 bg-card p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          {blocked ? (
            <span className="text-destructive font-medium">Operations closed after 23:00</span>
          ) : (
            "No active shift"
          )}
        </div>
        {!blocked && (
          <Button
            size="sm"
            onClick={start}
            disabled={loading}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
          >
            <Play className="mr-1 h-3.5 w-3.5" /> Start shift
          </Button>
        )}
      </Card>
    );
  }

  const started = new Date(shift.started_at);
  const warningMs = msUntil2300();
  const nearCutoff = warningMs > 0 && warningMs < 30 * 60_000; // within 30 min of 23:00

  return (
    <Card
      className={`p-3 flex items-center justify-between gap-3 ${
        nearCutoff
          ? "border-amber-500/40 bg-amber-500/10"
          : "border-success/40 bg-success/10"
      }`}
    >
      <div className="text-sm min-w-0">
        <div className={`font-medium flex items-center gap-1 ${nearCutoff ? "text-amber-600" : "text-success"}`}>
          {nearCutoff && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
          {nearCutoff ? "Shift ends soon" : "On shift"}
        </div>
        <div className="text-xs text-muted-foreground">
          Started {started.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {" · "}
          {elapsed(shift.started_at)}
          {nearCutoff && (
            <span className="ml-1 text-amber-600 font-medium">
              · Auto-ends at 23:00
            </span>
          )}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={end} disabled={loading} className="shrink-0">
        <StopCircle className="mr-1 h-3.5 w-3.5" /> End shift
      </Button>
    </Card>
  );
}