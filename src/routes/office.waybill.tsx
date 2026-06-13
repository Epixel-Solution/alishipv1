import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { WaybillForm } from "@/components/WaybillForm";

export const Route = createFileRoute("/office/waybill")({
  component: () => (
    <RoleGuard allow={["office", "super_admin"]}>
      <WaybillForm mode="office" />
    </RoleGuard>
  ),
});
