import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { ExternalForm } from "./office.external";

export const Route = createFileRoute("/admin/external")({
  component: () => (
    <RoleGuard allow={["super_admin"]}>
      <ExternalForm basePath="/admin" />
    </RoleGuard>
  ),
});
