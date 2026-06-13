import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ScannerInput } from "@/components/ScannerInput";
import { RiderPicker } from "@/components/RiderPicker";
import { supabase } from "@/integrations/supabase/client";
import type { ParcelStatus } from "@/lib/parcel-status";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, XCircle, ChevronLeft, Truck,
  RotateCcw, Package, Trash2, History,
} from "lucide-react";

interface ScannedEntry {
  parcelId: string | null;
  tracking: string;
  receiver: string;
  ok: boolean;
  message: string;
  assigned: boolean; // true once committed to DB
}

interface CompletedBatch {
  riderName: string;
  timestamp: string;
  entries: ScannedEntry[];
}

export function BatchDispatch() {
  const navigate = useNavigate();
  const [riderId, setRiderId] = useState<string | null>(null);
  const [riderName, setRiderName] = useState<string>("");
  const [riderConfirmed, setRiderConfirmed] = useState(false);
  const [scanned, setScanned] = useState<ScannedEntry[]>([]);
  const [scanning, setScanning] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [history, setHistory] = useState<CompletedBatch[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const handleConfirmRider = () => {
    if (!riderId) return;
    setRiderConfirmed(true);
    setScanned([]);
  };

  useEffect(() => {
    if (!riderId) {
      setRiderName("");
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", riderId)
        .maybeSingle();
      if (!error && data) {
        const d = data as any;
        setRiderName(d.full_name || d.name || d.display_name || d.email || "");
      }
    })();
  }, [riderId]);

  const handleScan = useCallback(async (code: string) => {
    if (!riderId || !riderConfirmed || scanning) return;

    if (scanned.some((s) => s.tracking === code)) {
      toast.warning(`${code} already scanned this session`);
      return;
    }

    setScanning(true);
    try {
      const { data: parcel, error } = await supabase
        .from("parcels")
        .select("id, tracking_number, status, receiver_name, assigned_rider_id")
        .or(`tracking_number.eq.${code},external_tracking_number.eq.${code}`)
        .maybeSingle();

      if (error || !parcel) {
        setScanned((prev) => [
          { parcelId: null, tracking: code, receiver: "", ok: false, message: "Parcel not found", assigned: false },
          ...prev,
        ]);
        toast.error(`${code} — not found`);
        return;
      }

      const current = parcel.status as ParcelStatus;
      // Admin/office can dispatch from any status, mirroring ScanScreen's canOverride
      // behavior — only block parcels that are already in a terminal state.
      const TERMINAL: ParcelStatus[] = ["Delivered", "Return Delivered", "Returned"];

      if (TERMINAL.includes(current)) {
        setScanned((prev) => [
          {
            parcelId: parcel.id,
            tracking: parcel.tracking_number,
            receiver: parcel.receiver_name || "",
            ok: false,
            message: `Cannot dispatch — status: ${current}`,
            assigned: false,
          },
          ...prev,
        ]);
        toast.error(`${parcel.tracking_number} — invalid status: ${current}`);
        return;
      }

      // Just queue it — don't write to DB yet. Assignment happens on "Done".
      setScanned((prev) => [
        {
          parcelId: parcel.id,
          tracking: parcel.tracking_number,
          receiver: parcel.receiver_name || "",
          ok: true,
          message: "Pending assignment",
          assigned: false,
        },
        ...prev,
      ]);
      toast.success(`${parcel.tracking_number} added to list`);
    } catch (e: any) {
      toast.error(e.message || "Scan failed");
    } finally {
      setScanning(false);
    }
  }, [riderId, riderConfirmed, scanned, scanning]);

  const handleRemove = (index: number) => {
    setScanned((prev) => prev.filter((_, i) => i !== index));
  };

  const pendingValid = scanned.filter((s) => s.ok && !s.assigned);
  const successCount = scanned.filter((s) => s.assigned).length;
  const failCount = scanned.filter((s) => !s.ok).length;
  const pendingCount = pendingValid.length;

  // Commit all pending-valid scans to the DB, assigning them to the current rider.
  const handleDone = async () => {
    if (pendingValid.length === 0) {
      // Nothing to assign — just go back / or let user switch rider freely
      navigate({ to: "/admin" });
      return;
    }

    setFinishing(true);
    const updated = [...scanned];

    for (let i = 0; i < updated.length; i++) {
      const entry = updated[i];
      if (!entry.ok || entry.assigned || !entry.parcelId) continue;

      try {
        const { error: updateError } = await supabase
          .from("parcels")
          .update({
            status: "Out for Delivery",
            assigned_rider_id: riderId,
            notes: `[Out for Delivery] Batch dispatched to ${riderName}`,
          })
          .eq("id", entry.parcelId);

        if (updateError) {
          updated[i] = { ...entry, ok: false, message: updateError.message };
          toast.error(`${entry.tracking} — ${updateError.message}`);
          continue;
        }

        await supabase.from("parcel_status_logs").insert({
          parcel_id: entry.parcelId,
          status: "Out for Delivery",
          notes: `Batch dispatched to ${riderName}`,
        });

        updated[i] = { ...entry, assigned: true, message: `Assigned to ${riderName}` };
        toast.success(`${entry.tracking} → Out for Delivery`);
      } catch (e: any) {
        updated[i] = { ...entry, ok: false, message: e.message || "Failed" };
        toast.error(`${entry.tracking} — ${e.message || "Failed"}`);
      }
    }

    setScanned(updated);
    setFinishing(false);

    // Save this batch into history
    setHistory((prev) => [
      { riderName, timestamp: new Date().toLocaleString(), entries: updated },
      ...prev,
    ]);

    navigate({ to: "/admin" });
  };

  // Switch rider — archive current scans (if any) into history first
  const handleNewRider = () => {
    if (scanned.length > 0) {
      setHistory((prev) => [
        { riderName, timestamp: new Date().toLocaleString(), entries: scanned },
        ...prev,
      ]);
      setShowHistory(true);
    }
    setRiderConfirmed(false);
    setRiderId(null);
    setRiderName("");
    setScanned([]);
  };

  const handleRiderChange = (id: string | null) => {
    setRiderId(id);
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/admin" })}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl">Batch Dispatch</h1>
          <p className="text-xs text-muted-foreground">
            Select a rider, scan parcels, then tap Done to assign
          </p>
        </div>
        {history.length > 0 && (
          <Button variant="ghost" size="icon" onClick={() => setShowHistory((s) => !s)}>
            <History className="h-5 w-5" />
          </Button>
        )}
      </div>

      {showHistory && history.length > 0 && (
        <Card className="rounded-2xl border-border/60 bg-card p-4 space-y-3">
          <div className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4" />
            Dispatch History
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {history.map((batch, bi) => (
              <div key={bi} className="rounded-xl border border-border/60 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span className="font-semibold text-foreground">{batch.riderName || "Unknown rider"}</span>
                  <span>{batch.timestamp}</span>
                </div>
                <div className="space-y-1.5">
                  {batch.entries.map((e, ei) => (
                    <div key={ei} className="flex items-center justify-between text-xs">
                      <span className="font-mono">{e.tracking}</span>
                      <Badge
                        className={`rounded-full text-[10px] px-2 py-0.5 font-semibold border-transparent ${
                          e.assigned
                            ? "bg-green-500/15 text-green-700"
                            : "bg-destructive/15 text-destructive"
                        }`}
                      >
                        {e.assigned ? "Assigned" : "Not assigned"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!riderConfirmed ? (
        <Card className="space-y-4 rounded-2xl border-border/60 bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Truck className="h-4 w-4 text-primary" />
            Step 1 — Select Rider
          </div>
          <RiderPicker
            value={riderId}
            onChange={handleRiderChange}
            label="Assign parcels to"
          />
          <Button
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            disabled={!riderId}
            onClick={handleConfirmRider}
          >
            Confirm Rider & Start Scanning
          </Button>
        </Card>
      ) : (
        <>
          <Card className="flex items-center justify-between rounded-2xl border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Dispatching to</div>
                <div className="font-semibold text-base text-primary leading-tight">
                  {riderName || "Loading rider…"}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 text-xs font-medium">
              {pendingCount > 0 && (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-700">
                  {pendingCount} pending
                </span>
              )}
              {successCount > 0 && (
                <span className="rounded-full bg-green-500/15 px-2.5 py-1 text-green-700">
                  {successCount} assigned
                </span>
              )}
              {failCount > 0 && (
                <span className="rounded-full bg-destructive/15 px-2.5 py-1 text-destructive">
                  {failCount} failed
                </span>
              )}
              {pendingCount === 0 && successCount === 0 && failCount === 0 && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                  No scans yet
                </span>
              )}
            </div>
          </Card>

          <ScannerInput onScan={handleScan} disabled={scanning || finishing} />

          {scanned.length > 0 && (
            <Card className="rounded-2xl border-border/60 bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Package className="h-4 w-4" />
                  Scanned ({scanned.length})
                </div>
                <div className="flex gap-2 text-xs font-medium">
                  {pendingCount > 0 && <span className="text-amber-600">{pendingCount} pending</span>}
                  {successCount > 0 && <span className="text-green-600">{successCount} assigned</span>}
                  {failCount > 0 && <span className="text-destructive">{failCount} failed</span>}
                </div>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {scanned.map((entry, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between rounded-xl p-3 text-sm ${
                      !entry.ok
                        ? "bg-destructive/5 border border-destructive/20"
                        : entry.assigned
                        ? "bg-green-500/5 border border-green-500/20"
                        : "bg-amber-500/5 border border-amber-500/20"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {!entry.ok
                        ? <XCircle className="h-5 w-5 text-destructive shrink-0" />
                        : entry.assigned
                        ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                        : <Package className="h-5 w-5 text-amber-600 shrink-0" />
                      }
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-medium">{entry.tracking}</div>
                        {entry.receiver && (
                          <div className="text-xs text-muted-foreground truncate">{entry.receiver}</div>
                        )}
                        <div className={`text-xs ${!entry.ok ? "text-destructive" : "text-muted-foreground"}`}>
                          {entry.message}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge
                        className={`rounded-full text-[10px] px-2.5 py-1 font-semibold ${
                          !entry.ok
                            ? "bg-destructive/15 text-destructive border-transparent"
                            : entry.assigned
                            ? "bg-green-500/15 text-green-700 border-transparent"
                            : "bg-amber-500/15 text-amber-700 border-transparent"
                        }`}
                      >
                        {!entry.ok ? "Failed" : entry.assigned ? "Assigned" : "Pending"}
                      </Badge>
                      {!entry.assigned && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemove(i)}
                          disabled={finishing}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button
              variant="outline"
              onClick={handleNewRider}
              className="h-12 rounded-xl flex items-center gap-2 border-border/70"
              disabled={finishing}
            >
              <RotateCcw className="h-4 w-4" />
              Switch Rider
            </Button>
            <Button
              className="h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold disabled:opacity-60"
              onClick={handleDone}
              disabled={finishing || scanned.length === 0}
            >
              {finishing ? "Assigning..." : pendingCount > 0 ? `Done (${pendingCount})` : "Done"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}