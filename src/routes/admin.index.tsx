import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { OfficeHome } from "@/components/OfficeHome";

export const Route = createFileRoute("/admin/")({
  component: () => (
    <RoleGuard allow={["super_admin"]}>
      <OfficeHome basePath="/admin" />
    </RoleGuard>
  ),
});
