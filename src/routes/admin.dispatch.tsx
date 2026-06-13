import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { BatchDispatch } from "@/components/BatchDispatch";

export const Route = createFileRoute("/admin/dispatch")({
  component: () => (
    <RoleGuard allow={["super_admin", "office"]}>
      <BatchDispatch />
    </RoleGuard>
  ),
});