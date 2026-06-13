import { createFileRoute, useParams } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { ScanScreen } from "@/components/ScanScreen";
import type { ScanType } from "@/lib/parcel-status";
import { SCAN_CONFIG } from "@/lib/parcel-status";

export const Route = createFileRoute("/admin/scan/$type")({
  component: () => (
    <RoleGuard allow={["super_admin", "office"]}>
      <Inner />
    </RoleGuard>
  ),
});

function Inner() {
  const { type } = useParams({ from: "/admin/scan/$type" });
  if (!(type in SCAN_CONFIG)) return <div className="p-6 text-center">Unknown scan type</div>;
  return <ScanScreen scanType={type as ScanType} backTo="/admin" />;
}