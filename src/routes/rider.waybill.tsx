import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { WaybillForm } from "@/components/WaybillForm";

export const Route = createFileRoute("/rider/waybill")({
  component: () => (
    <RoleGuard allow={["rider"]}>
      <WaybillForm mode="rider" />
    </RoleGuard>
  ),
});
