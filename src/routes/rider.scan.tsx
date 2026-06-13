import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useState } from "react";
import { ScanScreen } from "@/components/ScanScreen";
import { RIDER_ALLOWED_SCANS, SCAN_CONFIG, type ScanType } from "@/lib/parcel-status";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/rider/scan")({
  component: () => (
    <RoleGuard allow={["rider"]}>
      <RiderScan />
    </RoleGuard>
  ),
});

function RiderScan() {
  const [type, setType] = useState<ScanType>("out_for_delivery");
  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-card p-3">
        <label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Scan type</label>
        <div className="grid grid-cols-2 gap-2">
          {RIDER_ALLOWED_SCANS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                type === t
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-background hover:border-primary/40"
              }`}
            >
              {SCAN_CONFIG[t].label}
            </button>
          ))}
        </div>
      </Card>
      <ScanScreen scanType={type} backTo="/rider" />
    </div>
  );
}
