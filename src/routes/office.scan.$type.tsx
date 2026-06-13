import { createFileRoute, useParams } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { ScanScreen } from "@/components/ScanScreen";
import type { ScanType } from "@/lib/parcel-status";
import { SCAN_CONFIG } from "@/lib/parcel-status";

export const Route = createFileRoute("/office/scan/$type")({
  component: () => (
    <RoleGuard allow={["office", "super_admin"]}>
      <Inner />
    </RoleGuard>
  ),
});

function Inner() {
  const { type } = useParams({ from: "/office/scan/$type" });
  if (!(type in SCAN_CONFIG)) return <div className="p-6 text-center">Unknown scan type</div>;
  return <ScanScreen scanType={type as ScanType} backTo="/office" />;
}
