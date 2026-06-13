import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { OfficeHome } from "@/components/OfficeHome";

export const Route = createFileRoute("/office/")({
  component: () => (
    <RoleGuard allow={["office", "super_admin"]}>
      <OfficeHome basePath="/office" />
    </RoleGuard>
  ),
});
