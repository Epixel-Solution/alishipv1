import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { Route as Office } from "./office.waybill";
export const Route = createFileRoute("/admin/waybill")({
  component: () => (
    <RoleGuard allow={["super_admin"]}>
      {Office.options.component && <Office.options.component />}
    </RoleGuard>
  ),
});
